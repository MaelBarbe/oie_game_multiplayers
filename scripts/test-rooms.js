/**
 * Test rapide des salles via le protocole Socket.IO (polling).
 * Usage: node scripts/test-rooms.js
 */
const http = require("http");

const BASE = "http://127.0.0.1:3000";

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
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function decodePayload(raw) {
  // Engine.IO v4: packets separated by \x1e
  if (raw.indexOf("\x1e") >= 0) {
    return raw.split("\x1e").filter(Boolean);
  }
  // Legacy length-prefixed
  if (/^\d+:/.test(raw)) {
    const parts = [];
    let i = 0;
    while (i < raw.length) {
      const colon = raw.indexOf(":", i);
      if (colon < 0) break;
      const len = parseInt(raw.slice(i, colon), 10);
      if (!Number.isFinite(len)) break;
      const start = colon + 1;
      parts.push(raw.slice(start, start + len));
      i = start + len;
    }
    return parts.length ? parts : [raw];
  }
  return [raw];
}

async function openSocket() {
  const open = await request("GET", "/socket.io/?EIO=4&transport=polling");
  const packet = decodePayload(open.body)[0];
  if (!packet.startsWith("0")) throw new Error("Open failed: " + open.body);
  const data = JSON.parse(packet.slice(1));
  const sid = data.sid;

  // Connect to default namespace
  await request(
    "POST",
    "/socket.io/?EIO=4&transport=polling&sid=" + encodeURIComponent(sid),
    "40"
  );

  // Read connect ack / serverReady
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
      const res = await request(
        "GET",
        "/socket.io/?EIO=4&transport=polling&sid=" + encodeURIComponent(sid)
      );
      const packets = decodePayload(res.body);
      const events = [];
      packets.forEach(function (p) {
        if (p.startsWith("42")) {
          events.push(JSON.parse(p.slice(2)));
        }
      });
      return events;
    },
  };
}

function findEvent(events, name) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i][0] === name) return events[i];
  }
  return null;
}

function findRoomWith(events, predicate) {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e[0] === "roomUpdated" && e[1] && e[1].room && predicate(e[1].room)) {
      return e;
    }
  }
  return null;
}

async function main() {
  const host = await openSocket();
  const guest = await openSocket();

  const createdEvents = await host.emit("createRoom", { name: "Mael" });
  const created = findEvent(createdEvents, "roomUpdated");
  if (!created || !created[1] || !created[1].room) {
    // With ack-based API, polling without ack id may not return ack payload.
    // Fallback: listen for any roomUpdated after a short second poll is not ideal.
    throw new Error("createRoom: roomUpdated manquant — " + JSON.stringify(createdEvents));
  }

  const code = created[1].room.code;
  console.log("OK createRoom →", code);

  const joinedEvents = await guest.emit("joinRoom", { name: "Ami", code: code });
  const joined = findEvent(joinedEvents, "roomUpdated");
  if (!joined || !joined[1].room) {
    throw new Error("joinRoom: roomUpdated manquant — " + JSON.stringify(joinedEvents));
  }

  const players = joined[1].room.players.map(function (p) {
    return p.name;
  });
  console.log("OK joinRoom → joueurs:", players.join(", "));

  if (joined[1].room.players.length !== 2) {
    throw new Error("Attendu 2 joueurs");
  }

  const diceEvents = await host.emit("setDiceCount", { count: 1 });
  const diceUpdated = findRoomWith(diceEvents, function (room) {
    return room.diceCount === 1;
  });
  if (!diceUpdated) {
    throw new Error("setDiceCount échoué — " + JSON.stringify(diceEvents));
  }
  console.log("OK setDiceCount →", diceUpdated[1].room.diceCount);

  const startEvents = await host.emit("startGame", {});
  const started =
    findEvent(startEvents, "gameStarted") || findEvent(startEvents, "roomUpdated");
  if (!started) {
    throw new Error("startGame échoué — " + JSON.stringify(startEvents));
  }
  console.log("OK startGame → status", (started[1].room && started[1].room.status) || started[1].status);

  console.log("Tous les tests salle OK");
}

main().catch(function (err) {
  console.error("FAIL:", err.message);
  process.exit(1);
});
