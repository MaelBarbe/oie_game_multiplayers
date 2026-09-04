/**
 * Tests unitaires de la logique de jeu serveur (sans Socket.IO).
 * Usage: node scripts/test-game.js
 */
const { Player } = require("../server/game/Player");
const { Room } = require("../server/game/Room");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function makeRoom() {
  const host = new Player({
    name: "Mael",
    socketId: "s1",
    isHost: true,
    takenColors: [],
  });
  const room = new Room("TEST01", host);
  const guest = new Player({
    name: "Ami",
    socketId: "s2",
    isHost: false,
    takenColors: [host.color],
  });
  room.addPlayer(guest);
  return { room: room, host: host, guest: guest };
}

function main() {
  const { room, host, guest } = makeRoom();

  const started = room.startGame(host.id);
  assert(started.ok, "startGame doit réussir");
  assert(room.status === "playing", "status playing");
  assert(room.game, "game créé");
  assert(host.cell === 1 && guest.cell === 1, "tous sur case 1");
  assert(room.game.currentPlayerId === host.id, "hôte commence");

  // Autre joueur ne peut pas lancer
  const denied = room.game.rollDice(guest.id);
  assert(!denied.ok, "pas le tour de Ami");

  // Host lance
  const roll = room.game.rollDice(host.id);
  assert(roll.ok, "roll host ok: " + (roll.error || ""));
  assert(roll.dice && roll.dice.total >= 1, "dés générés côté serveur");
  assert(host.cell >= 1, "host a avancé");

  // Si pas d'action pending (lettre/victoire), le tour a dû changer ou aegis
  if (!room.game.pendingAction) {
    const stillHost = room.game.currentPlayerId === host.id;
    const notes = (roll.move && roll.move.notes) || [];
    const aegis = notes.some(function (n) {
      return /Aegis/i.test(n);
    });
    assert(stillHost === aegis || !stillHost || aegis, "gestion de tour cohérente");
  }

  // Forcer une position et tester moveToken hôte
  room.game.pendingAction = null;
  room.game.turnBusy = false;
  room.game.currentPlayerId = host.id;
  const moved = room.game.moveToken(host.id, { playerId: guest.id, toCell: 13 });
  assert(moved.ok, "moveToken hôte");
  assert(guest.cell === 13, "ami sur case BAN");
  assert(guest.skipTurns === 1, "BAN appliqué");

  // Non-hôte ne peut pas move
  const badMove = room.game.moveToken(guest.id, { playerId: host.id, toCell: 5 });
  assert(!badMove.ok, "ami ne peut pas moveToken");

  // Restart
  const restarted = room.game.restartGame(host.id);
  assert(restarted.ok, "restart");
  assert(host.cell === 1 && guest.cell === 1, "reset positions");
  assert(guest.skipTurns === 0, "reset BAN");

  // Join en cours de partie
  const currentBefore = room.game.currentPlayerId;
  const late = new Player({
    name: "Late",
    socketId: "s3",
    isHost: false,
    takenColors: [host.color, guest.color],
  });
  const joinedLate = room.addPlayer(late);
  assert(joinedLate.ok, "join mid-game ok");
  assert(joinedLate.joinedInProgress, "flag joinedInProgress");
  assert(late.cell === 1, "late sur case 1");
  assert(room.players.length === 3, "3 joueurs");
  assert(room.game.currentPlayerId === currentBefore, "tour en cours inchangé");
  assert(/Late.*rejoint/i.test(room.game.message), "message join: " + room.game.message);
  assert(
    room.game.history.some(function (h) {
      return h.kind === "join" && /Late/.test(h.text);
    }),
    "historique contient le join"
  );

  // Simuler victoire
  room.game.currentPlayerId = host.id;
  room.game.turnBusy = false;
  room.game.pendingAction = null;
  host.cell = 49;
  const fakeVictory = room.game.moveToken(host.id, { playerId: host.id, toCell: 49 });
  assert(fakeVictory.ok, "move victoire");
  assert(host.finished, "host finished");
  assert(room.game.currentPlayerId === guest.id, "tour au suivant");
  assert(!room.game.pendingAction, "pas de pending");

  console.log("OK — logique Game serveur validée");
  console.log("  dernier état:", JSON.stringify({
    current: room.game.currentPlayerId === host.id ? "Mael" : "Ami",
    cells: room.players.map(function (p) {
      return p.name + "=" + p.cell + (p.finished ? "(win)" : "");
    }),
    message: room.game.message,
  }));
}

main();
