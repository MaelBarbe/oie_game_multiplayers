const { RoomManager } = require("../game/RoomManager");

const roomManager = new RoomManager();

function emitRoomState(io, room) {
  room.players.forEach(function (player) {
    if (!player.socketId) return;
    io.to(player.socketId).emit("roomUpdated", {
      room: room.toPublic(),
      you: player.toSelf(),
    });
  });
}

function emitGameState(io, room, extra) {
  const payload = Object.assign(
    {
      room: room.toPublic(),
      game: room.game ? room.game.toPublic() : null,
    },
    extra || {}
  );
  io.to("room:" + room.code).emit("gameUpdated", payload);
}

function joinSocketRoom(socket, roomCode) {
  socket.join("room:" + roomCode);
}

function leaveSocketRoom(socket, roomCode) {
  if (roomCode) socket.leave("room:" + roomCode);
}

function ackOrEmit(socket, event, payload, ack) {
  if (typeof ack === "function") {
    ack(payload);
    return;
  }
  socket.emit(event, payload);
}

function getActor(socket) {
  const room = roomManager.getRoomBySocket(socket.id);
  if (!room) return { ok: false, error: "Pas dans une salle" };
  const player = room.findPlayerBySocketId(socket.id);
  if (!player) return { ok: false, error: "Joueur introuvable" };
  return { ok: true, room: room, player: player };
}

function registerSocketHandlers(io) {
  io.on("connection", function (socket) {
    console.log("Client connecté:", socket.id);

    socket.emit("serverReady", {
      message: "Connecté au serveur du jeu de l'oie",
      socketId: socket.id,
    });

    socket.on("pingServer", function (payload, ack) {
      const response = {
        ok: true,
        echo: payload || null,
        serverTime: Date.now(),
      };
      ackOrEmit(socket, "pongServer", response, ack);
    });

    socket.on("createRoom", function (payload, ack) {
      const result = roomManager.createRoom(socket.id, payload || {});
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      joinSocketRoom(socket, result.room.code);
      const response = {
        ok: true,
        room: result.room.toPublic(),
        you: result.player.toSelf(),
      };
      ackOrEmit(socket, "roomUpdated", response, ack);
      console.log("Salle créée:", result.room.code, "par", result.player.name);
    });

    socket.on("joinRoom", function (payload, ack) {
      const result = roomManager.joinRoom(socket.id, payload || {});
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      joinSocketRoom(socket, result.room.code);
      emitRoomState(io, result.room);
      if (result.room.game) {
        emitGameState(io, result.room);
      }
      ackOrEmit(
        socket,
        "roomUpdated",
        { ok: true, room: result.room.toPublic(), you: result.player.toSelf() },
        ack
      );
      console.log(
        result.player.name,
        "a rejoint",
        result.room.code,
        result.room.status === "playing" ? "(partie en cours)" : "(lobby)"
      );
    });

    socket.on("reconnectRoom", function (payload, ack) {
      const result = roomManager.reconnectRoom(socket.id, payload || {});
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      joinSocketRoom(socket, result.room.code);
      emitRoomState(io, result.room);
      if (result.room.game) {
        emitGameState(io, result.room);
      }
      ackOrEmit(
        socket,
        "roomUpdated",
        { ok: true, room: result.room.toPublic(), you: result.player.toSelf() },
        ack
      );
      console.log(result.player.name, "reconnecté à", result.room.code);
    });

    socket.on("leaveRoom", function (_payload, ack) {
      const current = roomManager.getRoomBySocket(socket.id);
      const code = current ? current.code : null;
      const result = roomManager.leaveRoom(socket.id);

      leaveSocketRoom(socket, code);

      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      ackOrEmit(socket, "roomLeft", { ok: true }, ack);

      if (!result.roomEmpty && result.room) {
        emitRoomState(io, result.room);
        if (result.room.game) emitGameState(io, result.room);
      }

      console.log("Socket", socket.id, "a quitté", code || "?");
    });

    socket.on("setDiceCount", function (payload, ack) {
      const count = payload && Number(payload.count);
      const room = roomManager.getRoomBySocket(socket.id);
      const result = roomManager.setDiceCount(socket.id, count);

      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      if (room) emitRoomState(io, room);
      if (typeof ack === "function") {
        ack({ ok: true, room: room.toPublic() });
      }
    });

    socket.on("startGame", function (_payload, ack) {
      const room = roomManager.getRoomBySocket(socket.id);
      const result = roomManager.startGame(socket.id);

      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      if (room) {
        emitRoomState(io, room);
        const startedPayload = {
          room: room.toPublic(),
          game: room.game.toPublic(),
        };
        io.to("room:" + room.code).emit("gameStarted", startedPayload);
        emitGameState(io, room);
      }

      if (typeof ack === "function") {
        ack({
          ok: true,
          room: room.toPublic(),
          game: room.game.toPublic(),
        });
      }
      console.log("Partie démarrée:", room.code);
    });

    socket.on("rollDice", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.rollDice(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      const eventPayload = {
        room: actor.room.toPublic(),
        game: result.game,
        dice: result.dice || null,
        move: result.move || null,
        skippedBan: !!result.skippedBan,
      };

      io.to("room:" + actor.room.code).emit("diceRolled", eventPayload);
      emitGameState(io, actor.room, {
        dice: result.dice || null,
        move: result.move || null,
      });

      if (typeof ack === "function") ack({ ok: true, ...eventPayload });
    });

    socket.on("confirmLetter", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.confirmLetter(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("rerollLetter", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.rerollLetter(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      io.to("room:" + actor.room.code).emit("letterRerolled", {
        room: actor.room.toPublic(),
        game: result.game,
      });
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("confirmGenre", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.confirmGenre(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("rerollGenre", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.rerollGenre(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      io.to("room:" + actor.room.code).emit("genreRerolled", {
        room: actor.room.toPublic(),
        game: result.game,
      });
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("confirmMime", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.confirmMime(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("rerollMime", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.rerollMime(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      io.to("room:" + actor.room.code).emit("mimeRerolled", {
        room: actor.room.toPublic(),
        game: result.game,
      });
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("raceChatMessage", function (payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.submitRaceMessage(
        actor.player.id,
        payload && payload.text
      );
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("forceCloseRace", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.forceCloseRace(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("confirmRace", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.confirmRace(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("continueAfterVictory", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.continueAfterVictory(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room);
      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("restartGame", function (_payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.restartGame(actor.player.id);
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitRoomState(io, actor.room);
      emitGameState(io, actor.room);
      io.to("room:" + actor.room.code).emit("gameRestarted", {
        room: actor.room.toPublic(),
        game: result.game,
      });

      if (typeof ack === "function") {
        ack({ ok: true, game: result.game, room: actor.room.toPublic() });
      }
    });

    socket.on("moveToken", function (payload, ack) {
      const actor = getActor(socket);
      if (!actor.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: actor.error }, ack);
        return;
      }
      if (!actor.room.game) {
        ackOrEmit(socket, "roomError", { ok: false, error: "Partie non démarrée" }, ack);
        return;
      }

      const result = actor.room.game.moveToken(actor.player.id, payload || {});
      if (!result.ok) {
        ackOrEmit(socket, "roomError", { ok: false, error: result.error }, ack);
        return;
      }

      emitGameState(io, actor.room, { move: result.move || null });
      if (typeof ack === "function") {
        ack({
          ok: true,
          game: result.game,
          move: result.move,
          room: actor.room.toPublic(),
        });
      }
    });

    socket.on("disconnect", function (reason) {
      console.log("Client déconnecté:", socket.id, "(" + reason + ")");
      const result = roomManager.handleDisconnect(socket.id);
      if (result && result.room) {
        if (result.room.game) {
          result.room.game.skipIfCurrentOffline();
        }
        emitRoomState(io, result.room);
        if (result.room.game) emitGameState(io, result.room);
      }
    });
  });
}

module.exports = { registerSocketHandlers, roomManager };
