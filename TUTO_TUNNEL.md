# Lancer le jeu + Cloudflare Tunnel

Tutoriel rapide pour jouer en ligne avec des amis depuis ton PC.

---

## Principe

Tu as besoin de **2 programmes** en même temps :

1. **Le serveur du jeu** (`npm start`) → tourne en local sur le port 3000  
2. **Cloudflare Tunnel** (`cloudflared`) → expose ton jeu sur Internet avec une URL `https://…`

```text
Amis (navigateur)
      │
      ▼
Internet (Cloudflare)
      │
      ▼
cloudflared  (sur ton PC)
      │
      ▼
npm start    →  http://127.0.0.1:3000
```

---

## Prérequis (une seule fois)

### 1. Node.js

Vérifie que Node est installé :

```powershell
node -v
npm -v
```

Si ce n’est pas le cas : [https://nodejs.org](https://nodejs.org)

### 2. Dépendances du projet

Dans le dossier du projet :

```powershell
cd C:\Users\Mael\Desktop\taff\Dev\oie_game_multiplayers
npm install
```

### 3. Cloudflare Tunnel (`cloudflared`)

Installation (Windows) :

```powershell
winget install --id Cloudflare.cloudflared -e
```

Vérifie :

```powershell
cloudflared --version
```

> Si la commande n’est pas trouvée, ferme et rouvre le terminal (pour recharger le PATH).

---

## Lancer une partie en ligne

### Étape A — Démarrer le jeu

Ouvre un **premier terminal** :

```powershell
cd C:\Users\Mael\Desktop\taff\Dev\oie_game_multiplayers
npm start
```

Tu dois voir quelque chose comme :

```text
Serveur démarré sur http://localhost:3000 (bind 0.0.0.0)
Healthcheck: /health
```

Laisse ce terminal **ouvert**.

Tu peux tester en local : [http://localhost:3000](http://localhost:3000)

---

### Étape B — Ouvrir le tunnel Cloudflare

Ouvre un **deuxième terminal** :

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

Au bout de quelques secondes, une URL apparaît, du type :

```text
https://xxxxx-xxxxx-xxxxx.trycloudflare.com
```

**Copie cette URL** — c’est le lien public du jeu.

Laisse aussi ce terminal **ouvert**.

---

### Étape C — Jouer avec des amis

1. Ouvre l’URL Cloudflare dans ton navigateur  
2. Crée une salle (tu obtiens un code, ex. `MAEL42`)  
3. Envoie à tes amis :
   - l’URL `https://….trycloudflare.com`
   - le **code de salle**
4. Ils rejoignent avec le code → tu démarres la partie

---

## Arrêter

Dans chaque terminal : `Ctrl + C`

- Si tu coupes `npm start` → plus de jeu  
- Si tu coupes `cloudflared` → plus d’accès Internet (le local marche encore)

---

## Relancer plus tard

Toujours dans cet ordre :

```powershell
# Terminal 1
cd C:\Users\Mael\Desktop\taff\Dev\oie_game_multiplayers
npm start

# Terminal 2
cloudflared tunnel --url http://127.0.0.1:3000
```

Puis récupère la **nouvelle** URL dans le terminal 2.

> Avec le tunnel rapide (gratuit, sans compte), l’URL **change à chaque lancement**.

---

## Problèmes fréquents

| Problème | Solution |
|---|---|
| `cloudflared` introuvable | Rouvrir le terminal, ou réinstaller avec `winget` |
| Page Cloudflare inaccessible | Vérifier que `npm start` tourne bien |
| Amis ne voient pas le jeu | Vérifier que les 2 terminaux sont ouverts |
| Erreur de connexion Socket | Recharger la page sur l’URL Cloudflare |
| Port déjà utilisé | Fermer l’ancien `npm start`, ou changer `PORT` dans `.env` |

Test rapide du serveur :

```text
http://localhost:3000/health
```

Doit répondre : `{"ok":true,...}`

---

## Mode développement (optionnel)

Pour recharger le serveur automatiquement après une modif de code :

```powershell
npm run dev
```

Le tunnel Cloudflare reste identique :

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

---

## Aller plus loin

- Exemple de tunnel **avec domaine fixe** : `deploy/cloudflare-tunnel.example.yml`  
- Déploiement **VPS + Nginx** : `deploy/nginx.example.conf` + `deploy/oie-game.service`
