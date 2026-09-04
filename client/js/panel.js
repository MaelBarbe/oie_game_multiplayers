function escapeHtml(str){
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function takenHuesForPlayer(players, playerId){
  const hues = [];
  players.forEach(function(p){
    if(p.id === playerId) return;
    hues.push(hexToHue(p.color));
  });
  return hues;
}

let colorPickerState = null;

function drawColorWheel(canvas, selectedHue, blockedHues){
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size / 2 - 2;
  const inner = outer * 0.42;

  ctx.clearRect(0, 0, size, size);

  for(let angle = 0; angle < 360; angle++){
    const start = (angle - 90) * Math.PI / 180;
    const end = (angle - 89.15) * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(cx, cy, (outer + inner) / 2, start, end);
    ctx.strokeStyle = colorFromHue(angle);
    ctx.lineWidth = outer - inner;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, inner - 1, 0, Math.PI * 2);
  ctx.fillStyle = "#16122f";
  ctx.fill();

  (blockedHues || []).forEach(function(h){
    const rad = (h - 90) * Math.PI / 180;
    const r0 = inner + 4;
    const r1 = outer - 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * r0, cy + Math.sin(rad) * r0);
    ctx.lineTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * r0, cy + Math.sin(rad) * r0);
    ctx.lineTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  if(typeof selectedHue === "number"){
    const rad = (selectedHue - 90) * Math.PI / 180;
    const rm = (outer + inner) / 2;
    const px = cx + Math.cos(rad) * rm;
    const py = cy + Math.sin(rad) * rm;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fillStyle = colorFromHue(selectedHue);
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, inner * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = colorFromHue(selectedHue || 0);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.stroke();
}

function hueFromPointer(canvas, clientX, clientY){
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left) * (canvas.width / rect.width) - canvas.width / 2;
  const y = (clientY - rect.top) * (canvas.height / rect.height) - canvas.height / 2;
  const dist = Math.sqrt(x * x + y * y);
  const outer = canvas.width / 2 - 2;
  const inner = outer * 0.42;
  if(dist < inner * 0.8 || dist > outer + 6) return null;
  let deg = Math.atan2(y, x) * 180 / Math.PI + 90;
  if(deg < 0) deg += 360;
  return deg;
}

function closeColorPicker(){
  const picker = document.getElementById("color-picker");
  if(picker) picker.hidden = true;
  colorPickerState = null;
}

function openColorPicker(playerId, players, onConfirm){
  const picker = document.getElementById("color-picker");
  const canvas = document.getElementById("color-wheel");
  const warn = document.getElementById("color-picker-warn");
  if(!picker || !canvas) return;

  const player = findPlayer(players, playerId);
  if(!player) return;

  colorPickerState = {
    playerId: playerId,
    hue: hexToHue(player.color),
    blocked: takenHuesForPlayer(players, playerId),
    onConfirm: onConfirm,
    dragging: false,
  };

  function redraw(){
    drawColorWheel(canvas, colorPickerState.hue, colorPickerState.blocked);
    const taken = colorPickerState.blocked.some(function(h){
      return hueDistance(h, colorPickerState.hue) < 18;
    });
    if(warn) warn.hidden = !taken;
    const okBtn = document.getElementById("color-picker-ok");
    if(okBtn) okBtn.disabled = taken;
  }

  function pickAt(clientX, clientY){
    const h = hueFromPointer(canvas, clientX, clientY);
    if(h == null) return;
    colorPickerState.hue = h;
    redraw();
  }

  canvas.onpointerdown = function(e){
    e.preventDefault();
    colorPickerState.dragging = true;
    canvas.setPointerCapture(e.pointerId);
    pickAt(e.clientX, e.clientY);
  };
  canvas.onpointermove = function(e){
    if(!colorPickerState || !colorPickerState.dragging) return;
    pickAt(e.clientX, e.clientY);
  };
  canvas.onpointerup = function(){
    if(colorPickerState) colorPickerState.dragging = false;
  };
  canvas.onpointercancel = function(){
    if(colorPickerState) colorPickerState.dragging = false;
  };

  picker.hidden = false;
  redraw();
}

function bindColorPicker(){
  const cancel = document.getElementById("color-picker-cancel");
  const ok = document.getElementById("color-picker-ok");
  const backdrop = document.getElementById("color-picker-backdrop");

  function confirm(){
    if(!colorPickerState) return;
    const taken = colorPickerState.blocked.some(function(h){
      return hueDistance(h, colorPickerState.hue) < 18;
    });
    if(taken) return;
    const color = colorFromHue(colorPickerState.hue);
    const cb = colorPickerState.onConfirm;
    closeColorPicker();
    if(cb) cb(color);
  }

  if(cancel) cancel.addEventListener("click", closeColorPicker);
  if(ok) ok.addEventListener("click", confirm);
  if(backdrop) backdrop.addEventListener("click", closeColorPicker);
}

function renderPanel(players, handlers, currentPlayerId, options){
  const opts = options || {};
  const readOnly = !!opts.readOnly;
  const maxPlayers = opts.maxPlayers || MAX_PLAYERS;
  const list = document.getElementById("players-list");
  const countEl = document.getElementById("player-count");
  const addBtn = document.getElementById("add-player-btn");
  const clearBtn = document.getElementById("clear-players-btn");
  if(!list) return;

  if(countEl) countEl.textContent = players.length + " / " + maxPlayers;
  if(addBtn){
    addBtn.hidden = readOnly;
    addBtn.disabled = readOnly || players.length >= maxPlayers;
  }
  if(clearBtn){
    clearBtn.hidden = readOnly;
    clearBtn.disabled = readOnly || players.length === 0;
  }

  list.innerHTML = "";

  players.forEach((p, index)=>{
    const banned = (p.skipTurns || 0) > 0;
    const active = p.id === currentPlayerId;
    const offline = p.connected === false;
    const finished = !!p.finished;
    const row = document.createElement("div");
    row.className = "player-row"
      + (banned ? " player-banned" : "")
      + (active ? " player-active" : "")
      + (offline ? " player-offline" : "")
      + (finished ? " player-finished" : "");
    row.setAttribute("role", "listitem");
    const statusText = finished
      ? "terminé"
      : (active ? "à jouer, " : "")
        + (banned ? "BAN, " : "")
        + (p.cell === 0 ? "hors jeu" : "case " + p.cell)
        + (offline ? ", hors ligne" : "");
    row.setAttribute(
      "aria-label",
      (index + 1) + ". " + p.name + (p.isHost ? ", hôte" : "") + " — " + statusText
    );
    row.innerHTML = `
      <span class="swatch" style="background:${p.color}" aria-hidden="true" title="${escapeHtml(p.name)}"></span>
      <span class="player-num" aria-hidden="true">${index + 1}</span>
      <div class="player-main">
        <div class="player-name-static">${escapeHtml(p.name)}${p.isHost ? " ★" : ""}${finished ? " 🏆" : ""}${offline ? " (hors ligne)" : ""}</div>
        <div class="player-status">
          <div class="pos">${
            finished
              ? "terminé"
              : (active ? "▶ " : "")
                + (banned ? "🚫 " : "")
                + (p.cell === 0 ? "hors jeu" : "case " + p.cell)
          }</div>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
}

/** Affiche l'historique des actions (plus récent en haut). */
function renderTurnHistory(history){
  const list = document.getElementById("turn-history");
  if(!list) return;

  const entries = Array.isArray(history) ? history.slice() : [];
  if(!entries.length){
    list.innerHTML = '<li class="history-empty">Aucun événement pour l\'instant</li>';
    return;
  }

  entries.reverse();
  list.innerHTML = "";
  entries.forEach(function(entry){
    const li = document.createElement("li");
    li.className = "history-item history-" + (entry.kind || "info");
    li.textContent = entry.text || "";
    if(entry.at){
      const time = new Date(entry.at);
      if(!Number.isNaN(time.getTime())){
        li.title = time.toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
    }
    list.appendChild(li);
  });
}

function bindPanelActions(handlers){
  const resetBtn = document.getElementById("reset-btn");
  const startBtn = document.getElementById("start-btn");
  const addBtn = document.getElementById("add-player-btn");
  const clearBtn = document.getElementById("clear-players-btn");

  if(startBtn){
    startBtn.addEventListener("click", function(){
      if(handlers.onStart) handlers.onStart();
    });
  }
  if(resetBtn){
    resetBtn.addEventListener("click", function(){
      openConfirmModal({
        title: "Retirer tous les pions ?",
        text: "Tous les pions retourneront sur le banc. Les positions et les BAN seront perdus.",
        icon: "↺",
        okLabel: "Tout retirer",
        okClass: "danger",
        onOk: function(){ handlers.onReset(); },
      });
    });
  }
  if(clearBtn){
    clearBtn.addEventListener("click", function(){
      if(clearBtn.disabled) return;
      openConfirmModal({
        title: "Retirer tous les joueurs ?",
        text: "La liste des joueurs sera vidée. Tu pourras ensuite en ajouter de nouveaux.",
        icon: "✕",
        okLabel: "Tout supprimer",
        okClass: "danger",
        onOk: function(){
          if(handlers.onClearPlayers) handlers.onClearPlayers();
        },
      });
    });
  }
  if(addBtn){
    addBtn.addEventListener("click", function(){
      handlers.onAdd();
    });
  }
  bindColorPicker();
  bindConfirmModal();
  bindVictoryModal();
  bindLetterModal();
  bindPlayerFormModal();
}

let confirmModalOnOk = null;

function openConfirmModal(options){
  const modal = document.getElementById("confirm-modal");
  if(!modal) return;

  const opts = (typeof options === "function")
    ? { onOk: options }
    : (options || {});

  const titleEl = document.getElementById("confirm-modal-title");
  const textEl = document.getElementById("confirm-modal-text");
  const iconEl = modal.querySelector(".confirm-modal-icon");
  const okBtn = document.getElementById("confirm-modal-ok");

  if(titleEl) titleEl.textContent = opts.title || "Confirmer ?";
  if(textEl) textEl.textContent = opts.text || "";
  if(iconEl) iconEl.textContent = opts.icon || "!";
  if(okBtn){
    okBtn.textContent = opts.okLabel || "Confirmer";
    okBtn.className = "confirm-modal-btn " + (opts.okClass || "danger");
  }

  confirmModalOnOk = opts.onOk || null;
  modal.hidden = false;
  if(okBtn) okBtn.focus();
}

function closeConfirmModal(){
  const modal = document.getElementById("confirm-modal");
  if(modal) modal.hidden = true;
  confirmModalOnOk = null;
}

function bindConfirmModal(){
  const modal = document.getElementById("confirm-modal");
  const cancel = document.getElementById("confirm-modal-cancel");
  const ok = document.getElementById("confirm-modal-ok");
  const backdrop = document.getElementById("confirm-modal-backdrop");
  if(!modal) return;

  function confirm(){
    const cb = confirmModalOnOk;
    closeConfirmModal();
    if(cb) cb();
  }

  if(cancel) cancel.addEventListener("click", closeConfirmModal);
  if(backdrop) backdrop.addEventListener("click", closeConfirmModal);
  if(ok) ok.addEventListener("click", confirm);

  document.addEventListener("keydown", function(e){
    if(modal.hidden) return;
    if(e.key === "Escape"){
      e.preventDefault();
      closeConfirmModal();
    } else if(e.key === "Enter"){
      e.preventDefault();
      confirm();
    }
  });
}

let victoryModalHandlers = null;

function openVictoryModal(winnerName, handlers){
  const modal = document.getElementById("victory-modal");
  const text = document.getElementById("victory-modal-text");
  if(!modal) return;
  victoryModalHandlers = handlers || null;
  if(text){
    text.textContent = (winnerName || "Un joueur")
      + " a gagné ! Il sort des tours — la partie continue pour les autres.";
  }
  modal.hidden = false;
  const continueBtn = document.getElementById("victory-modal-continue");
  if(continueBtn){
    continueBtn.textContent = "OK";
    continueBtn.focus();
  }
}

function closeVictoryModal(){
  const modal = document.getElementById("victory-modal");
  if(modal) modal.hidden = true;
  victoryModalHandlers = null;
}

function bindVictoryModal(){
  const modal = document.getElementById("victory-modal");
  const continueBtn = document.getElementById("victory-modal-continue");
  const restartBtn = document.getElementById("victory-modal-restart");
  const backdrop = document.getElementById("victory-modal-backdrop");
  if(!modal) return;

  function continueGame(){
    const handlers = victoryModalHandlers;
    closeVictoryModal();
    if(handlers && handlers.onContinue) handlers.onContinue();
  }

  function restartGame(){
    const handlers = victoryModalHandlers;
    closeVictoryModal();
    if(handlers && handlers.onRestart) handlers.onRestart();
  }

  if(continueBtn) continueBtn.addEventListener("click", continueGame);
  if(restartBtn) restartBtn.addEventListener("click", restartGame);
  if(backdrop) backdrop.addEventListener("click", continueGame);

  document.addEventListener("keydown", function(e){
    if(modal.hidden) return;
    if(e.key === "Escape"){
      e.preventDefault();
      continueGame();
    }
  });
}

const LETTER_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let letterModalOnClose = null;
let letterModalOnReroll = null;
let letterRollTimer = null;
let letterRolling = false;

function randomLetter(){
  return LETTER_ALPHABET.charAt(Math.floor(Math.random() * LETTER_ALPHABET.length));
}

function setLetterDisplay(letter, rolling){
  const el = document.getElementById("letter-display");
  if(!el) return;
  el.textContent = letter || "?";
  el.classList.toggle("rolling", !!rolling);
}

function animateLetterReveal(letter, onDone){
  const modal = document.getElementById("letter-modal");
  const rollBtn = document.getElementById("letter-modal-roll");
  const okBtn = document.getElementById("letter-modal-ok");

  function revealFinal(){
    if(letterRollTimer){
      clearInterval(letterRollTimer);
      letterRollTimer = null;
    }
    setLetterDisplay(letter || "?", false);
    letterRolling = false;
    if(rollBtn && !rollBtn.hidden) rollBtn.disabled = false;
    if(okBtn){
      okBtn.disabled = false;
      okBtn.focus();
    }
    if(typeof onDone === "function") onDone();
  }

  if(okBtn) okBtn.disabled = true;
  if(rollBtn && !rollBtn.hidden) rollBtn.disabled = true;

  if(document.hidden){
    revealFinal();
    return;
  }

  let ticks = 0;
  if(letterRollTimer) clearInterval(letterRollTimer);
  letterRolling = true;
  letterRollTimer = setInterval(function(){
    if(document.hidden){
      revealFinal();
      return;
    }
    ticks++;
    setLetterDisplay(randomLetter(), true);
    if(ticks >= 14) revealFinal();
  }, 55);

  setTimeout(function(){
    if(!modal || modal.hidden) return;
    if(okBtn && okBtn.disabled) revealFinal();
  }, 1500);
}

function openLetterModal(onClose, promptText){
  const modal = document.getElementById("letter-modal");
  const promptEl = document.getElementById("letter-modal-prompt");
  if(!modal) return;
  letterModalOnClose = onClose || null;
  letterModalOnReroll = null;
  letterRolling = false;
  setLetterDisplay("?", false);
  if(promptEl){
    promptEl.textContent = promptText
      || "Cite 3 choses qui commencent par la lettre :";
  }
  const rollBtn = document.getElementById("letter-modal-roll");
  if(rollBtn){
    rollBtn.hidden = false;
    rollBtn.disabled = false;
    rollBtn.textContent = "Tirer une lettre";
  }
  modal.hidden = false;
  if(rollBtn) rollBtn.focus();
}

/**
 * Affiche une lettre déjà choisie par le serveur (avec petite anim).
 * options: { showReroll, onReroll }
 */
function openLetterModalWithLetter(letter, onClose, promptText, options){
  const modal = document.getElementById("letter-modal");
  const promptEl = document.getElementById("letter-modal-prompt");
  const rollBtn = document.getElementById("letter-modal-roll");
  const okBtn = document.getElementById("letter-modal-ok");
  if(!modal) return;

  options = options || {};
  letterModalOnClose = onClose || null;
  letterModalOnReroll = typeof options.onReroll === "function" ? options.onReroll : null;

  if(promptEl){
    promptEl.textContent = promptText
      || "Cite 3 choses qui commencent par la lettre :";
  }
  if(rollBtn){
    rollBtn.hidden = !options.showReroll;
    rollBtn.disabled = false;
    rollBtn.textContent = "Relancer";
  }
  if(okBtn){
    okBtn.hidden = false;
    okBtn.textContent = "OK — continuer";
  }
  modal.hidden = false;
  animateLetterReveal(letter);
}

/** Met à jour la lettre affichée (ex. après relance hôte). */
function updateLetterModalLetter(letter, options){
  const modal = document.getElementById("letter-modal");
  const rollBtn = document.getElementById("letter-modal-roll");
  if(!modal || modal.hidden) return;
  options = options || {};
  if(rollBtn){
    rollBtn.hidden = !options.showReroll;
    rollBtn.textContent = "Relancer";
  }
  if(typeof options.onReroll === "function"){
    letterModalOnReroll = options.onReroll;
  }
  animateLetterReveal(letter);
}

function closeLetterModal(){
  const modal = document.getElementById("letter-modal");
  if(letterRollTimer){
    clearInterval(letterRollTimer);
    letterRollTimer = null;
  }
  letterRolling = false;
  if(modal) modal.hidden = true;
  const cb = letterModalOnClose;
  letterModalOnClose = null;
  letterModalOnReroll = null;
  if(cb) cb();
}

/** Ferme la modal lettre sans déclencher le callback (sync serveur). */
function dismissLetterModal(){
  letterModalOnClose = null;
  letterModalOnReroll = null;
  closeLetterModal();
}

function rollLetterAnimation(){
  if(letterRolling) return;
  const rollBtn = document.getElementById("letter-modal-roll");
  const okBtn = document.getElementById("letter-modal-ok");
  letterRolling = true;
  if(rollBtn){
    rollBtn.disabled = true;
    rollBtn.textContent = "…";
  }
  if(okBtn) okBtn.disabled = true;

  let ticks = 0;
  if(letterRollTimer) clearInterval(letterRollTimer);
  letterRollTimer = setInterval(function(){
    ticks++;
    setLetterDisplay(randomLetter(), true);
    if(ticks >= 14){
      clearInterval(letterRollTimer);
      letterRollTimer = null;
      const finalLetter = randomLetter();
      setLetterDisplay(finalLetter, false);
      letterRolling = false;
      if(rollBtn){
        rollBtn.disabled = false;
        rollBtn.textContent = "Relancer";
      }
      if(okBtn) okBtn.disabled = false;
    }
  }, 55);
}

function bindLetterModal(){
  const modal = document.getElementById("letter-modal");
  const rollBtn = document.getElementById("letter-modal-roll");
  const okBtn = document.getElementById("letter-modal-ok");
  const backdrop = document.getElementById("letter-modal-backdrop");
  if(!modal) return;

  if(rollBtn) rollBtn.addEventListener("click", function(){
    if(letterRolling) return;
    if(typeof letterModalOnReroll === "function"){
      letterModalOnReroll();
      return;
    }
    rollLetterAnimation();
  });
  if(okBtn) okBtn.addEventListener("click", closeLetterModal);
  if(backdrop) backdrop.addEventListener("click", function(){
    if(letterRolling) return;
    closeLetterModal();
  });

  document.addEventListener("keydown", function(e){
    if(modal.hidden) return;
    if(e.key === "Escape" && !letterRolling){
      e.preventDefault();
      closeLetterModal();
    }
  });
}

const GAME_GENRE_OPTIONS = ["FPS", "MMO", "Survival", "RTS", "Nintendo", "Jeux mobiles"];
const MIME_CATEGORY_OPTIONS = [
  "Princesse Disney",
  "Méchant Disney",
  "Perso Marvel",
  "Champion LoL",
  "Agent Valorant",
  "Personne connue",
];

let genreModalOnClose = null;
let genreModalOnReroll = null;
let genreRollTimer = null;
let genreRolling = false;
let activeShuffleOptions = GAME_GENRE_OPTIONS;

function randomShuffleOption(){
  const list = activeShuffleOptions && activeShuffleOptions.length
    ? activeShuffleOptions
    : GAME_GENRE_OPTIONS;
  return list[Math.floor(Math.random() * list.length)];
}

function setGenreDisplay(genre, rolling){
  const el = document.getElementById("genre-display");
  if(!el) return;
  el.textContent = genre || "?";
  el.classList.toggle("rolling", !!rolling);
}

function animateGenreReveal(genre, onDone){
  const modal = document.getElementById("genre-modal");
  const rollBtn = document.getElementById("genre-modal-roll");
  const okBtn = document.getElementById("genre-modal-ok");

  function revealFinal(){
    if(genreRollTimer){
      clearInterval(genreRollTimer);
      genreRollTimer = null;
    }
    setGenreDisplay(genre || "?", false);
    genreRolling = false;
    if(rollBtn && !rollBtn.hidden) rollBtn.disabled = false;
    if(okBtn){
      okBtn.disabled = false;
      okBtn.focus();
    }
    if(typeof onDone === "function") onDone();
  }

  if(okBtn) okBtn.disabled = true;
  if(rollBtn && !rollBtn.hidden) rollBtn.disabled = true;

  if(document.hidden){
    revealFinal();
    return;
  }

  let ticks = 0;
  if(genreRollTimer) clearInterval(genreRollTimer);
  genreRolling = true;
  genreRollTimer = setInterval(function(){
    if(document.hidden){
      revealFinal();
      return;
    }
    ticks++;
    setGenreDisplay(randomShuffleOption(), true);
    if(ticks >= 14) revealFinal();
  }, 55);

  setTimeout(function(){
    if(!modal || modal.hidden) return;
    if(okBtn && okBtn.disabled) revealFinal();
  }, 1500);
}

/**
 * Modal de tirage (genres de jeux ou catégories mime).
 * options: { showReroll, onReroll, pickOptions, title, icon }
 */
function openGenreModalWithGenre(genre, onClose, promptText, options){
  const modal = document.getElementById("genre-modal");
  const promptEl = document.getElementById("genre-modal-prompt");
  const titleEl = document.getElementById("genre-modal-title");
  const iconEl = modal && modal.querySelector(".genre-icon");
  const rollBtn = document.getElementById("genre-modal-roll");
  const okBtn = document.getElementById("genre-modal-ok");
  if(!modal) return;

  options = options || {};
  genreModalOnClose = onClose || null;
  genreModalOnReroll = typeof options.onReroll === "function" ? options.onReroll : null;
  activeShuffleOptions = (options.pickOptions && options.pickOptions.length)
    ? options.pickOptions
    : GAME_GENRE_OPTIONS;

  if(titleEl) titleEl.textContent = options.title || "Genre aléatoire";
  if(iconEl) iconEl.textContent = options.icon || "🎮";
  if(promptEl){
    promptEl.textContent = promptText
      || (options.promptDefault || "Cite 3 jeux du genre tiré :");
  }
  if(rollBtn){
    rollBtn.hidden = !options.showReroll;
    rollBtn.disabled = false;
    rollBtn.textContent = "Relancer";
  }
  if(okBtn){
    okBtn.hidden = false;
    okBtn.textContent = "OK — continuer";
  }

  modal.hidden = false;
  animateGenreReveal(genre);
}

function updateGenreModalGenre(genre, options){
  const modal = document.getElementById("genre-modal");
  const rollBtn = document.getElementById("genre-modal-roll");
  if(!modal || modal.hidden) return;
  options = options || {};
  if(options.pickOptions && options.pickOptions.length){
    activeShuffleOptions = options.pickOptions;
  }
  if(rollBtn){
    rollBtn.hidden = !options.showReroll;
    rollBtn.textContent = "Relancer";
  }
  if(typeof options.onReroll === "function"){
    genreModalOnReroll = options.onReroll;
  }
  animateGenreReveal(genre);
}

function closeGenreModal(){
  const modal = document.getElementById("genre-modal");
  if(genreRollTimer){
    clearInterval(genreRollTimer);
    genreRollTimer = null;
  }
  genreRolling = false;
  if(modal) modal.hidden = true;
  const cb = genreModalOnClose;
  genreModalOnClose = null;
  genreModalOnReroll = null;
  if(cb) cb();
}

function dismissGenreModal(){
  genreModalOnClose = null;
  genreModalOnReroll = null;
  closeGenreModal();
}

function bindGenreModal(){
  const modal = document.getElementById("genre-modal");
  const rollBtn = document.getElementById("genre-modal-roll");
  const okBtn = document.getElementById("genre-modal-ok");
  const backdrop = document.getElementById("genre-modal-backdrop");
  if(!modal) return;

  if(rollBtn) rollBtn.addEventListener("click", function(){
    if(genreRolling) return;
    if(typeof genreModalOnReroll === "function"){
      genreModalOnReroll();
    }
  });
  if(okBtn) okBtn.addEventListener("click", function(){
    if(genreRolling) return;
    closeGenreModal();
  });
  if(backdrop) backdrop.addEventListener("click", function(){
    if(genreRolling) return;
    closeGenreModal();
  });

  document.addEventListener("keydown", function(e){
    if(modal.hidden) return;
    if(e.key === "Escape" && !genreRolling){
      e.preventDefault();
      closeGenreModal();
    }
  });
}

let raceModalOnConfirm = null;
let raceModalOnForce = null;
let raceModalOnSend = null;
let raceSending = false;
let lastRaceRenderKey = null;

function escapeRaceHtml(str){
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRaceModal(pending, options){
  const modal = document.getElementById("race-modal");
  const log = document.getElementById("race-chat-log");
  const roster = document.getElementById("race-roster");
  const promptEl = document.getElementById("race-modal-prompt");
  const badge = document.getElementById("race-keyword-badge");
  const resultEl = document.getElementById("race-result");
  const okBtn = document.getElementById("race-modal-ok");
  const forceBtn = document.getElementById("race-modal-force");
  const input = document.getElementById("race-chat-input");
  const sendBtn = document.getElementById("race-chat-send");
  if(!modal || !pending || pending.type !== "race") return;

  options = options || {};
  const players = options.players || [];
  const youId = options.youId || null;
  const isHost = !!options.isHost;

  if(promptEl){
    promptEl.textContent = pending.prompt
      || ("Le dernier à écrire « " + (pending.keyword || "GG") + " » boit");
  }
  if(badge) badge.textContent = pending.keyword || "GG";

  const submitted = pending.submitted || {};
  const eligibleIds = pending.eligibleIds || [];
  if(roster){
    roster.innerHTML = "";
    eligibleIds.forEach(function(id){
      const p = players.find(function(x){ return String(x.id) === String(id); });
      const li = document.createElement("li");
      const done = submitted[id] != null;
      li.className = "race-roster-item" + (done ? " done" : "");
      li.innerHTML =
        '<span class="race-roster-dot" style="background:' + escapeRaceHtml((p && p.color) || "#94a3b8") + '"></span>' +
        '<span>' + escapeRaceHtml((p && p.name) || "Joueur") +
        (youId && String(id) === String(youId) ? " (toi)" : "") +
        (!p || p.connected === false ? " · offline" : "") +
        "</span>";
      roster.appendChild(li);
    });
  }

  if(log){
    const msgs = pending.messages || [];
    const key = msgs.length + ":" + (msgs.length ? msgs[msgs.length - 1].id : "") + ":" + !!pending.resolved;
    const shouldStick = log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
    if(key !== lastRaceRenderKey){
      lastRaceRenderKey = key;
      log.innerHTML = "";
      msgs.forEach(function(m){
        const line = document.createElement("div");
        line.className = "race-chat-line" + (m.isKeyword ? " is-keyword" : "");
        line.innerHTML =
          '<span class="race-chat-name" style="color:' + escapeRaceHtml(m.color || "#c4b5fd") + '">' +
          escapeRaceHtml(m.name || "?") +
          '</span><span class="race-chat-text">' +
          escapeRaceHtml(m.text || "") +
          "</span>";
        log.appendChild(line);
      });
      if(shouldStick || msgs.length <= 12){
        log.scrollTop = log.scrollHeight;
      }
    }
  }

  const resolved = !!pending.resolved;
  if(resultEl){
    if(resolved){
      resultEl.hidden = false;
      if(pending.loserNames && pending.loserNames.length === 1){
        resultEl.textContent = pending.loserNames[0] + " boit !";
      } else if(pending.loserNames && pending.loserNames.length > 1){
        resultEl.textContent = pending.loserNames.join(", ") + " boivent !";
      } else {
        resultEl.textContent = "Défi terminé";
      }
    } else {
      resultEl.hidden = true;
      resultEl.textContent = "";
    }
  }

  if(okBtn){
    okBtn.hidden = !resolved;
    okBtn.disabled = !resolved;
  }
  if(forceBtn){
    forceBtn.hidden = !isHost || resolved;
  }
  if(input){
    input.disabled = resolved || raceSending;
    input.placeholder = resolved
      ? "Défi terminé"
      : "Écris « " + (pending.keyword || "GG") + " » ou un message…";
  }
  if(sendBtn) sendBtn.disabled = resolved || raceSending;

  modal.hidden = false;
  if(!resolved && input && document.activeElement !== input){
    // don't steal focus every sync if already typing
    if(!input.value) input.focus();
  }
}

function openRaceModal(pending, handlers, options){
  raceModalOnConfirm = handlers && handlers.onConfirm || null;
  raceModalOnForce = handlers && handlers.onForce || null;
  raceModalOnSend = handlers && handlers.onSend || null;
  lastRaceRenderKey = null;
  renderRaceModal(pending, options);
}

function updateRaceModal(pending, options){
  const modal = document.getElementById("race-modal");
  if(!modal || modal.hidden){
    openRaceModal(pending, {
      onConfirm: raceModalOnConfirm,
      onForce: raceModalOnForce,
      onSend: raceModalOnSend,
    }, options);
    return;
  }
  renderRaceModal(pending, options);
}

function closeRaceModal(){
  const modal = document.getElementById("race-modal");
  if(modal) modal.hidden = true;
  raceModalOnConfirm = null;
  raceModalOnForce = null;
  raceModalOnSend = null;
  lastRaceRenderKey = null;
  raceSending = false;
}

function dismissRaceModal(){
  closeRaceModal();
}

function bindRaceModal(){
  const modal = document.getElementById("race-modal");
  const form = document.getElementById("race-chat-form");
  const input = document.getElementById("race-chat-input");
  const okBtn = document.getElementById("race-modal-ok");
  const forceBtn = document.getElementById("race-modal-force");
  if(!modal) return;

  if(form) form.addEventListener("submit", function(e){
    e.preventDefault();
    if(raceSending) return;
    const text = input ? input.value : "";
    if(!String(text || "").trim()) return;
    if(typeof raceModalOnSend !== "function") return;
    raceSending = true;
    if(input) input.disabled = true;
    Promise.resolve(raceModalOnSend(text)).then(function(){
      raceSending = false;
      if(input){
        input.value = "";
        input.disabled = false;
        input.focus();
      }
    }).catch(function(){
      raceSending = false;
      if(input) input.disabled = false;
    });
  });

  if(okBtn) okBtn.addEventListener("click", function(){
    if(typeof raceModalOnConfirm === "function") raceModalOnConfirm();
  });
  if(forceBtn) forceBtn.addEventListener("click", function(){
    if(typeof raceModalOnForce === "function") raceModalOnForce();
  });
}

let playerFormState = null;

function takenHuesAll(players){
  return players.map(function(p){ return hexToHue(p.color); });
}

function redrawPlayerFormWheel(){
  if(!playerFormState) return;
  const canvas = document.getElementById("player-form-wheel");
  const warn = document.getElementById("player-form-warn");
  const okBtn = document.getElementById("player-form-ok");
  if(!canvas) return;

  drawColorWheel(canvas, playerFormState.hue, playerFormState.blocked);
  const taken = playerFormState.blocked.some(function(h){
    return hueDistance(h, playerFormState.hue) < 18;
  });
  if(warn) warn.hidden = !taken;
  if(okBtn) okBtn.disabled = taken;
}

function openPlayerFormModal(players, onConfirm){
  const modal = document.getElementById("player-form-modal");
  const canvas = document.getElementById("player-form-wheel");
  const nameInput = document.getElementById("player-form-name");
  if(!modal || !canvas || !nameInput) return;
  if(players.length >= MAX_PLAYERS) return;

  const suggested = pickUniqueColor(players);
  playerFormState = {
    hue: hexToHue(suggested),
    blocked: takenHuesAll(players),
    onConfirm: onConfirm,
    dragging: false,
  };

  nameInput.value = "";
  nameInput.placeholder = "Joueur " + (players.length + 1);

  canvas.onpointerdown = function(e){
    e.preventDefault();
    if(!playerFormState) return;
    playerFormState.dragging = true;
    canvas.setPointerCapture(e.pointerId);
    const h = hueFromPointer(canvas, e.clientX, e.clientY);
    if(h != null){
      playerFormState.hue = h;
      redrawPlayerFormWheel();
    }
  };
  canvas.onpointermove = function(e){
    if(!playerFormState || !playerFormState.dragging) return;
    const h = hueFromPointer(canvas, e.clientX, e.clientY);
    if(h != null){
      playerFormState.hue = h;
      redrawPlayerFormWheel();
    }
  };
  canvas.onpointerup = function(){
    if(playerFormState) playerFormState.dragging = false;
  };
  canvas.onpointercancel = function(){
    if(playerFormState) playerFormState.dragging = false;
  };

  modal.hidden = false;
  redrawPlayerFormWheel();
  setTimeout(function(){ nameInput.focus(); }, 50);
}

function closePlayerFormModal(){
  const modal = document.getElementById("player-form-modal");
  if(modal) modal.hidden = true;
  playerFormState = null;
}

function bindPlayerFormModal(){
  const modal = document.getElementById("player-form-modal");
  const cancel = document.getElementById("player-form-cancel");
  const ok = document.getElementById("player-form-ok");
  const backdrop = document.getElementById("player-form-backdrop");
  const nameInput = document.getElementById("player-form-name");
  if(!modal) return;

  function confirm(){
    if(!playerFormState) return;
    const taken = playerFormState.blocked.some(function(h){
      return hueDistance(h, playerFormState.hue) < 18;
    });
    if(taken) return;

    const raw = nameInput ? nameInput.value.trim() : "";
    const name = raw || (nameInput && nameInput.placeholder) || "Joueur";
    const color = colorFromHue(playerFormState.hue);
    const cb = playerFormState.onConfirm;
    closePlayerFormModal();
    if(cb) cb({ name: name, color: color });
  }

  if(cancel) cancel.addEventListener("click", closePlayerFormModal);
  if(backdrop) backdrop.addEventListener("click", closePlayerFormModal);
  if(ok) ok.addEventListener("click", confirm);
  if(nameInput){
    nameInput.addEventListener("keydown", function(e){
      if(e.key === "Enter"){
        e.preventDefault();
        confirm();
      }
    });
  }

  document.addEventListener("keydown", function(e){
    if(modal.hidden) return;
    if(e.key === "Escape"){
      e.preventDefault();
      closePlayerFormModal();
    }
  });
}

// Bind des modales (utilisées en multijoueur sans bindPanelActions)
bindColorPicker();
bindConfirmModal();
bindVictoryModal();
bindLetterModal();
bindGenreModal();
bindRaceModal();
bindPlayerFormModal();
