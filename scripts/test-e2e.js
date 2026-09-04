/**
 * Test de partie complète (étape 6) :
 * création, join, start, tours, reconnexion, victoire, restart.
 * Usage: node scripts/test-e2e.js
 */
const http = require("http");
const { Player } = require("../server/game/Player");
const { Room } = require("../server/game/Room");

const BASE = "http://127.0.0.1:3000";

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

function request(method, path, body) {
  return new Promise(function (resolve, reject) {
    const url = new URL(path, BASE);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: body
          ? {
              "Content-Type": "text/plain;charset=UTF-8",
              "Content-Length": Buffer.byteLength(body),
            }
          : undefined,
      },
      function (res) {
        const chunks = [];
        res.on("data", function (c) {
          chunks.push(c);
        });
        res.on("end", function () {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function decodePayload(raw) {
  if (raw.indexOf("\x1e") >= 0) return raw.split("\x1e").filter(Boolean);
  return [raw];
}

async function openSocket() {
  const open = await request("GET", "/socket.io/?EIO=4&transport=polling");
  const packet = decodePayload(open)[0];
  const data = JSON.parse(packet.slice(1));
  const sid = data.sid;
  await request(
    "POST",
    "/socket.io/?EIO=4&transport=polling&sid=" + encodeURIComponent(sid),
    "40"
  );
  await request(
    "GET",
    "/socket.io/?EIO=4&transport=polling&sid=" + encodeURIComponent(sid)
  );

  return {
    sid: sid,
    emit: async function (event, payload) {
      const msg = "42" + JSON.stringify([event, payload]);
      await request(
        "POST",
        "/socket.io/?EIO=4&transport=polling&sid=" + encodeURIComponent(sid),
        msg
      );
      const body = await request(
        "GET",
        "/socket.io/?EIO=4&transport=polling&sid=" + encodeURIComponent(sid)
      );
      return decodePayload(body)
        .filter(function (p) {
          return p.startsWith("42");
        })
        .map(function (p) {
          return JSON.parse(p.slice(2));
        });
    },
  };
}

function findLast(events, name) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i][0] === name) return events[i];
  }
  return null;
}

function findRoom(events, pred) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e[0] === "roomUpdated" && e[1] && e[1].room && pred(e[1].room)) {
      return e;
    }
    if (e[0] === "gameUpdated" && e[1] && e[1].room && pred(e[1].room)) {
      return e;
    }
    if (e[0] === "gameStarted" && e[1] && e[1].room && pred(e[1].room)) {
      return e;
    }
    if (e[0] === "diceRolled" && e[1] && e[1].room && pred(e[1].room)) {
      return e;
    }
  }
  return null;
}

async function testSocketFlow() {
  const host = await openSocket();
  const guest = await openSocket();

  let ev = await host.emit("createRoom", { name: "HostE2E" });
  const created = findLast(ev, "roomUpdated");
  assert(created && created[1].room, "createRoom");
  const code = created[1].room.code;
  const hostToken = created[1].you.reconnectToken;
  const hostId = created[1].you.id;
  console.log("OK create", code);

  ev = await guest.emit("joinRoom", { name: "GuestE2E", code: code });
  const joined = findRoom(ev, function (r) {
    return r.players && r.players.length === 2;
  });
  assert(joined, "joinRoom 2 joueurs");
  console.log("OK join");

  ev = await host.emit("startGame", {});
  const started = findRoom(ev, function (r) {
    return r.status === "playing" && r.game;
  });
  assert(started, "startGame");
  console.log("OK start");

  ev = await host.emit("rollDice", {});
  const rolled = findLast(ev, "diceRolled") || findLast(ev, "gameUpdated");
  assert(rolled, "rollDice");
  const gameAfterRoll = (rolled[1].game || (rolled[1].room && rolled[1].room.game));
  assert(gameAfterRoll, "état jeu après roll");
  console.log(
    "OK roll — total",
    gameAfterRoll.lastDice && gameAfterRoll.lastDice.total,
    "current",
    gameAfterRoll.currentPlayerName
  );

  // Reconnexion hôte (nouveau socket + token)
  const host2 = await openSocket();
  ev = await host2.emit("reconnectRoom", { code: code, token: hostToken });
  const reconnected = findRoom(ev, function (r) {
    return r.players.some(function (p) {
      return p.id === hostId && p.connected;
    });
  });
  assert(reconnected, "reconnectRoom");
  assert(reconnected[1].room.hostId === hostId, "hôte conservé après reconnect");
  console.log("OK reconnect — hôte conservé");

  // Victoire forcée via moveToken
  ev = await host2.emit("moveToken", { playerId: hostId, toCell: 49 });
  const afterWin = findLast(ev, "gameUpdated") || findRoom(ev, function (r) {
    return r.game && r.game.lastVictory;
  });
  assert(afterWin && afterWin[1].game, "état après victoire");
  const gWin = afterWin[1].game;
  assert(gWin.lastVictory && gWin.lastVictory.playerId === hostId, "lastVictory");
  const hostPlayer = gWin.players.find(function (p) { return p.id === hostId; });
  assert(hostPlayer && hostPlayer.finished, "gagnant finished");
  assert(!gWin.pendingAction, "pas de pending victoire");
  console.log("OK victory — gagnant hors tours, partie continue");

  ev = await host2.emit("restartGame", {});
  const restarted = findRoom(ev, function (r) {
    return r.game && r.game.players.every(function (p) {
      return p.cell === 1 && !p.finished;
    });
  }) || findLast(ev, "gameRestarted") || findLast(ev, "gameUpdated");
  assert(restarted, "restartGame");
  const g =
    (restarted[1] && restarted[1].game) ||
    (restarted[1] && restarted[1].room && restarted[1].room.game);
  assert(g && g.players.every(function (p) {
    return p.cell === 1 && !p.finished;
  }), "reset cases + finished");
  console.log("OK restart");
}

function testUnitVictoryReconnectHost() {
  const host = new Player({
    name: "H",
    socketId: "a",
    isHost: true,
    takenColors: [],
  });
  const room = new Room("E2E001", host);
  const guest = new Player({
    name: "G",
    socketId: "b",
    isHost: false,
    takenColors: [host.color],
  });
  room.addPlayer(guest);
  room.startGame(host.id);

  host.markDisconnected();
  // Simule l'ancien bug : on ne doit PAS transférer à la déco
  assert(room.hostId === host.id, "hôte reste hôte si déco temporaire");

  host.setSocket("a2");
  assert(room.isHost(host.id), "toujours hôte après reco");

  room.game.moveToken(host.id, { playerId: host.id, toCell: 49 });
  assert(host.finished, "hôte marqué finished");
  assert(room.game.currentPlayerId === guest.id, "tour passé au suivant");
  assert(room.game.lastVictory && room.game.lastVictory.playerId === host.id, "lastVictory");
  assert(!room.game.pendingAction, "pas de pending bloquant");

  const denied = room.game.rollDice(host.id);
  assert(!denied.ok, "gagnant ne peut plus lancer");

  console.log("OK unit host/victory continue");
}

async function main() {
  testUnitVictoryReconnectHost();
  await testSocketFlow();
  console.log("Tous les tests étape 6 OK");
}

main().catch(function (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
});
