const crypto = require("crypto");

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

function generateRoomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = crypto.randomInt(0, ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[idx];
  }
  return code;
}

function normalizeRoomCode(code) {
  if (typeof code !== "string") return "";
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isValidRoomCode(code) {
  const normalized = normalizeRoomCode(code);
  if (normalized.length !== ROOM_CODE_LENGTH) return false;
  for (let i = 0; i < normalized.length; i++) {
    if (ROOM_CODE_ALPHABET.indexOf(normalized[i]) === -1) return false;
  }
  return true;
}

function generateReconnectToken() {
  return crypto.randomBytes(24).toString("hex");
}

function generatePlayerId() {
  return crypto.randomBytes(8).toString("hex");
}

module.exports = {
  generateRoomCode,
  normalizeRoomCode,
  isValidRoomCode,
  generateReconnectToken,
  generatePlayerId,
  ROOM_CODE_LENGTH,
};
