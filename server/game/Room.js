const { Game } = require("./Game");

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;

class Room {
  constructor(code, hostPlayer) {
    this.code = code;
    this.hostId = hostPlayer.id;
    this.players = [hostPlayer];
    this.status = "lobby"; // lobby | playing
    this.diceCount = 2;
    this.createdAt = Date.now();
    this.game = null;
  }

  findPlayerById(playerId) {
    return this.players.find(function (p) {
      return p.id === playerId;
    }) || null;
  }

  findPlayerBySocketId(socketId) {
    return this.players.find(function (p) {
      return p.socketId === socketId;
    }) || null;
  }

  findPlayerByToken(token) {
    if (!token) return null;
    return this.players.find(function (p) {
      return p.reconnectToken === token;
    }) || null;
  }

  isFull() {
    return this.players.length >= MAX_PLAYERS;
  }

  isHost(playerId) {
    return this.hostId === playerId;
  }

  addPlayer(player) {
    if (this.status !== "lobby" && this.status !== "playing") {
      return { ok: false, error: "Impossible de rejoindre cette salle" };
    }
    if (this.isFull()) {
      return { ok: false, error: "La salle est pleine (max " + MAX_PLAYERS + ")" };
    }
    this.players.push(player);
    if (this.game && this.status === "playing") {
      this.game.onPlayerJoined(player);
    }
    return { ok: true, joinedInProgress: this.status === "playing" };
  }

  removePlayer(playerId) {
    const idx = this.players.findIndex(function (p) {
      return p.id === playerId;
    });
    if (idx < 0) return { removed: null, roomEmpty: this.players.length === 0 };

    const removed = this.players.splice(idx, 1)[0];
    if (removed && removed.id === this.hostId) {
      this.transferHost();
    }
    if (this.game && this.status === "playing") {
      this.game.onPlayerRemoved(playerId, removed);
    }
    return { removed: removed, roomEmpty: this.players.length === 0 };
  }

  transferHost() {
    const next = this.players.find(function (p) {
      return p.connected;
    }) || this.players[0] || null;

    this.players.forEach(function (p) {
      p.isHost = false;
    });

    if (!next) {
      this.hostId = null;
      return null;
    }

    next.isHost = true;
    this.hostId = next.id;
    return next;
  }

  setDiceCount(playerId, count) {
    if (!this.isHost(playerId)) {
      return { ok: false, error: "Seul l'hôte peut changer le nombre de dés" };
    }
    if (this.status !== "lobby") {
      return { ok: false, error: "Impossible de changer les dés après le démarrage" };
    }
    if (count !== 1 && count !== 2) {
      return { ok: false, error: "Nombre de dés invalide" };
    }
    this.diceCount = count;
    return { ok: true };
  }

  canStart() {
    const connectedCount = this.players.filter(function (p) {
      return p.connected;
    }).length;
    return this.status === "lobby" && connectedCount >= MIN_PLAYERS;
  }

  startGame(playerId) {
    if (!this.isHost(playerId)) {
      return { ok: false, error: "Seul l'hôte peut démarrer la partie" };
    }
    if (!this.canStart()) {
      return {
        ok: false,
        error: "Il faut au moins " + MIN_PLAYERS + " joueurs connectés",
      };
    }
    this.status = "playing";
    this.game = new Game(this);
    this.game.start();
    return { ok: true };
  }

  toPublic() {
    return {
      code: this.code,
      hostId: this.hostId,
      status: this.status,
      diceCount: this.diceCount,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      players: this.players.map(function (p) {
        return p.toPublic();
      }),
      canStart: this.canStart(),
      game: this.game && this.status === "playing" ? this.game.toPublic() : null,
    };
  }
}

module.exports = {
  Room,
  MIN_PLAYERS,
  MAX_PLAYERS,
};
