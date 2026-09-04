/**
 * Client de jeu multijoueur.
 * Le serveur est l'autorité ; ce module affiche et envoie des intentions.
 */
(function initMultiplayerGame(){
  try{
    let players = [];
    let currentPlayerId = null;
    let you = null;
    let isHost = false;
    let roomCode = "";
    let diceCount = 2;
    let animating = false;
    let queuedSync = null;
    let lastMoveKey = null;
    let boardReady = false;
    let activePendingType = null;
    let activeMovePayload = null;
    let letterConfirming = false;
    let currentLetterKey = null;
    let lastLetterPending = null;
    let genreConfirming = false;
    let currentGenreKey = null;
    let lastGenrePending = null;
    let mimeConfirming = false;
    let currentMimeKey = null;
    let lastMimePending = null;
    let raceConfirming = false;
    let currentRaceKey = null;
    let lastRacePending = null;

    function $(id){
      return document.getElementById(id);
    }

    function showFinalDice(dice){
      if(!dice || !dice.values || !dice.values.length) return;
      showDiceValues(dice.values, dice.total);
    }

    function showYourTurnToast(){
      const el = $("your-turn-toast");
      if(!el) return;
      el.hidden = false;
      el.classList.remove("show");
      void el.offsetWidth;
      el.classList.add("show");
      clearTimeout(showYourTurnToast._timer);
      showYourTurnToast._timer = setTimeout(function(){
        el.classList.remove("show");
        setTimeout(function(){
          if(el) el.hidden = true;
        }, 350);
      }, 2200);
    }

    let prevCurrentPlayerId = null;

    function maybeNotifyMyTurn(){
      if(!you || !currentPlayerId){
        prevCurrentPlayerId = currentPlayerId;
        return;
      }
      const becameMyTurn = currentPlayerId === you.id && prevCurrentPlayerId !== you.id;
      prevCurrentPlayerId = currentPlayerId;
      if(!becameMyTurn) return;
      const me = findPlayer(players, you.id);
      if(me && (me.finished || (me.skipTurns || 0) > 0)) return;
      showYourTurnToast();
    }

    function completeMoveWithoutAnim(payload){
      const dice = payload.dice;
      const game = payload.game || (payload.room && payload.room.game);
      if(typeof skipDiceAnimation === "function") skipDiceAnimation();
      if(typeof cancelTokenAnimation === "function") cancelTokenAnimation();
      showFinalDice(dice);
      animating = false;
      activeMovePayload = null;
      const queued = queuedSync;
      queuedSync = null;
      // Toujours préférer l'état le plus récent (lettre validée / relancée pendant l'anim)
      if(queued && queued.room && queued.room.game){
        applyGameSnapshot(queued.room.game, queued.room);
      } else if(game){
        applyGameSnapshot(game, payload.room);
      }
      refreshUI();
    }

    function emit(event, payload){
      return new Promise(function(resolve, reject){
        const socket = window.gameSocket;
        if(!socket || !socket.connected){
          reject(new Error("Pas connecté au serveur"));
          return;
        }
        socket.timeout(8000).emit(event, payload || {}, function(err, response){
          if(err){
            reject(err);
            return;
          }
          resolve(response);
        });
      });
    }

    function showTurnMessage(text){
      const el = $("turn-msg");
      if(!el) return;
      if(!text){
        el.hidden = true;
        el.textContent = "";
        return;
      }
      el.hidden = false;
      el.textContent = text;
    }

    function ensureBoard(){
      if(boardReady) return;
      buildBoard();
      boardReady = true;
    }

    function updateRoomChrome(){
      const codeEl = $("game-room-code");
      if(codeEl) codeEl.textContent = roomCode || "—";
      const hostHint = $("host-drag-hint");
      if(hostHint) hostHint.hidden = !isHost;
    }

    function updateTurnUI(){
      const nameEl = $("turn-name");
      const swatchEl = $("turn-swatch");
      const nextBtn = $("next-turn-btn");
      const p = findPlayer(players, currentPlayerId);
      const myTurn = you && currentPlayerId === you.id;

      if(nameEl) nameEl.textContent = p ? p.name : "—";
      if(swatchEl){
        swatchEl.style.background = p ? p.color : "transparent";
        swatchEl.hidden = !p;
      }
      if(nextBtn) nextBtn.hidden = true;

      setDiceCount(diceCount, { preserveFaces: true });

      if(p){
        const banned = (p.skipTurns || 0) > 0;
        if(!myTurn){
          setDiceButtonLabel("Tour de " + p.name);
        } else if(banned){
          setDiceButtonLabel("Tour sauté (BAN)");
        } else {
          setDiceButtonLabel(
            (diceCount === 1 ? "Lancer le dé" : "Lancer les dés") + " — à toi !"
          );
        }
      } else {
        setDiceButtonLabel(null);
      }
      updateDiceModeUI();
    }

    function refreshUI(options){
      const opts = options || {};
      renderTokens(players, onTokenMoved, currentPlayerId, function(){
        return isHost && !animating && activePendingType == null;
      });
      renderPanel(players, {}, currentPlayerId, {
        readOnly: true,
        maxPlayers: 10,
      });
      updateTurnUI();
      updateRoomChrome();
      if(opts.lastDice) showFinalDice(opts.lastDice);
      if(opts.notifyTurn) maybeNotifyMyTurn();
    }

    function clonePlayers(list){
      return (list || []).map(function(p){
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          cell: p.cell || 0,
          skipTurns: p.skipTurns || 0,
          connected: p.connected !== false,
          isHost: !!p.isHost,
          finished: !!p.finished,
        };
      });
    }

    let lastVictoryKey = null;

    function applyGameSnapshot(game, room){
      if(!game) return;
      players = clonePlayers(game.players || (room && room.players) || []);
      currentPlayerId = game.currentPlayerId;
      diceCount = game.diceCount === 1 ? 1 : 2;
      showTurnMessage(game.message || "");
      refreshUI({
        lastDice: game.lastDice || null,
        notifyTurn: true,
      });
      handlePendingAction(game.pendingAction);
      showVictoryIfNeeded(game.lastVictory);
      if(typeof renderTurnHistory === "function"){
        renderTurnHistory(game.history || []);
      }
    }

    function showVictoryIfNeeded(victory){
      if(!victory || !victory.playerId) return;
      const key = String(victory.playerId) + ":" + String(victory.at || "");
      if(key === lastVictoryKey) return;
      lastVictoryKey = key;
      openVictoryModal(victory.winnerName, {
        onContinue: function(){
          // La partie continue déjà — on ferme juste la modal
        },
        onRestart: function(){
          if(!isHost) return;
          emit("restartGame", {}).then(function(response){
            lastVictoryKey = null;
            if(response && response.game){
              applyGameSnapshot(response.game, response.room);
            }
          }).catch(function(err){
            console.error(err);
          });
        },
      });
    }

    function letterPendingKey(pending){
      if(!pending || pending.type !== "letter") return null;
      return [
        pending.playerId || "",
        pending.at || "",
        pending.letter || "",
        pending.prompt || "",
      ].join(":");
    }

    function genrePendingKey(pending){
      if(!pending || pending.type !== "genre") return null;
      return [
        pending.playerId || "",
        pending.at || "",
        pending.genre || "",
        pending.prompt || "",
      ].join(":");
    }

    function mimePendingKey(pending){
      if(!pending || pending.type !== "mime") return null;
      return [
        pending.playerId || "",
        pending.at || "",
        pending.category || "",
        pending.prompt || "",
      ].join(":");
    }

    function racePendingKey(pending){
      if(!pending || pending.type !== "race") return null;
      return [
        pending.playerId || "",
        pending.at || "",
        pending.keyword || "",
      ].join(":");
    }

    function raceModalOptions(){
      return {
        players: players,
        youId: you && you.id,
        isHost: isHost,
      };
    }

    /** Ouvre / met à jour les modales pending même pendant une anim de pion. */
    function peekPendingFromRoom(roomOrGame){
      const game = roomOrGame && (roomOrGame.game || roomOrGame);
      if(!game) return;
      const pending = game.pendingAction;
      if(
        pending
        && (
          pending.type === "letter"
          || pending.type === "genre"
          || pending.type === "mime"
          || pending.type === "race"
        )
      ){
        handlePendingAction(pending);
        return;
      }
      if(
        (
          activePendingType === "letter"
          || activePendingType === "genre"
          || activePendingType === "mime"
          || activePendingType === "race"
        )
        && !letterConfirming
        && !genreConfirming
        && !mimeConfirming
        && !raceConfirming
      ){
        handlePendingAction(null);
      }
    }

    function hostRerollLetter(){
      if(!isHost || letterConfirming) return;
      const rollBtn = document.getElementById("letter-modal-roll");
      if(rollBtn) rollBtn.disabled = true;
      emit("rerollLetter", {}).then(function(response){
        if(response && response.ok === false){
          showTurnMessage(response.error || "Impossible de relancer");
          if(rollBtn) rollBtn.disabled = false;
          return;
        }
        if(response && response.game){
          peekPendingFromRoom(response.game);
        }
      }).catch(function(err){
        console.error(err);
        showTurnMessage(err.message || "Erreur relance");
        if(rollBtn) rollBtn.disabled = false;
      });
    }

    function hostRerollGenre(){
      if(!isHost || genreConfirming) return;
      const rollBtn = document.getElementById("genre-modal-roll");
      if(rollBtn) rollBtn.disabled = true;
      emit("rerollGenre", {}).then(function(response){
        if(response && response.ok === false){
          showTurnMessage(response.error || "Impossible de relancer");
          if(rollBtn) rollBtn.disabled = false;
          return;
        }
        if(response && response.game){
          peekPendingFromRoom(response.game);
        }
      }).catch(function(err){
        console.error(err);
        showTurnMessage(err.message || "Erreur relance");
        if(rollBtn) rollBtn.disabled = false;
      });
    }

    function hostRerollMime(){
      if(!isHost || mimeConfirming) return;
      const rollBtn = document.getElementById("genre-modal-roll");
      if(rollBtn) rollBtn.disabled = true;
      emit("rerollMime", {}).then(function(response){
        if(response && response.ok === false){
          showTurnMessage(response.error || "Impossible de relancer");
          if(rollBtn) rollBtn.disabled = false;
          return;
        }
        if(response && response.game){
          peekPendingFromRoom(response.game);
        }
      }).catch(function(err){
        console.error(err);
        showTurnMessage(err.message || "Erreur relance");
        if(rollBtn) rollBtn.disabled = false;
      });
    }

    function confirmLetterAction(){
      if(letterConfirming) return;
      letterConfirming = true;

      emit("confirmLetter", {}).then(function(response){
        letterConfirming = false;

        if(response && response.ok === false){
          showTurnMessage(response.error || "Impossible de valider la lettre");
          if(/attente/i.test(response.error || "")){
            lastLetterPending = null;
            currentLetterKey = null;
            activePendingType = null;
            dismissLetterModal();
            return;
          }
          activePendingType = null;
          if(lastLetterPending) handlePendingAction(lastLetterPending);
          return;
        }

        lastLetterPending = null;
        currentLetterKey = null;
        activePendingType = null;
        if(response && response.game){
          applyGameSnapshot(response.game, response.room);
        }
      }).catch(function(err){
        letterConfirming = false;
        console.error(err);
        showTurnMessage(err.message || "Erreur lettre");
        activePendingType = null;
        if(lastLetterPending) handlePendingAction(lastLetterPending);
      });
    }

    function confirmGenreAction(){
      if(genreConfirming) return;
      genreConfirming = true;

      emit("confirmGenre", {}).then(function(response){
        genreConfirming = false;

        if(response && response.ok === false){
          showTurnMessage(response.error || "Impossible de valider le genre");
          if(/attente/i.test(response.error || "")){
            lastGenrePending = null;
            currentGenreKey = null;
            activePendingType = null;
            dismissGenreModal();
            return;
          }
          activePendingType = null;
          if(lastGenrePending) handlePendingAction(lastGenrePending);
          return;
        }

        lastGenrePending = null;
        currentGenreKey = null;
        activePendingType = null;
        if(response && response.game){
          applyGameSnapshot(response.game, response.room);
        }
      }).catch(function(err){
        genreConfirming = false;
        console.error(err);
        showTurnMessage(err.message || "Erreur genre");
        activePendingType = null;
        if(lastGenrePending) handlePendingAction(lastGenrePending);
      });
    }

    function confirmMimeAction(){
      if(mimeConfirming) return;
      mimeConfirming = true;

      emit("confirmMime", {}).then(function(response){
        mimeConfirming = false;

        if(response && response.ok === false){
          showTurnMessage(response.error || "Impossible de valider le mime");
          if(/attente/i.test(response.error || "")){
            lastMimePending = null;
            currentMimeKey = null;
            activePendingType = null;
            dismissGenreModal();
            return;
          }
          activePendingType = null;
          if(lastMimePending) handlePendingAction(lastMimePending);
          return;
        }

        lastMimePending = null;
        currentMimeKey = null;
        activePendingType = null;
        if(response && response.game){
          applyGameSnapshot(response.game, response.room);
        }
      }).catch(function(err){
        mimeConfirming = false;
        console.error(err);
        showTurnMessage(err.message || "Erreur mime");
        activePendingType = null;
        if(lastMimePending) handlePendingAction(lastMimePending);
      });
    }

    function sendRaceChatMessage(text){
      return emit("raceChatMessage", { text: text }).then(function(response){
        if(response && response.ok === false){
          showTurnMessage(response.error || "Message refusé");
          throw new Error(response.error || "Message refusé");
        }
        if(response && response.game){
          peekPendingFromRoom(response.game);
        }
      });
    }

    function hostForceCloseRace(){
      if(!isHost || raceConfirming) return;
      emit("forceCloseRace", {}).then(function(response){
        if(response && response.ok === false){
          showTurnMessage(response.error || "Impossible de forcer la fin");
          return;
        }
        if(response && response.game){
          peekPendingFromRoom(response.game);
        }
      }).catch(function(err){
        console.error(err);
        showTurnMessage(err.message || "Erreur forcer fin");
      });
    }

    function confirmRaceAction(){
      if(raceConfirming) return;
      raceConfirming = true;

      emit("confirmRace", {}).then(function(response){
        raceConfirming = false;

        if(response && response.ok === false){
          showTurnMessage(response.error || "Impossible de valider le défi");
          if(/attente|terminé/i.test(response.error || "")){
            // défi pas encore fini : garder la modale
            activePendingType = null;
            if(lastRacePending) handlePendingAction(lastRacePending);
            return;
          }
          activePendingType = null;
          if(lastRacePending) handlePendingAction(lastRacePending);
          return;
        }

        lastRacePending = null;
        currentRaceKey = null;
        activePendingType = null;
        if(typeof dismissRaceModal === "function") dismissRaceModal();
        if(response && response.game){
          applyGameSnapshot(response.game, response.room);
        }
      }).catch(function(err){
        raceConfirming = false;
        console.error(err);
        showTurnMessage(err.message || "Erreur défi chat");
        activePendingType = null;
        if(lastRacePending) handlePendingAction(lastRacePending);
      });
    }

    function handlePendingAction(pending){
      if(!pending){
        letterConfirming = false;
        genreConfirming = false;
        mimeConfirming = false;
        raceConfirming = false;
        lastLetterPending = null;
        currentLetterKey = null;
        lastGenrePending = null;
        currentGenreKey = null;
        lastMimePending = null;
        currentMimeKey = null;
        lastRacePending = null;
        currentRaceKey = null;
        if(activePendingType === "letter") dismissLetterModal();
        if(activePendingType === "genre" || activePendingType === "mime"){
          dismissGenreModal();
        }
        if(activePendingType === "race" && typeof dismissRaceModal === "function"){
          dismissRaceModal();
        }
        activePendingType = null;
        return;
      }

      if(pending.type === "victory") return;

      if(pending.type === "letter"){
        if(letterConfirming) return;

        const key = letterPendingKey(pending);
        lastLetterPending = pending;

        if(activePendingType === "letter" && currentLetterKey === key) return;

        if(activePendingType === "letter" && currentLetterKey){
          const samePlayer = String(pending.playerId) === String(currentLetterKey.split(":")[0]);
          if(samePlayer){
            currentLetterKey = key;
            showTurnMessage("Lettre " + (pending.letter || "?") + " — valide avec OK pour continuer");
            if(typeof updateLetterModalLetter === "function"){
              updateLetterModalLetter(pending.letter, {
                showReroll: isHost,
                onReroll: hostRerollLetter,
              });
            }
            return;
          }
        }

        if(activePendingType === "genre" || activePendingType === "mime") dismissGenreModal();
        if(activePendingType === "race" && typeof dismissRaceModal === "function") dismissRaceModal();

        activePendingType = "letter";
        currentLetterKey = key;
        showTurnMessage("Lettre " + (pending.letter || "?") + " — valide avec OK pour continuer");
        openLetterModalWithLetter(
          pending.letter,
          confirmLetterAction,
          pending.prompt,
          {
            showReroll: isHost,
            onReroll: hostRerollLetter,
          }
        );
        return;
      }

      if(pending.type === "genre"){
        if(genreConfirming) return;

        const key = genrePendingKey(pending);
        lastGenrePending = pending;

        if(activePendingType === "genre" && currentGenreKey === key) return;

        if(activePendingType === "genre" && currentGenreKey){
          const samePlayer = String(pending.playerId) === String(currentGenreKey.split(":")[0]);
          if(samePlayer){
            currentGenreKey = key;
            showTurnMessage("Genre " + (pending.genre || "?") + " — valide avec OK pour continuer");
            if(typeof updateGenreModalGenre === "function"){
              updateGenreModalGenre(pending.genre, {
                showReroll: isHost,
                onReroll: hostRerollGenre,
                pickOptions: typeof GAME_GENRE_OPTIONS !== "undefined" ? GAME_GENRE_OPTIONS : null,
              });
            }
            return;
          }
        }

        if(activePendingType === "letter") dismissLetterModal();
        if(activePendingType === "race" && typeof dismissRaceModal === "function") dismissRaceModal();

        activePendingType = "genre";
        currentGenreKey = key;
        showTurnMessage("Genre " + (pending.genre || "?") + " — valide avec OK pour continuer");
        openGenreModalWithGenre(
          pending.genre,
          confirmGenreAction,
          pending.prompt,
          {
            showReroll: isHost,
            onReroll: hostRerollGenre,
            title: "Genre aléatoire",
            icon: "🎮",
            pickOptions: typeof GAME_GENRE_OPTIONS !== "undefined" ? GAME_GENRE_OPTIONS : null,
            promptDefault: "Cite 3 jeux du genre tiré :",
          }
        );
        return;
      }

      if(pending.type === "mime"){
        if(mimeConfirming) return;

        const key = mimePendingKey(pending);
        lastMimePending = pending;

        if(activePendingType === "mime" && currentMimeKey === key) return;

        if(activePendingType === "mime" && currentMimeKey){
          const samePlayer = String(pending.playerId) === String(currentMimeKey.split(":")[0]);
          if(samePlayer){
            currentMimeKey = key;
            showTurnMessage("Mime : " + (pending.category || "?") + " — valide avec OK pour continuer");
            if(typeof updateGenreModalGenre === "function"){
              updateGenreModalGenre(pending.category, {
                showReroll: isHost,
                onReroll: hostRerollMime,
                pickOptions: typeof MIME_CATEGORY_OPTIONS !== "undefined" ? MIME_CATEGORY_OPTIONS : null,
              });
            }
            return;
          }
        }

        if(activePendingType === "letter") dismissLetterModal();
        if(activePendingType === "race" && typeof dismissRaceModal === "function") dismissRaceModal();

        activePendingType = "mime";
        currentMimeKey = key;
        showTurnMessage("Mime : " + (pending.category || "?") + " — valide avec OK pour continuer");
        openGenreModalWithGenre(
          pending.category,
          confirmMimeAction,
          pending.prompt || "Mime un personnage du type tiré :",
          {
            showReroll: isHost,
            onReroll: hostRerollMime,
            title: "À mimer",
            icon: "🎭",
            pickOptions: typeof MIME_CATEGORY_OPTIONS !== "undefined" ? MIME_CATEGORY_OPTIONS : null,
            promptDefault: "Mime un personnage du type tiré :",
          }
        );
        return;
      }

      if(pending.type === "race"){
        if(raceConfirming) return;

        const key = racePendingKey(pending);
        lastRacePending = pending;
        const opts = raceModalOptions();
        const kw = pending.keyword || "GG";

        if(activePendingType === "race" && currentRaceKey === key){
          if(typeof updateRaceModal === "function") updateRaceModal(pending, opts);
          if(pending.resolved){
            const who = (pending.loserNames && pending.loserNames[0]) || "Quelqu'un";
            showTurnMessage(
              pending.loserNames && pending.loserNames.length > 1
                ? pending.loserNames.join(", ") + " boivent — OK pour continuer"
                : who + " boit — OK pour continuer"
            );
          }
          return;
        }

        if(activePendingType === "letter") dismissLetterModal();
        if(activePendingType === "genre" || activePendingType === "mime") dismissGenreModal();

        activePendingType = "race";
        currentRaceKey = key;
        showTurnMessage(
          pending.resolved
            ? ((pending.loserNames && pending.loserNames[0]) || "Quelqu'un") + " boit — OK pour continuer"
            : "Défi « " + kw + " » — le dernier à l'écrire boit"
        );
        if(typeof openRaceModal === "function"){
          openRaceModal(pending, {
            onConfirm: confirmRaceAction,
            onForce: hostForceCloseRace,
            onSend: sendRaceChatMessage,
          }, opts);
        }
        return;
      }

      if(pending.type === activePendingType) return;
    }

    function syncFromRoom(room, youData){
      if(!room || room.status !== "playing") return;

      ensureBoard();
      if(youData) you = youData;
      isHost = !!(you && room.hostId === you.id);
      roomCode = room.code || roomCode;

      const game = room.game;
      if(!game) return;

      if(animating){
        queuedSync = { room: room, you: you };
        return;
      }

      applyGameSnapshot(game, room);
      requestAnimationFrame(function(){
        fitBoard();
      });
    }

    function finishAnimation(){
      animating = false;
      const queued = queuedSync;
      queuedSync = null;
      if(queued) syncFromRoom(queued.room, queued.you || you);
      else refreshUI();
    }

    function playServerMove(payload){
      const dice = payload.dice;
      const move = payload.move;
      const game = payload.game || (payload.room && payload.room.game);

      if(payload.skippedBan){
        if(game) applyGameSnapshot(game, payload.room);
        return;
      }

      if(!move || !move.path || !move.path.length){
        if(game) applyGameSnapshot(game, payload.room);
        return;
      }

      const moveKey = [
        move.playerId,
        move.fromCell,
        move.toCell,
        dice && dice.total,
        (move.path || []).join("-"),
      ].join("|");

      if(moveKey === lastMoveKey){
        if(game) applyGameSnapshot(game, payload.room);
        return;
      }
      lastMoveKey = moveKey;

      // Onglet en arrière-plan : appliquer l'état final sans animation
      if(document.hidden){
        completeMoveWithoutAnim(payload);
        return;
      }

      animating = true;
      activeMovePayload = payload;
      queuedSync = { room: payload.room, you: you };

      // Pendant l'anim, partir de fromCell
      const moving = findPlayer(players, move.playerId);
      if(moving) moving.cell = move.fromCell || 0;
      refreshUI();

      function afterTokenAnim(){
        animating = false;
        activeMovePayload = null;
        const queued = queuedSync;
        queuedSync = null;
        // Préférer l'état le plus récent (pending lettre confirmée pendant l'anim)
        if(queued && queued.room && queued.room.game){
          applyGameSnapshot(queued.room.game, queued.room);
        } else if(game){
          applyGameSnapshot(game, payload.room);
        }
        refreshUI();
      }

      function runTokenAnim(){
        if(document.hidden){
          completeMoveWithoutAnim(payload);
          return;
        }
        const player = findPlayer(players, move.playerId);
        if(!player){
          finishAnimation();
          return;
        }
        animateTokenSteps(
          player,
          move.path,
          function(){ refreshUI(); },
          afterTokenAnim
        );
      }

      if(dice && dice.values){
        animateDiceResult(dice.values, function(){
          // Laisse le résultat visible un court instant avant le déplacement
          setTimeout(runTokenAnim, 450);
        });
      } else {
        runTokenAnim();
      }
    }

    function onTokenMoved(info){
      if(!isHost || !info){
        refreshUI();
        return;
      }
      emit("moveToken", {
        playerId: info.playerId,
        toCell: info.toCell,
      }).then(function(response){
        if(response && response.ok === false){
          showTurnMessage(response.error || "Déplacement refusé");
          if(window.gameLobby && window.gameLobby.getRoom()){
            syncFromRoom(window.gameLobby.getRoom(), you);
          }
          return;
        }
        if(response && response.game){
          applyGameSnapshot(response.game, response.room);
        }
      }).catch(function(err){
        showTurnMessage(err.message || "Erreur déplacement");
        refreshUI();
      });
    }

    function onRequestRoll(){
      if(animating || isDiceBusy()) return;
      if(!you || you.id !== currentPlayerId) return;
      emit("rollDice", {}).then(function(response){
        if(response && response.ok === false){
          showTurnMessage(response.error || "Lancer refusé");
          return;
        }
        // diceRolled broadcast gère l'anim pour tout le monde
      }).catch(function(err){
        showTurnMessage(err.message || "Erreur lancer");
      });
    }

    function onLeaveGame(){
      if(window.gameLobby && typeof window.gameLobby.leave === "function"){
        window.gameLobby.leave();
        return;
      }
      emit("leaveRoom", {}).catch(function(){});
    }

    // Init UI de base (plateau construit à l'entrée en partie)
    bindDice({
      lockDiceCount: true,
      canRoll: function(){
        return !animating
          && !!you
          && you.id === currentPlayerId
          && activePendingType == null
          && !isDiceBusy();
      },
      onRequestRoll: onRequestRoll,
    });

    const leaveBtn = $("game-leave-btn");
    if(leaveBtn) leaveBtn.addEventListener("click", onLeaveGame);

    // Masquer contrôles solo obsolètes
    ["start-btn", "reset-btn", "add-player-btn", "clear-players-btn", "next-turn-btn"].forEach(function(id){
      const el = $(id);
      if(el) el.hidden = true;
    });
    document.querySelectorAll(".dice-mode-btn").forEach(function(el){
      el.disabled = true;
    });

    window.addEventListener("resize", function(){
      if(boardReady) fitBoard();
    });

    document.addEventListener("visibilitychange", function(){
      if(!document.hidden) return;
      if(!animating || !activeMovePayload) return;
      completeMoveWithoutAnim(activeMovePayload);
    });

    const socket = window.gameSocket;
    if(socket){
      socket.on("diceRolled", function(payload){
        if(!payload) return;
        if(payload.room){
          isHost = !!(you && payload.room.hostId === you.id);
          roomCode = payload.room.code || roomCode;
        }
        playServerMove(payload);
        peekPendingFromRoom(payload.game || payload.room);
      });

      socket.on("gameUpdated", function(payload){
        if(!payload || !payload.room) return;
        if(payload.room.hostId && you){
          isHost = payload.room.hostId === you.id;
        }
        peekPendingFromRoom(payload.room);
        if(animating){
          queuedSync = { room: payload.room, you: you };
          return;
        }
        syncFromRoom(payload.room, you);
      });

      socket.on("letterRerolled", function(payload){
        if(!payload) return;
        if(payload.room && you){
          isHost = !!(payload.room.hostId === you.id);
        }
        peekPendingFromRoom(payload.game || payload.room);
      });

      socket.on("genreRerolled", function(payload){
        if(!payload) return;
        if(payload.room && you){
          isHost = !!(payload.room.hostId === you.id);
        }
        peekPendingFromRoom(payload.game || payload.room);
      });

      socket.on("mimeRerolled", function(payload){
        if(!payload) return;
        if(payload.room && you){
          isHost = !!(payload.room.hostId === you.id);
        }
        peekPendingFromRoom(payload.game || payload.room);
      });

      socket.on("gameRestarted", function(payload){
        activePendingType = null;
        letterConfirming = false;
        currentLetterKey = null;
        lastLetterPending = null;
        genreConfirming = false;
        currentGenreKey = null;
        lastGenrePending = null;
        mimeConfirming = false;
        currentMimeKey = null;
        lastMimePending = null;
        raceConfirming = false;
        currentRaceKey = null;
        lastRacePending = null;
        closeVictoryModal();
        dismissLetterModal();
        if(typeof dismissGenreModal === "function") dismissGenreModal();
        if(typeof dismissRaceModal === "function") dismissRaceModal();
        lastMoveKey = null;
        if(payload && payload.room) syncFromRoom(payload.room, you);
      });

      socket.on("gameStarted", function(payload){
        lastMoveKey = null;
        activePendingType = null;
        letterConfirming = false;
        currentLetterKey = null;
        lastLetterPending = null;
        genreConfirming = false;
        currentGenreKey = null;
        lastGenrePending = null;
        mimeConfirming = false;
        currentMimeKey = null;
        lastMimePending = null;
        raceConfirming = false;
        currentRaceKey = null;
        lastRacePending = null;
        if(typeof dismissRaceModal === "function") dismissRaceModal();
        if(payload && payload.room) syncFromRoom(payload.room, you);
      });
    }

    window.gameClient = {
      sync: function(room, youData){
        syncFromRoom(room, youData);
      },
      reset: function(){
        players = [];
        currentPlayerId = null;
        you = null;
        isHost = false;
        animating = false;
        queuedSync = null;
        lastMoveKey = null;
        lastVictoryKey = null;
        prevCurrentPlayerId = null;
        activePendingType = null;
        activeMovePayload = null;
        letterConfirming = false;
        currentLetterKey = null;
        lastLetterPending = null;
        genreConfirming = false;
        currentGenreKey = null;
        lastGenrePending = null;
        mimeConfirming = false;
        currentMimeKey = null;
        lastMimePending = null;
        raceConfirming = false;
        currentRaceKey = null;
        lastRacePending = null;
        closeVictoryModal();
        if(typeof dismissLetterModal === "function") dismissLetterModal();
        else closeLetterModal();
        if(typeof dismissGenreModal === "function") dismissGenreModal();
        if(typeof dismissRaceModal === "function") dismissRaceModal();
        if(typeof renderTurnHistory === "function") renderTurnHistory([]);
      },
    };
  }catch(err){
    console.error("Init multiplayer error:", err);
  }
})();
