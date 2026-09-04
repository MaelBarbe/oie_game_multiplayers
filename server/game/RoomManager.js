const { generateRoomCode, normalizeRoomCode, isValidRoomCode } = require("../utils/roomCode");
const { Player, sanitizeName } = require("./Player");
const { Room, MAX_PLAYERS } = require("./Room");

class RoomManager {
  constructor() {
    /** @type {Map<string, Room>} */
    this.rooms = new Map();
    /** socketId -> roomCode */
    this.socketToRoom = new Map();
  }

  getRoom(code) {
    const normalized = normalizeRoomCode(code);
    return this.rooms.get(normalized) || null;
  }

  getRoomBySocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    return this.getRoom(code);
  }

  createUniqueCode() {
    for (let attempt = 0; attempt < 50; attempt++) {
      const code = generateRoomCode();
      if (!this.rooms.has(code)) return code;
    }
    throw new Error("Impossible de générer un code de salle unique");
  }

  createRoom(socketId, { name, color }) {
    const cleanName = sanitizeName(name);
    if (!cleanName) {
      return { ok: false, error: "Pseudo requis" };
    }

    const existing = this.getRoomBySocket(socketId);
    if (existing) {
      return { ok: false, error: "Tu es déjà dans une salle" };
    }

    const code = this.createUniqueCode();
    const host = new Player({
      name: cleanName,
      color: color,
      socketId: socketId,
      isHost: true,
      takenColors: [],
    });
    const room = new Room(code, host);
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);

    return { ok: true, room: room, player: host };
  }

  joinRoom(socketId, { code, name, color }) {
    const cleanName = sanitizeName(name);
    if (!cleanName) {
      return { ok: false, error: "Pseudo requis" };
    }

    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      return { ok: false, error: "Code de salle invalide" };
    }

    if (this.getRoomBySocket(socketId)) {
      return { ok: false, error: "Tu es déjà dans une salle" };
    }

    const room = this.getRoom(normalized);
    if (!room) {
      return { ok: false, error: "Aucune salle avec ce code" };
    }

    const takenColors = room.players.map(function (p) {
      return p.color;
    });

    const player = new Player({
      name: cleanName,
      color: color,
      socketId: socketId,
      isHost: false,
      takenColors: takenColors,
    });

    const added = room.addPlayer(player);
    if (!added.ok) return added;

    this.socketToRoom.set(socketId, room.code);
    return { ok: true, room: room, player: player };
  }

  reconnectRoom(socketId, { code, token }) {
    const room = this.getRoom(code);
    if (!room) {
      return { ok: false, error: "Salle introuvable" };
    }

    const player = room.findPlayerByToken(token);
    if (!player) {
      return { ok: false, error: "Session invalide" };
    }

    if (player.socketId && player.socketId !== socketId) {
      this.socketToRoom.delete(player.socketId);
    }

    player.setSocket(socketId);
    this.socketToRoom.set(socketId, room.code);

    return { ok: true, room: room, player: player };
  }

  leaveRoom(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      return { ok: false, error: "Pas dans une salle" };
    }

    const player = room.findPlayerBySocketId(socketId);
    this.socketToRoom.delete(socketId);

    if (!player) {
      return { ok: true, room: room, removed: null, roomEmpty: room.players.length === 0 };
    }

    const result = room.removePlayer(player.id);
    if (result.roomEmpty) {
      this.rooms.delete(room.code);
    }

    return {
      ok: true,
      room: room,
      removed: result.removed,
      roomEmpty: result.roomEmpty,
    };
  }

  handleDisconnect(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return null;

    const player = room.findPlayerBySocketId(socketId);
    this.socketToRoom.delete(socketId);
    if (!player) return { room: room, player: null };

    player.markDisconnected();

    // Pas de transfert d'hôte ici : une coupure / refresh est temporaire.
    // Le transfert se fait uniquement sur leaveRoom (removePlayer).

    return { room: room, player: player };
  }

  setDiceCount(socketId, count) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: "Pas dans une salle" };
    const player = room.findPlayerBySocketId(socketId);
    if (!player) return { ok: false, error: "Joueur introuvable" };
    return room.setDiceCount(player.id, count);
  }

  startGame(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { ok: false, error: "Pas dans une salle" };
    const player = room.findPlayerBySocketId(socketId);
    if (!player) return { ok: false, error: "Joueur introuvable" };
    return room.startGame(player.id);
  }
}

module.exports = {
  RoomManager,
  MAX_PLAYERS,
};
