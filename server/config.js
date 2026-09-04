/**
 * Configuration runtime (env).
 * Compatible local, Cloudflare Tunnel, reverse proxy, VPS.
 */
function parseCorsOrigin(value) {
  if (value == null || value === "") return true; // reflet de l'origine (dev / même domaine)
  if (value === "*") return "*";
  return value.split(",").map(function (s) {
    return s.trim();
  }).filter(Boolean);
}

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT) || 3000,
  trustProxy: process.env.TRUST_PROXY !== "0",
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  // Timeouts un peu plus larges derrière Cloudflare / tunnels
  pingInterval: Number(process.env.SOCKET_PING_INTERVAL) || 25000,
  pingTimeout: Number(process.env.SOCKET_PING_TIMEOUT) || 60000,
};

module.exports = { config };
