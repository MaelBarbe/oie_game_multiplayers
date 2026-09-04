const { generatePlayerId, generateReconnectToken } = require("../utils/roomCode");

const NAME_MAX_LENGTH = 24;

function sanitizeName(name) {
  if (typeof name !== "string") return "";
  return name.trim().slice(0, NAME_MAX_LENGTH);
}

function sanitizeColor(color) {
  if (typeof color !== "string") return null;
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return (
      "#" +
      hex[1] + hex[1] +
      hex[2] + hex[2] +
      hex[3] + hex[3]
    ).toLowerCase();
  }
  return null;
}

const DEFAULT_COLORS = [
  "#ff5fa2",
  "#22d3ee",
  "#a855f7",
  "#22c55e",
  "#fb923c",
  "#e8b64f",
  "#60a5fa",
  "#f472b6",
  "#34d399",
  "#f87171",
];

function pickDefaultColor(taken) {
  const used = new Set(
    (taken || []).map(function (c) {
      return String(c || "").toLowerCase();
    })
  );
  for (let i = 0; i < DEFAULT_COLORS.length; i++) {
    if (!used.has(DEFAULT_COLORS[i])) return DEFAULT_COLORS[i];
  }
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
}

class Player {
  constructor({ name, color, socketId, isHost, takenColors }) {
    this.id = generatePlayerId();
    this.name = sanitizeName(name) || "Joueur";
    this.color = sanitizeColor(color) || pickDefaultColor(takenColors);
    this.socketId = socketId || null;
    this.reconnectToken = generateReconnectToken();
    this.connected = true;
    this.isHost = !!isHost;
    this.cell = 0;
    this.skipTurns = 0;
    this.finished = false;
  }

  setSocket(socketId) {
    this.socketId = socketId;
    this.connected = true;
  }

  markDisconnected() {
    this.connected = false;
    this.socketId = null;
  }

  updateProfile({ name, color }) {
    const nextName = sanitizeName(name);
    if (nextName) this.name = nextName;
    const nextColor = sanitizeColor(color);
    if (nextColor) this.color = nextColor;
  }

  toPublic() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      connected: this.connected,
      isHost: this.isHost,
      cell: this.cell,
      skipTurns: this.skipTurns,
      finished: !!this.finished,
    };
  }

  toSelf() {
    return {
      ...this.toPublic(),
      reconnectToken: this.reconnectToken,
    };
  }
}

module.exports = {
  Player,
  sanitizeName,
  sanitizeColor,
  NAME_MAX_LENGTH,
};
