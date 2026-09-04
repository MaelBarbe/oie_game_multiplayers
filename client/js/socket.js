/**
 * Connexion Socket.IO côté client (étape 2).
 * Expose window.gameSocket pour les prochaines étapes.
 */
(function () {
  if (typeof io !== "function") {
    console.error("[socket] Socket.IO client introuvable");
    return;
  }

  const socket = io({
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
    // polling d'abord puis upgrade : plus fiable derrière Cloudflare / proxies
    transports: ["polling", "websocket"],
    upgrade: true,
  });

  window.gameSocket = socket;

  socket.on("connect", function () {
    console.log("[socket] Connecté — id:", socket.id);
  });

  socket.on("serverReady", function (data) {
    console.log("[socket] Serveur prêt:", data);
  });

  socket.on("disconnect", function (reason) {
    console.log("[socket] Déconnecté:", reason);
  });

  socket.on("connect_error", function (err) {
    console.error("[socket] Erreur de connexion:", err.message);
  });

  /** Test manuel depuis la console : window.testServerPing() */
  window.testServerPing = function (payload) {
    return new Promise(function (resolve, reject) {
      if (!socket.connected) {
        reject(new Error("Socket non connecté"));
        return;
      }
      socket.timeout(3000).emit("pingServer", payload || { hello: "oie" }, function (err, response) {
        if (err) {
          reject(err);
          return;
        }
        console.log("[socket] pong:", response);
        resolve(response);
      });
    });
  };
})();
