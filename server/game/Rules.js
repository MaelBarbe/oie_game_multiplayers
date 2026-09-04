const { MAX_CELL, cellCategory, cellPrompt, cellKeyword } = require("../data/boardData");

function cellsToTraverse(fromCell, steps) {
  const max = MAX_CELL;
  const path = [];
  let pos = Math.max(0, fromCell || 0);
  let dir = 1;
  const n = Math.max(0, Math.floor(steps));

  for (let i = 0; i < n; i++) {
    if (pos <= 0) {
      pos = 1;
      dir = 1;
    } else {
      let next = pos + dir;
      if (next > max) {
        dir = -1;
        next = pos + dir;
      } else if (next < 1) {
        dir = 1;
        next = pos + dir;
      }
      pos = next;
    }
    path.push(pos);
  }
  return path;
}

function destinationAfter(fromCell, steps) {
  const path = cellsToTraverse(fromCell, Math.abs(steps));
  if (!path.length) return Math.max(0, fromCell || 0);
  if (steps >= 0) return path[path.length - 1];
  return Math.max(1, (fromCell || 1) + steps);
}

/**
 * Effets de case après arrêt (BAN, LAG, avance/recul, Aegis, lettre, victoire).
 */
function resolveLandingEffects(player) {
  const notes = [];
  let extraTurn = false;
  let guard = 0;

  while (guard++ < 6) {
    const cell = player.cell;
    const cat = cellCategory(cell);

    if (cat === "ban") {
      player.skipTurns = 1;
      notes.push("BAN — passera le prochain tour");
      break;
    }

    if (cat === "lag") {
      player.cell = 24;
      notes.push("LAG → case 24");
      continue;
    }

    if (cell === 12) {
      player.cell = destinationAfter(cell, 3);
      notes.push("Avance de 3 → case " + player.cell);
      continue;
    }

    if (cell === 29) {
      player.cell = Math.max(1, cell - 3);
      notes.push("Recule de 3 → case " + player.cell);
      continue;
    }

    if (cat === "aegis") {
      extraTurn = true;
      notes.push("Aegis — rejoue");
      break;
    }

    if (cat === "letter") {
      notes.push("Tire une lettre");
      return {
        extraTurn: false,
        notes: notes,
        victory: false,
        letterPick: true,
        genrePick: false,
        mimePick: false,
        racePick: false,
        prompt: cellPrompt(cell),
      };
    }

    if (cat === "genre") {
      notes.push("Tire un genre");
      return {
        extraTurn: false,
        notes: notes,
        victory: false,
        letterPick: false,
        genrePick: true,
        mimePick: false,
        racePick: false,
        prompt: cellPrompt(cell),
      };
    }

    if (cat === "imitate") {
      notes.push("Tire un type à mimer");
      return {
        extraTurn: false,
        notes: notes,
        victory: false,
        letterPick: false,
        genrePick: false,
        mimePick: true,
        racePick: false,
        prompt: cellPrompt(cell),
      };
    }

    if (cat === "race") {
      notes.push("Défi chat");
      return {
        extraTurn: false,
        notes: notes,
        victory: false,
        letterPick: false,
        genrePick: false,
        mimePick: false,
        racePick: true,
        prompt: cellPrompt(cell),
        keyword: cellKeyword(cell) || "GG",
      };
    }

    if (cat === "victory") {
      notes.push("Victoire !");
      return {
        extraTurn: false,
        notes: notes,
        victory: true,
        letterPick: false,
        genrePick: false,
        mimePick: false,
        racePick: false,
      };
    }

    break;
  }

  return {
    extraTurn: extraTurn,
    notes: notes,
    victory: false,
    letterPick: false,
    genrePick: false,
    mimePick: false,
    racePick: false,
  };
}

function playerIndexById(players, id) {
  for (let i = 0; i < players.length; i++) {
    if (players[i].id === id) return i;
  }
  return -1;
}

/**
 * Passe au joueur suivant.
 * - terminé (victoire) : sauté
 * - BAN : consomme le skip
 * - déconnecté : saute sans consommer le BAN
 */
function advanceToNextPlayer(players, currentId) {
  if (!players.length) return { currentId: null, skipped: [] };

  let idx = playerIndexById(players, currentId);
  if (idx < 0) idx = 0;
  else idx = (idx + 1) % players.length;

  const skipped = [];
  const start = idx;
  do {
    const p = players[idx];
    if (p.finished) {
      skipped.push({ id: p.id, name: p.name, reason: "finished" });
      idx = (idx + 1) % players.length;
      continue;
    }
    if (!p.connected) {
      skipped.push({ id: p.id, name: p.name, reason: "offline" });
      idx = (idx + 1) % players.length;
      continue;
    }
    if ((p.skipTurns || 0) > 0) {
      p.skipTurns = 0;
      skipped.push({ id: p.id, name: p.name, reason: "ban" });
      idx = (idx + 1) % players.length;
      continue;
    }
    return { currentId: p.id, skipped: skipped };
  } while (idx !== start);

  // Plus personne à jouer (tous terminés / hors ligne)
  return { currentId: null, skipped: skipped };
}

function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

function pickRandomLetter() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters.charAt(Math.floor(Math.random() * letters.length));
}

const GAME_GENRES = [
  "FPS",
  "MMO",
  "Survival",
  "RTS",
  "Nintendo",
  "Jeux mobiles",
];

function pickRandomGenre() {
  return GAME_GENRES[Math.floor(Math.random() * GAME_GENRES.length)];
}

const MIME_CATEGORIES = [
  "Princesse Disney",
  "Méchant Disney",
  "Perso Marvel",
  "Champion LoL",
  "Agent Valorant",
  "Personne connue",
];

function pickRandomMime() {
  return MIME_CATEGORIES[Math.floor(Math.random() * MIME_CATEGORIES.length)];
}

function normalizeCell(value) {
  const cell = Number(value);
  if (!Number.isFinite(cell) || cell <= 0) return 0;
  const num = Math.floor(cell);
  if (num < 1 || num > MAX_CELL) return 0;
  return num;
}

module.exports = {
  cellsToTraverse,
  destinationAfter,
  resolveLandingEffects,
  advanceToNextPlayer,
  playerIndexById,
  rollDie,
  pickRandomLetter,
  pickRandomGenre,
  GAME_GENRES,
  pickRandomMime,
  MIME_CATEGORIES,
  normalizeCell,
  MAX_CELL,
};
