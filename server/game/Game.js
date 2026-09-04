const {
  cellsToTraverse,
  resolveLandingEffects,
  advanceToNextPlayer,
  rollDie,
  pickRandomLetter,
  pickRandomGenre,
  pickRandomMime,
  normalizeCell,
  MAX_CELL,
} = require("./Rules");

const HISTORY_MAX = 40;

class Game {
  constructor(room) {
    this.room = room;
    this.currentPlayerId = null;
    this.turnBusy = false;
    this.lastDice = null;
    this.lastMove = null;
    this.pendingAction = null;
    this.winnerId = null;
    this.lastVictory = null;
    this.message = "";
    this.history = [];
  }

  pushHistory({ playerId, playerName, kind, text }) {
    if (!text) return;
    this.history.push({
      id: Date.now() + "-" + this.history.length,
      at: Date.now(),
      playerId: playerId || null,
      playerName: playerName || null,
      kind: kind || "info",
      text: String(text),
    });
    if (this.history.length > HISTORY_MAX) {
      this.history = this.history.slice(-HISTORY_MAX);
    }
  }

  /** Phrase lisible pour un lancer de dés. */
  formatRollHistory(player, values, total, fromCell, toCell, extras) {
    const name = player.name;
    let dicePhrase;
    if (values.length === 1) {
      dicePhrase = "lance un " + values[0];
    } else {
      dicePhrase =
        "lance " + values.join(" et ") + " (total " + total + ")";
    }

    let movePhrase;
    if (!toCell) {
      movePhrase = "et reste hors jeu";
    } else if (fromCell === toCell) {
      movePhrase = "et reste sur la case " + toCell;
    } else if (!fromCell || fromCell === 0) {
      movePhrase = "et arrive sur la case " + toCell;
    } else {
      movePhrase =
        "et avance de la case " + fromCell + " à la case " + toCell;
    }

    let text = name + " " + dicePhrase + " " + movePhrase;
    if (extras && extras.length) {
      text += ". " + extras.join(". ");
    }
    return text;
  }

  start() {
    this.room.players.forEach(function (p) {
      p.cell = 1;
      p.skipTurns = 0;
      p.finished = false;
    });
    this.currentPlayerId = this.room.players.length
      ? this.room.players[0].id
      : null;
    this.turnBusy = false;
    this.lastDice = null;
    this.lastMove = null;
    this.pendingAction = null;
    this.winnerId = null;
    this.lastVictory = null;
    this.history = [];
    this.message = "Partie lancée — tout le monde sur la case 1";
    this.pushHistory({
      kind: "start",
      text: "La partie commence. Tout le monde est sur la case 1.",
    });
  }

  restart() {
    this.start();
    this.message = "Nouvelle partie — tout le monde sur la case 1";
    this.history = [];
    this.pushHistory({
      kind: "start",
      text: "Nouvelle partie. Tout le monde repart sur la case 1.",
    });
  }

  getCurrentPlayer() {
    return this.room.findPlayerById(this.currentPlayerId);
  }

  ensureCurrentPlayer() {
    const current = this.room.findPlayerById(this.currentPlayerId);
    if (current && !current.finished && current.connected) return;

    const connected = this.room.players.find(function (p) {
      return p.connected && !p.finished;
    });
    if (connected) {
      this.currentPlayerId = connected.id;
      return;
    }
    const anyActive = this.room.players.find(function (p) {
      return !p.finished;
    });
    this.currentPlayerId = anyActive ? anyActive.id : null;
  }

  buildMessage(notes, skipped, extraTurn) {
    const parts = [];
    if (notes && notes.length) parts.push(notes.join(" · "));
    if (skipped && skipped.length) {
      const banSkipped = skipped.filter(function (s) {
        return s.reason === "ban";
      });
      if (banSkipped.length) {
        parts.push(
          banSkipped.map(function (s) {
            return s.name;
          }).join(", ") +
            (banSkipped.length > 1 ? " passent" : " passe") +
            " le tour (BAN)"
        );
      }
    }
    if (extraTurn) parts.push("Rejoue !");
    return parts.join(" — ");
  }

  finishTurn(extraTurn, notes) {
    if (extraTurn) {
      const current = this.getCurrentPlayer();
      if (current && current.finished) {
        // Un gagnant ne rejoue pas
      } else {
        this.message = this.buildMessage(notes, [], true);
        this.turnBusy = false;
        return { advanced: false };
      }
    }

    const result = advanceToNextPlayer(this.room.players, this.currentPlayerId);
    this.currentPlayerId = result.currentId;
    this.message = this.buildMessage(notes, result.skipped, false);
    this.turnBusy = false;
    return { advanced: true, skipped: result.skipped };
  }

  /**
   * Marque le joueur comme gagnant : hors tours, partie continue.
   */
  registerVictory(player) {
    player.finished = true;
    player.skipTurns = 0;
    this.winnerId = player.id;
    this.lastVictory = {
      playerId: player.id,
      winnerName: player.name,
      at: Date.now(),
    };
    const notes = [
      player.name + " a gagné !",
      "Il sort des tours — la partie continue",
    ];
    this.finishTurn(false, notes);
    this.pushHistory({
      playerId: player.id,
      playerName: player.name,
      kind: "victory",
      text: player.name + " a gagné sur la case " + player.cell + " et sort des tours.",
    });
    return notes;
  }

  /**
   * Crée un pending letter/genre/mime/race après atterrissage.
   * @returns {{ kind: string, historyExtra: string }|null}
   */
  createLandingPending(player, resolved, options) {
    const manual = !!(options && options.manual);
    const at = Date.now();

    if (resolved.letterPick) {
      this.pendingAction = {
        type: "letter",
        playerId: player.id,
        letter: pickRandomLetter(),
        prompt: resolved.prompt,
        manual: manual,
        at: at,
      };
      this.turnBusy = true;
      return {
        kind: "letter",
        historyExtra: "Lettre tirée : " + this.pendingAction.letter,
      };
    }

    if (resolved.genrePick) {
      this.pendingAction = {
        type: "genre",
        playerId: player.id,
        genre: pickRandomGenre(),
        prompt: resolved.prompt,
        manual: manual,
        at: at,
      };
      this.turnBusy = true;
      return {
        kind: "genre",
        historyExtra: "Genre tiré : " + this.pendingAction.genre,
      };
    }

    if (resolved.mimePick) {
      this.pendingAction = {
        type: "mime",
        playerId: player.id,
        category: pickRandomMime(),
        prompt: resolved.prompt,
        manual: manual,
        at: at,
      };
      this.turnBusy = true;
      return {
        kind: "mime",
        historyExtra: "À mimer : " + this.pendingAction.category,
      };
    }

    if (resolved.racePick) {
      const eligibleIds = this.room.players
        .filter(function (p) {
          return !p.finished;
        })
        .map(function (p) {
          return p.id;
        });
      this.pendingAction = {
        type: "race",
        playerId: player.id,
        keyword: resolved.keyword || "GG",
        prompt: resolved.prompt,
        messages: [],
        submitted: {},
        eligibleIds: eligibleIds,
        resolved: false,
        loserIds: [],
        loserNames: [],
        forced: false,
        manual: manual,
        at: at,
      };
      this.turnBusy = true;
      return {
        kind: "race",
        historyExtra:
          "Défi chat : dernier à écrire « " + this.pendingAction.keyword + " »",
      };
    }

    return null;
  }

  /**
   * Ferme un défi : avance le tour sauf si le pending venait d'un déplacement hôte.
   */
  closePendingChallenge(notes) {
    const wasManual = !!(this.pendingAction && this.pendingAction.manual);
    this.pendingAction = null;
    if (wasManual) {
      this.turnBusy = false;
      this.message = (notes || []).filter(Boolean).join(" · ") || "Défi terminé";
      return { advanced: false, manual: true };
    }
    return this.finishTurn(false, notes);
  }

  /**
   * Lancer les dés pour le joueur actif.
   */
  rollDice(playerId) {
    if (this.room.status !== "playing") {
      return { ok: false, error: "La partie n'est pas en cours" };
    }
    if (this.pendingAction) {
      return { ok: false, error: "Une action est en attente" };
    }
    if (this.turnBusy) {
      return { ok: false, error: "Tour en cours" };
    }
    if (playerId !== this.currentPlayerId) {
      return { ok: false, error: "Ce n'est pas ton tour" };
    }

    const player = this.room.findPlayerById(playerId);
    if (!player || !player.connected) {
      return { ok: false, error: "Joueur indisponible" };
    }
    if (player.finished) {
      return { ok: false, error: "Tu as déjà gagné — tu ne joues plus" };
    }

    this.turnBusy = true;

    if ((player.skipTurns || 0) > 0) {
      player.skipTurns = 0;
      const banText = player.name + " passe son tour (BAN)";
      this.finishTurn(false, [banText]);
      this.pushHistory({
        playerId: player.id,
        playerName: player.name,
        kind: "ban",
        text: player.name + " passe son tour à cause d'un BAN.",
      });
      return {
        ok: true,
        skippedBan: true,
        game: this.toPublic(),
      };
    }

    const count = this.room.diceCount === 1 ? 1 : 2;
    const values = [];
    for (let i = 0; i < count; i++) values.push(rollDie());
    const total = values.reduce(function (sum, v) {
      return sum + v;
    }, 0);

    const fromCell = player.cell || 0;
    const path = cellsToTraverse(fromCell, total);
    const toCell = path.length ? path[path.length - 1] : fromCell;
    player.cell = toCell;

    const resolved = resolveLandingEffects(player);

    this.lastDice = { values: values, total: total };
    this.lastMove = {
      playerId: player.id,
      fromCell: fromCell,
      toCell: player.cell,
      path: path,
      notes: resolved.notes,
    };

    const noteExtras = (resolved.notes || []).slice();
    if (resolved.extraTurn) noteExtras.push("Il rejoue");

    if (resolved.victory) {
      this.pushHistory({
        playerId: player.id,
        playerName: player.name,
        kind: "roll",
        text: this.formatRollHistory(
          player,
          values,
          total,
          fromCell,
          player.cell,
          noteExtras
        ),
      });
      this.registerVictory(player);
      return {
        ok: true,
        dice: this.lastDice,
        move: this.lastMove,
        victory: this.lastVictory,
        game: this.toPublic(),
      };
    }

    const challenge = this.createLandingPending(player, resolved, {
      manual: false,
    });
    if (challenge) {
      this.message = this.buildMessage(resolved.notes, [], false);
      const challengeExtras = noteExtras.slice();
      challengeExtras.push(challenge.historyExtra);
      this.pushHistory({
        playerId: player.id,
        playerName: player.name,
        kind: challenge.kind,
        text: this.formatRollHistory(
          player,
          values,
          total,
          fromCell,
          player.cell,
          challengeExtras
        ),
      });
      return {
        ok: true,
        dice: this.lastDice,
        move: this.lastMove,
        game: this.toPublic(),
      };
    }

    this.finishTurn(resolved.extraTurn, resolved.notes);
    this.pushHistory({
      playerId: player.id,
      playerName: player.name,
      kind: "roll",
      text: this.formatRollHistory(
        player,
        values,
        total,
        fromCell,
        player.cell,
        noteExtras
      ),
    });

    return {
      ok: true,
      dice: this.lastDice,
      move: this.lastMove,
      game: this.toPublic(),
    };
  }

  confirmLetter(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "letter") {
      return { ok: false, error: "Pas de lettre en attente" };
    }
    const actor = this.room.findPlayerById(playerId);
    if (!actor || !actor.connected) {
      return { ok: false, error: "Joueur indisponible" };
    }

    const letter = this.pendingAction.letter;
    const subject = this.room.findPlayerById(this.pendingAction.playerId);
    const notes = ["Lettre " + letter];
    let text = actor.name + " valide la lettre " + letter;
    if (subject && subject.id !== actor.id) {
      text += " pour " + subject.name;
    }
    this.pushHistory({
      playerId: actor.id,
      playerName: actor.name,
      kind: "letter",
      text: text + ".",
    });
    this.closePendingChallenge(notes);
    return { ok: true, game: this.toPublic() };
  }

  /** Hôte : tire une nouvelle lettre (même case / prompt). */
  rerollLetter(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "letter") {
      return { ok: false, error: "Pas de lettre en attente" };
    }
    if (!this.room.isHost(playerId)) {
      return { ok: false, error: "Seul l'hôte peut relancer la lettre" };
    }
    this.pendingAction.letter = pickRandomLetter();
    this.pendingAction.at = Date.now();
    this.message = "Nouvelle lettre : " + this.pendingAction.letter;
    const host = this.room.findPlayerById(playerId);
    this.pushHistory({
      playerId: playerId,
      playerName: host ? host.name : null,
      kind: "letter",
      text:
        (host ? host.name : "L'hôte") +
        " tire une nouvelle lettre : " +
        this.pendingAction.letter +
        ".",
    });
    return { ok: true, game: this.toPublic() };
  }

  confirmGenre(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "genre") {
      return { ok: false, error: "Pas de genre en attente" };
    }
    const actor = this.room.findPlayerById(playerId);
    if (!actor || !actor.connected) {
      return { ok: false, error: "Joueur indisponible" };
    }

    const genre = this.pendingAction.genre;
    const subject = this.room.findPlayerById(this.pendingAction.playerId);
    const notes = ["Genre " + genre];
    let text = actor.name + " valide le genre " + genre;
    if (subject && subject.id !== actor.id) {
      text += " pour " + subject.name;
    }
    this.pushHistory({
      playerId: actor.id,
      playerName: actor.name,
      kind: "genre",
      text: text + ".",
    });
    this.closePendingChallenge(notes);
    return { ok: true, game: this.toPublic() };
  }

  /** Hôte : relance la roue des genres. */
  rerollGenre(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "genre") {
      return { ok: false, error: "Pas de genre en attente" };
    }
    if (!this.room.isHost(playerId)) {
      return { ok: false, error: "Seul l'hôte peut relancer le genre" };
    }
    this.pendingAction.genre = pickRandomGenre();
    this.pendingAction.at = Date.now();
    this.message = "Nouveau genre : " + this.pendingAction.genre;
    const host = this.room.findPlayerById(playerId);
    this.pushHistory({
      playerId: playerId,
      playerName: host ? host.name : null,
      kind: "genre",
      text:
        (host ? host.name : "L'hôte") +
        " tire un nouveau genre : " +
        this.pendingAction.genre +
        ".",
    });
    return { ok: true, game: this.toPublic() };
  }

  confirmMime(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "mime") {
      return { ok: false, error: "Pas de mime en attente" };
    }
    const actor = this.room.findPlayerById(playerId);
    if (!actor || !actor.connected) {
      return { ok: false, error: "Joueur indisponible" };
    }

    const category = this.pendingAction.category;
    const subject = this.room.findPlayerById(this.pendingAction.playerId);
    const notes = ["Mime : " + category];
    let text = actor.name + " valide le mime (" + category + ")";
    if (subject && subject.id !== actor.id) {
      text += " pour " + subject.name;
    }
    this.pushHistory({
      playerId: actor.id,
      playerName: actor.name,
      kind: "mime",
      text: text + ".",
    });
    this.closePendingChallenge(notes);
    return { ok: true, game: this.toPublic() };
  }

  /** Hôte : tire un nouveau type à mimer. */
  rerollMime(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "mime") {
      return { ok: false, error: "Pas de mime en attente" };
    }
    if (!this.room.isHost(playerId)) {
      return { ok: false, error: "Seul l'hôte peut relancer" };
    }
    this.pendingAction.category = pickRandomMime();
    this.pendingAction.at = Date.now();
    this.message = "Nouveau mime : " + this.pendingAction.category;
    const host = this.room.findPlayerById(playerId);
    this.pushHistory({
      playerId: playerId,
      playerName: host ? host.name : null,
      kind: "mime",
      text:
        (host ? host.name : "L'hôte") +
        " tire un nouveau mime : " +
        this.pendingAction.category +
        ".",
    });
    return { ok: true, game: this.toPublic() };
  }

  normalizeRaceKeyword(text) {
    return String(text || "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
  }

  resolveRaceChallenge(forced) {
    const pending = this.pendingAction;
    if (!pending || pending.type !== "race" || pending.resolved) return;

    const submittedEntries = Object.keys(pending.submitted).map(function (id) {
      return { id: id, at: pending.submitted[id] };
    });
    submittedEntries.sort(function (a, b) {
      return a.at - b.at;
    });

    const missing = (pending.eligibleIds || []).filter(function (id) {
      return pending.submitted[id] == null;
    });

    let loserIds = [];
    if (forced && missing.length) {
      loserIds = missing.slice();
    } else if (submittedEntries.length) {
      loserIds = [submittedEntries[submittedEntries.length - 1].id];
    } else if (missing.length) {
      loserIds = missing.slice();
    }

    const self = this;
    const loserNames = loserIds.map(function (id) {
      const p = self.room.findPlayerById(id);
      return p ? p.name : "Joueur";
    });

    pending.resolved = true;
    pending.forced = !!forced;
    pending.loserIds = loserIds;
    pending.loserNames = loserNames;

    if (loserNames.length === 1) {
      this.message = loserNames[0] + " était le dernier — il/elle boit !";
    } else if (loserNames.length > 1) {
      this.message = loserNames.join(", ") + " n'ont pas écrit à temps — ils boivent !";
    } else {
      this.message = "Défi chat terminé";
    }
  }

  submitRaceMessage(playerId, text) {
    if (!this.pendingAction || this.pendingAction.type !== "race") {
      return { ok: false, error: "Pas de défi chat en cours" };
    }
    if (this.pendingAction.resolved) {
      return { ok: false, error: "Le défi est déjà terminé" };
    }

    const actor = this.room.findPlayerById(playerId);
    if (!actor || !actor.connected) {
      return { ok: false, error: "Joueur indisponible" };
    }
    if (actor.finished) {
      return { ok: false, error: "Tu as déjà gagné" };
    }

    const clean = String(text || "").trim().slice(0, 80);
    if (!clean) {
      return { ok: false, error: "Message vide" };
    }

    const keyword = this.normalizeRaceKeyword(this.pendingAction.keyword);
    const isKeyword = this.normalizeRaceKeyword(clean) === keyword;
    const already = this.pendingAction.submitted[playerId] != null;

    this.pendingAction.messages.push({
      id: Date.now() + "-" + this.pendingAction.messages.length,
      playerId: actor.id,
      name: actor.name,
      color: actor.color,
      text: clean,
      isKeyword: isKeyword,
      at: Date.now(),
    });
    if (this.pendingAction.messages.length > 80) {
      this.pendingAction.messages = this.pendingAction.messages.slice(-80);
    }

    if (isKeyword && !already) {
      this.pendingAction.submitted[playerId] = Date.now();
      const eligible = this.pendingAction.eligibleIds || [];
      const allDone = eligible.every(function (id) {
        return this.pendingAction.submitted[id] != null;
      }, this);
      if (allDone) {
        this.resolveRaceChallenge(false);
      }
    }

    return { ok: true, game: this.toPublic() };
  }

  forceCloseRace(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "race") {
      return { ok: false, error: "Pas de défi chat en cours" };
    }
    if (this.pendingAction.resolved) {
      return { ok: false, error: "Le défi est déjà terminé" };
    }
    if (!this.room.isHost(playerId)) {
      return { ok: false, error: "Seul l'hôte peut forcer la fin" };
    }
    this.resolveRaceChallenge(true);
    this.pushHistory({
      playerId: playerId,
      playerName: (this.room.findPlayerById(playerId) || {}).name,
      kind: "race",
      text: "L'hôte force la fin du chat. " + (this.message || ""),
    });
    return { ok: true, game: this.toPublic() };
  }

  confirmRace(playerId) {
    if (!this.pendingAction || this.pendingAction.type !== "race") {
      return { ok: false, error: "Pas de défi chat en attente" };
    }
    if (!this.pendingAction.resolved) {
      return { ok: false, error: "Le défi n'est pas encore terminé" };
    }
    const actor = this.room.findPlayerById(playerId);
    if (!actor || !actor.connected) {
      return { ok: false, error: "Joueur indisponible" };
    }

    const notes = [];
    if (this.pendingAction.loserNames && this.pendingAction.loserNames.length) {
      notes.push(
        this.pendingAction.loserNames.length === 1
          ? this.pendingAction.loserNames[0] + " boit (dernier)"
          : this.pendingAction.loserNames.join(", ") + " boivent"
      );
    } else {
      notes.push("Défi chat terminé");
    }

    this.pushHistory({
      playerId: actor.id,
      playerName: actor.name,
      kind: "race",
      text: notes[0] + ".",
    });
    this.closePendingChallenge(notes);
    return { ok: true, game: this.toPublic() };
  }

  /** Conservé pour compat : la victoire n'bloque plus les tours. */
  continueAfterVictory(playerId) {
    const actor = this.room.findPlayerById(playerId);
    if (!actor || !actor.connected) {
      return { ok: false, error: "Joueur indisponible" };
    }
    this.ensureCurrentPlayer();
    this.turnBusy = false;
    return { ok: true, game: this.toPublic() };
  }

  restartGame(playerId) {
    if (!this.room.isHost(playerId)) {
      return { ok: false, error: "Seul l'hôte peut relancer" };
    }
    this.restart();
    return { ok: true, game: this.toPublic() };
  }

  moveToken(hostId, { playerId, toCell }) {
    if (this.room.status !== "playing") {
      return { ok: false, error: "La partie n'est pas en cours" };
    }
    if (!this.room.isHost(hostId)) {
      return { ok: false, error: "Seul l'hôte peut déplacer un pion" };
    }
    if (this.pendingAction) {
      return { ok: false, error: "Une action est en attente" };
    }

    const player = this.room.findPlayerById(playerId);
    if (!player) return { ok: false, error: "Joueur introuvable" };

    const fromCell = player.cell || 0;
    const placedCell = normalizeCell(toCell);
    player.cell = placedCell;

    const resolved = resolveLandingEffects(player);
    const finalCell = player.cell;

    this.lastMove = {
      playerId: player.id,
      fromCell: fromCell,
      toCell: finalCell,
      path:
        finalCell === placedCell
          ? [placedCell]
          : [placedCell, finalCell],
      notes: (resolved.notes || []).slice(),
      manual: true,
    };

    if (resolved.victory) {
      if (!player.finished) {
        this.registerVictory(player);
        return {
          ok: true,
          move: this.lastMove,
          victory: this.lastVictory,
          game: this.toPublic(),
        };
      }
      // Déjà gagnant : simple placement sur la case finale
    } else {
      const challenge = this.createLandingPending(player, resolved, {
        manual: true,
      });
      if (challenge) {
        this.message = this.buildMessage(resolved.notes, [], false);
        this.pushHistory({
          playerId: player.id,
          playerName: player.name,
          kind: challenge.kind,
          text:
            "L'hôte place " +
            player.name +
            " sur la case " +
            finalCell +
            ". " +
            challenge.historyExtra +
            ".",
        });
        return {
          ok: true,
          move: this.lastMove,
          game: this.toPublic(),
        };
      }
    }

    const noteSuffix =
      resolved.notes && resolved.notes.length
        ? " — " + resolved.notes.join(" · ")
        : "";
    this.message =
      player.name +
      " déplacé case " +
      (finalCell || "banc") +
      " (hôte)" +
      noteSuffix;
    this.turnBusy = false;
    this.pushHistory({
      playerId: player.id,
      playerName: player.name,
      kind: "move",
      text:
        "L'hôte déplace " +
        player.name +
        " de la case " +
        (fromCell || "banc") +
        " à la case " +
        (finalCell || "banc") +
        (noteSuffix ? " (" + resolved.notes.join(", ") + ")" : "") +
        ".",
    });

    return {
      ok: true,
      move: this.lastMove,
      game: this.toPublic(),
    };
  }

  onPlayerJoined(player) {
    if (!player) return;
    player.cell = 1;
    player.skipTurns = 0;
    player.finished = false;
    this.message = player.name + " a rejoint la partie (case 1)";
    this.pushHistory({
      playerId: player.id,
      playerName: player.name,
      kind: "join",
      text: player.name + " a rejoint la partie et commence sur la case 1.",
    });
  }

  onPlayerRemoved(playerId, removedPlayer) {
    const leaving = removedPlayer || this.room.findPlayerById(playerId);
    if (leaving) {
      this.pushHistory({
        playerId: leaving.id,
        playerName: leaving.name,
        kind: "leave",
        text: leaving.name + " a quitté la partie.",
      });
    }
    if (this.pendingAction && this.pendingAction.playerId === playerId) {
      this.pendingAction = null;
      this.turnBusy = false;
    }
    if (this.currentPlayerId === playerId) {
      const result = advanceToNextPlayer(this.room.players, playerId);
      this.currentPlayerId = result.currentId;
    } else {
      this.ensureCurrentPlayer();
    }
  }

  skipIfCurrentOffline() {
    const current = this.getCurrentPlayer();
    if (!current || current.connected) return;
    const result = advanceToNextPlayer(this.room.players, this.currentPlayerId);
    this.currentPlayerId = result.currentId;
    this.message = current.name + " hors ligne — tour suivant";
    this.turnBusy = false;
    this.pushHistory({
      playerId: current.id,
      playerName: current.name,
      kind: "skip",
      text: current.name + " est hors ligne. On passe au joueur suivant.",
    });
  }

  toPublic() {
    const current = this.getCurrentPlayer();
    return {
      status: this.room.status,
      diceCount: this.room.diceCount,
      currentPlayerId: this.currentPlayerId,
      currentPlayerName: current ? current.name : null,
      turnBusy: this.turnBusy,
      message: this.message,
      lastDice: this.lastDice,
      lastMove: this.lastMove,
      pendingAction: this.pendingAction,
      winnerId: this.winnerId,
      lastVictory: this.lastVictory,
      history: this.history.slice(),
      maxCell: MAX_CELL,
      players: this.room.players.map(function (p) {
        return p.toPublic();
      }),
    };
  }
}

module.exports = { Game };
