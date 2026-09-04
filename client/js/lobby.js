/**
 * Lobby multijoueur : créer / rejoindre / quitter une salle.
 */
(function () {
  const SESSION_KEY = "oie_multi_session";

  let currentRoom = null;
  let currentYou = null;

  const els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function cacheEls() {
    els.lobby = $("lobby-screen");
    els.game = $("game-screen");
    els.entry = $("lobby-entry");
    els.room = $("lobby-room");
    els.name = $("lobby-name");
    els.code = $("lobby-code");
    els.error = $("lobby-error");
    els.createBtn = $("lobby-create-btn");
    els.joinBtn = $("lobby-join-btn");
    els.leaveBtn = $("lobby-leave-btn");
    els.startBtn = $("lobby-start-btn");
    els.roomCode = $("lobby-room-code");
    els.players = $("lobby-players");
    els.status = $("lobby-status");
    els.diceBox = $("lobby-dice-mode");
    els.copyBtn = $("lobby-copy-btn");
    els.waiting = $("lobby-waiting");
  }

  function showError(message) {
    if (!els.error) return;
    if (!message) {
      els.error.hidden = true;
      els.error.textContent = "";
      return;
    }
    els.error.hidden = false;
    els.error.textContent = message;
  }

  function saveSession(you, room) {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          code: room.code,
          token: you.reconnectToken,
          playerId: you.id,
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.code || !data.token) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function setScreen(mode) {
    // mode: entry | room | game
    if (els.lobby) els.lobby.hidden = mode === "game";
    if (els.game) els.game.hidden = mode !== "game";
    if (els.entry) els.entry.hidden = mode !== "entry";
    if (els.room) els.room.hidden = mode !== "room";
    if (els.waiting) els.waiting.hidden = !(mode === "room" && currentRoom && currentRoom.status === "playing");
  }

  function emit(event, payload) {
    return new Promise(function (resolve, reject) {
      const socket = window.gameSocket;
      if (!socket || !socket.connected) {
        reject(new Error("Pas connecté au serveur"));
        return;
      }
      socket.timeout(5000).emit(event, payload, function (err, response) {
        if (err) {
          reject(err);
          return;
        }
        resolve(response);
      });
    });
  }

  function renderPlayers(room, you) {
    if (!els.players) return;
    els.players.innerHTML = "";

    (room.players || []).forEach(function (p) {
      const row = document.createElement("div");
      row.className = "lobby-player" + (p.id === (you && you.id) ? " is-you" : "");
      if (!p.connected) row.classList.add("is-offline");

      const swatch = document.createElement("span");
      swatch.className = "lobby-player-swatch";
      swatch.style.background = p.color;

      const name = document.createElement("span");
      name.className = "lobby-player-name";
      name.textContent = p.name + (p.id === (you && you.id) ? " (toi)" : "");

      const badges = document.createElement("span");
      badges.className = "lobby-player-badges";
      if (p.isHost) {
        const host = document.createElement("span");
        host.className = "lobby-badge host";
        host.textContent = "Hôte";
        badges.appendChild(host);
      }
      if (!p.connected) {
        const off = document.createElement("span");
        off.className = "lobby-badge offline";
        off.textContent = "Hors ligne";
        badges.appendChild(off);
      }

      row.appendChild(swatch);
      row.appendChild(name);
      row.appendChild(badges);
      els.players.appendChild(row);
    });
  }

  function updateDiceUI(room, you) {
    if (!els.diceBox) return;
    const isHost = you && room && room.hostId === you.id;
    const inLobby = room && room.status === "lobby";

    els.diceBox.querySelectorAll(".lobby-dice-btn").forEach(function (btn) {
      const count = parseInt(btn.dataset.count, 10);
      btn.classList.toggle("active", room && room.diceCount === count);
      btn.disabled = !isHost || !inLobby;
    });
  }

  function applyRoomState(room, you) {
    currentRoom = room || null;
    if (you) currentYou = you;

    if (!currentRoom || !currentYou) {
      setScreen("entry");
      return;
    }

    saveSession(currentYou, currentRoom);

    if (els.roomCode) els.roomCode.textContent = currentRoom.code;
    if (els.status) {
      const n = currentRoom.players.length;
      const max = currentRoom.maxPlayers || 10;
      const label = currentRoom.status === "playing" ? "Partie en cours" : "En lobby";
      els.status.textContent = label + " · " + n + " / " + max + " joueurs";
    }

    renderPlayers(currentRoom, currentYou);
    updateDiceUI(currentRoom, currentYou);

    const isHost = currentRoom.hostId === currentYou.id;
    if (els.startBtn) {
      els.startBtn.hidden = !isHost || currentRoom.status !== "lobby";
      els.startBtn.disabled = !currentRoom.canStart;
      els.startBtn.title = currentRoom.canStart
        ? "Démarrer la partie"
        : "Il faut au moins " + (currentRoom.minPlayers || 2) + " joueurs connectés";
    }

    if (currentRoom.status === "playing") {
      setScreen("game");
      if (window.gameClient && typeof window.gameClient.sync === "function") {
        window.gameClient.sync(currentRoom, currentYou);
      }
    } else {
      setScreen("room");
      if (els.waiting) els.waiting.hidden = true;
    }
  }

  function handleRoomResponse(response) {
    if (!response) return;
    if (response.ok === false) {
      showError(response.error || "Erreur");
      return;
    }
    showError("");
    applyRoomState(response.room, response.you || currentYou);
  }

  async function onCreate() {
    showError("");
    const name = (els.name && els.name.value) || "";
    try {
      const response = await emit("createRoom", { name: name });
      handleRoomResponse(response);
    } catch (err) {
      showError(err.message || "Création impossible");
    }
  }

  async function onJoin() {
    showError("");
    const name = (els.name && els.name.value) || "";
    const code = (els.code && els.code.value) || "";
    try {
      const response = await emit("joinRoom", { name: name, code: code });
      handleRoomResponse(response);
    } catch (err) {
      showError(err.message || "Impossible de rejoindre");
    }
  }

  async function onLeave() {
    showError("");
    try {
      await emit("leaveRoom", {});
    } catch (err) {
      /* même en erreur locale, on reset l'UI */
    }
    currentRoom = null;
    currentYou = null;
    clearSession();
    if (window.gameClient && typeof window.gameClient.reset === "function") {
      window.gameClient.reset();
    }
    setScreen("entry");
  }

  async function onStart() {
    showError("");
    try {
      const response = await emit("startGame", {});
      if (response && response.ok === false) {
        showError(response.error || "Démarrage impossible");
        return;
      }
      if (response && response.room) {
        applyRoomState(response.room, currentYou);
      }
    } catch (err) {
      showError(err.message || "Démarrage impossible");
    }
  }

  async function onSetDice(count) {
    try {
      const response = await emit("setDiceCount", { count: count });
      if (response && response.ok === false) {
        showError(response.error || "Réglage impossible");
        return;
      }
      if (response && response.room) {
        applyRoomState(response.room, response.you || currentYou);
      }
    } catch (err) {
      showError(err.message || "Réglage impossible");
    }
  }

  async function tryReconnect() {
    const session = loadSession();
    if (!session) return;
    try {
      const response = await emit("reconnectRoom", {
        code: session.code,
        token: session.token,
      });
      if (!response || response.ok === false) {
        clearSession();
        if (window.gameClient && typeof window.gameClient.reset === "function") {
          window.gameClient.reset();
        }
        setScreen("entry");
        showError((response && response.error) || "Reconnexion impossible");
        return;
      }
      handleRoomResponse(response);
    } catch (err) {
      clearSession();
      if (window.gameClient && typeof window.gameClient.reset === "function") {
        window.gameClient.reset();
      }
      setScreen("entry");
    }
  }

  function bind() {
    cacheEls();
    setScreen("entry");

    if (els.createBtn) els.createBtn.addEventListener("click", onCreate);
    if (els.joinBtn) els.joinBtn.addEventListener("click", onJoin);
    if (els.leaveBtn) els.leaveBtn.addEventListener("click", onLeave);
    if (els.startBtn) els.startBtn.addEventListener("click", onStart);

    if (els.code) {
      els.code.addEventListener("input", function () {
        els.code.value = els.code.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
      });
      els.code.addEventListener("keydown", function (e) {
        if (e.key === "Enter") onJoin();
      });
    }

    if (els.name) {
      els.name.addEventListener("keydown", function (e) {
        if (e.key === "Enter") onCreate();
      });
    }

    if (els.diceBox) {
      els.diceBox.querySelectorAll(".lobby-dice-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          onSetDice(parseInt(btn.dataset.count, 10));
        });
      });
    }

    if (els.copyBtn) {
      els.copyBtn.addEventListener("click", async function () {
        if (!currentRoom) return;
        try {
          await navigator.clipboard.writeText(currentRoom.code);
          els.copyBtn.textContent = "Copié !";
          setTimeout(function () {
            els.copyBtn.textContent = "Copier";
          }, 1200);
        } catch (e) {
          showError("Copie impossible");
        }
      });
    }

    const socket = window.gameSocket;
    if (!socket) {
      showError("Socket.IO non disponible");
      return;
    }

    socket.on("roomUpdated", function (payload) {
      if (!payload || !payload.room) return;
      showError("");
      applyRoomState(payload.room, payload.you || currentYou);
    });

    socket.on("roomError", function (payload) {
      showError((payload && payload.error) || "Erreur");
    });

    socket.on("roomLeft", function () {
      currentRoom = null;
      currentYou = null;
      clearSession();
      if (window.gameClient && typeof window.gameClient.reset === "function") {
        window.gameClient.reset();
      }
      setScreen("entry");
    });

    socket.on("gameStarted", function (payload) {
      if (payload && payload.room) {
        applyRoomState(payload.room, currentYou);
      }
    });

    socket.on("connect", function () {
      tryReconnect();
    });

    if (socket.connected) {
      tryReconnect();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }

  window.gameLobby = {
    getRoom: function () {
      return currentRoom;
    },
    getYou: function () {
      return currentYou;
    },
    leave: function () {
      return onLeave();
    },
  };
})();
