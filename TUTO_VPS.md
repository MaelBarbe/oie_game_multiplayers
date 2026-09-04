# Déployer le jeu sur un VPS

Tutoriel pas à pas pour héberger le jeu de l’oie multijoueur sur un serveur Linux (Ubuntu / Debian).

À la fin, le jeu sera accessible via une URL du type :

```text
https://oie.mondomaine.com
```

---

## Vue d’ensemble

```text
Joueurs (navigateur)
      │
      ▼
Internet → ton domaine (HTTPS)
      │
      ▼
Nginx (reverse proxy + WebSocket)
      │
      ▼
Node.js (npm start / systemd) → port 3000 en local
```

Fichiers d’exemple déjà dans le projet :

- `deploy/nginx.example.conf`
- `deploy/oie-game.service`
- `.env.example`

---

## Prérequis

- Un VPS Linux (Ubuntu 22.04 / 24.04 recommandé)
- Un accès SSH (`root` ou utilisateur sudo)
- Un **nom de domaine** pointant vers l’IP du VPS (enregistrement DNS `A`)

Exemple DNS :

| Type | Nom | Valeur |
|------|-----|--------|
| A | `oie` | `IP.DE.TON.VPS` |

---

## 1. Connexion au VPS

Depuis ton PC :

```bash
ssh root@IP.DE.TON.VPS
```

Met à jour le système :

```bash
apt update && apt upgrade -y
```

---

## 2. Installer Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

---

## 3. Installer Nginx et Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

---

## 4. Copier le projet sur le VPS

### Option A — avec Git (recommandé)

```bash
cd /opt
git clone URL_DE_TON_REPO oie-game-multiplayers
cd /opt/oie-game-multiplayers
npm install --omit=dev
```

### Option B — depuis ton PC (scp / sftp)

Sur ton PC (PowerShell) :

```powershell
scp -r C:\Users\Mael\Desktop\taff\Dev\oie_game_multiplayers root@IP.DE.TON.VPS:/opt/oie-game-multiplayers
```

Puis sur le VPS :

```bash
cd /opt/oie-game-multiplayers
npm install --omit=dev
```

> Ne copie pas le dossier `node_modules` si tu peux l’éviter : refais `npm install` sur le serveur.

---

## 5. Configurer les variables d’environnement

```bash
cd /opt/oie-game-multiplayers
cp .env.example .env
nano .env
```

Contenu recommandé en production :

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
TRUST_PROXY=1
```

- `HOST=127.0.0.1` → le jeu n’écoute qu’en local (Nginx s’occupe du public)
- `TRUST_PROXY=1` → correct derrière Nginx / Cloudflare

Enregistre : `Ctrl+O`, Entrée, puis `Ctrl+X`.

---

## 6. Tester le serveur à la main

```bash
cd /opt/oie-game-multiplayers
node server/server.js
```

Dans un autre SSH :

```bash
curl http://127.0.0.1:3000/health
```

Tu dois voir :

```json
{"ok":true,"env":"production"}
```

Arrête le test avec `Ctrl+C`.

---

## 7. Créer le service systemd (démarrage auto)

```bash
nano /etc/systemd/system/oie-game.service
```

Colle (adapte le chemin Node si besoin avec `which node`) :

```ini
[Unit]
Description=Jeu de l'oie multijoueur
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/oie-game-multiplayers
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=TRUST_PROXY=1
EnvironmentFile=-/opt/oie-game-multiplayers/.env
ExecStart=/usr/bin/node server/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> Tu peux aussi partir de `deploy/oie-game.service` dans le repo.

Active le service :

```bash
systemctl daemon-reload
systemctl enable oie-game
systemctl start oie-game
systemctl status oie-game
```

Doit afficher `active (running)`.

Commandes utiles :

```bash
systemctl restart oie-game
journalctl -u oie-game -f
```

---

## 8. Configurer Nginx

```bash
nano /etc/nginx/sites-available/oie-game
```

Remplace `oie.mondomaine.com` par ton vrai domaine :

```nginx
upstream oie_game {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name oie.mondomaine.com;

    location / {
        proxy_pass http://oie_game;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket (Socket.IO) — indispensable pour le multijoueur
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Active le site :

```bash
ln -s /etc/nginx/sites-available/oie-game /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

Teste :

```text
http://oie.mondomaine.com
```

---

## 9. HTTPS avec Let’s Encrypt (Certbot)

Le DNS `A` doit déjà pointer vers le VPS.

```bash
certbot --nginx -d oie.mondomaine.com
```

Suis les questions (email, accepter les CGU).  
Certbot configure HTTPS et le renouvellement auto.

Vérifie :

```text
https://oie.mondomaine.com
https://oie.mondomaine.com/health
```

---

## 10. Pare-feu (si ufw est actif)

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

Ne bloque pas SSH avant d’avoir autorisé `OpenSSH`.

---

## 11. Jouer

1. Ouvre `https://oie.mondomaine.com`
2. Crée une salle
3. Partage l’URL + le **code de salle** à tes amis

Plus besoin de Cloudflare Tunnel sur ton PC : le VPS reste allumé 24/7.

---

## Mettre à jour le jeu plus tard

```bash
cd /opt/oie-game-multiplayers
git pull
npm install --omit=dev
systemctl restart oie-game
```

Si tu déploies sans Git : recalcule les fichiers puis :

```bash
systemctl restart oie-game
```

---

## Checklist finale

- [ ] DNS pointe vers le VPS
- [ ] `npm install` OK
- [ ] `.env` en production (`HOST=127.0.0.1`, `TRUST_PROXY=1`)
- [ ] `systemctl status oie-game` → running
- [ ] Nginx OK (`nginx -t`)
- [ ] HTTPS OK (Certbot)
- [ ] `/health` répond
- [ ] 2 navigateurs peuvent rejoindre une salle et lancer les dés

---

## Problèmes fréquents

| Problème | Cause probable | Solution |
|---|---|---|
| 502 Bad Gateway | Node pas démarré | `systemctl status oie-game` / `journalctl -u oie-game -f` |
| Page OK mais pas de multi | WebSocket non proxifié | Vérifier les headers `Upgrade` / `Connection` dans Nginx |
| Certbot échoue | DNS pas prêt | Attendre la propagation DNS, retester |
| Permission denied | Mauvais user / chemin | Vérifier `WorkingDirectory` et `ExecStart` |
| Ancien code servi | Cache / service pas restart | `systemctl restart oie-game` + hard refresh navigateur |

---

## Sécurité (recommandé)

- Créer un utilisateur dédié (au lieu de `root`) pour le service
- Garder le système à jour : `apt update && apt upgrade`
- Ne pas exposer le port `3000` publiquement (reste en `127.0.0.1`)
- Sauvegarder régulièrement le dossier `/opt/oie-game-multiplayers` si tu ajoutes des données plus tard

---

## Alternative sans domaine

Tu peux temporairement utiliser un tunnel Cloudflare **depuis le VPS** :

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

Mais pour un vrai hébergement, domaine + Nginx + HTTPS reste la meilleure option.
