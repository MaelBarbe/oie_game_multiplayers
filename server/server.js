require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { config } = require("./config");
const { registerSocketHandlers } = require("./socket/handlers");

const app = express();
const server = http.createServer(app);

if (config.trustProxy) {
  app.set("trust proxy", 1);
}

const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  allowUpgrades: true,
  pingInterval: config.pingInterval,
  pingTimeout: config.pingTimeout,
});

const clientDir = path.join(__dirname, "..", "client");

app.get("/health", function (_req, res) {
  res.status(200).json({
    ok: true,
    env: config.nodeEnv,
  });
});

app.use(express.static(clientDir, {
  index: "index.html",
  fallthrough: true,
}));

// SPA-like fallback (ne capture pas /socket.io ni /health)
app.get("*path", function (req, res, next) {
  if (req.path.startsWith("/socket.io")) return next();
  res.sendFile(path.join(clientDir, "index.html"));
});

registerSocketHandlers(io);

server.listen(config.port, config.host, function () {
  console.log(
    "Serveur démarré sur http://" +
      (config.host === "0.0.0.0" ? "localhost" : config.host) +
      ":" +
      config.port +
      " (bind " +
      config.host +
      ")"
  );
  console.log("Healthcheck: /health");
});
