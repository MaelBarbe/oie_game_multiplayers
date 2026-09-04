# Guide de démarrage — Jouer en multijoueur depuis son PC

Ce guide est pour quelqu’un qui **vient de télécharger le jeu** et veut le lancer en multijoueur avec des amis.

Tu vas :

1. Installer ce qu’il faut (une seule fois)
2. Lancer le jeu sur ton PC
3. Ouvrir un lien Internet avec Cloudflare Tunnel
4. Inviter tes amis avec le lien + un code de salle

---

## Comment ça marche (en 30 secondes)

```text
Tes amis  →  Internet  →  Cloudflare Tunnel  →  ton PC  →  le jeu
```

Sur ton PC, **2 fenêtres** doivent rester ouvertes :

| Fenêtre | Rôle |
|--------|------|
| Terminal 1 | Lance le jeu (`npm start`) |
| Terminal 2 | Crée le lien public (`cloudflared`) |

Sans ces 2 fenêtres ouvertes, tes amis ne pourront pas jouer.

---

## Étape 1 — Ouvrir le dossier du jeu

1. Dézippe le jeu si besoin
2. Note le chemin du dossier (exemple) :
   ```text
   C:\Users\TonNom\Downloads\oie_game_multiplayers
   ```
3. Dans ce dossier, tu dois voir au minimum :
   - `package.json`
   - `server/`
   - `client/`

---

## Étape 2 — Installer Node.js (une seule fois)

Node.js sert à faire tourner le serveur du jeu.

1. Va sur : [https://nodejs.org](https://nodejs.org)
2. Télécharge la version **LTS**
3. Installe-la (options par défaut = OK)
4. **Ferme puis rouvre** ton terminal / PowerShell

Vérifie :

```powershell
node -v
npm -v
```

Tu dois voir des numéros de version (ex. `v20.x.x`).

---

## Étape 3 — Installer les fichiers du jeu (une seule fois)

1. Ouvre **PowerShell**
2. Va dans le dossier du jeu :

```powershell
cd "C:\Users\TonNom\Downloads\oie_game_multiplayers"
```

> Remplace le chemin par le tien.

3. Installe les dépendances :

```powershell
npm install
```

Attends la fin (ça peut prendre 1–2 minutes).  
Tu dois voir un dossier `node_modules` apparaître.

---

## Étape 4 — Installer Cloudflare Tunnel (une seule fois)

Ça sert à créer un lien `https://…` pour que tes amis rejoignent **sans ouvrir de ports** sur ta box.

Dans PowerShell :

```powershell
winget install --id Cloudflare.cloudflared -e
```

Puis **ferme et rouvre** PowerShell, et vérifie :

```powershell
cloudflared --version
```

Tu dois voir une version (ex. `2026.x.x`).

---

## Étape 5 — Lancer le jeu (Terminal 1)

Ouvre un **premier** PowerShell :

```powershell
cd "C:\Users\TonNom\Downloads\oie_game_multiplayers"
npm start
```

Tu dois voir :

```text
Serveur démarré sur http://localhost:3000
```

**Ne ferme pas cette fenêtre.**

Teste sur ton PC : ouvre [http://localhost:3000](http://localhost:3000)  
→ tu dois voir l’écran du lobby (créer / rejoindre une salle).

---

## Étape 6 — Ouvrir le tunnel Internet (Terminal 2)

Ouvre un **deuxième** PowerShell (laisse le premier ouvert) :

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

Attends quelques secondes. Une URL apparaît, du genre :

```text
https://something-random.trycloudflare.com
```

**Copie cette URL.** C’est le lien public du jeu.

**Ne ferme pas cette fenêtre non plus.**

---

## Étape 7 — Créer une salle et inviter tes amis

1. Sur **ton** navigateur, ouvre l’URL Cloudflare (`https://….trycloudflare.com`)
2. Entre ton **pseudo**
3. Clique sur **Créer une salle**
4. Tu obtiens un **code** (ex. `MAEL42`)
5. Envoie à tes amis :
   - le lien `https://….trycloudflare.com`
   - le **code de salle**

Eux :

1. Ouvrent le même lien
2. Entrent leur pseudo + le code
3. Cliquent sur **Rejoindre**

Quand tout le monde est là (minimum 2), l’**hôte** clique sur **Démarrer la partie**.

---

## Étape 8 — Pendant la partie

- Seul le joueur dont c’est le tour peut lancer les dés
- Tout le monde voit le même plateau
- Si quelqu’un gagne, il sort des tours et la partie continue
- L’hôte peut glisser un pion pour corriger une position

---

## Arrêter le jeu

Dans chaque PowerShell : `Ctrl + C`

Ensuite tu peux fermer les fenêtres.

---

## Relancer une prochaine fois

Tu n’as **plus** besoin de refaire les installations.

### Terminal 1 — le jeu

```powershell
cd "C:\Users\TonNom\Downloads\oie_game_multiplayers"
npm start
```

### Terminal 2 — le tunnel

```powershell
cloudflared tunnel --url http://127.0.0.1:3000
```

Copie la **nouvelle** URL affichée (elle change à chaque lancement avec le tunnel gratuit).

---

## Checklist rapide

- [ ] Node.js installé (`node -v`)
- [ ] `npm install` fait une fois dans le dossier
- [ ] `cloudflared` installé (`cloudflared --version`)
- [ ] Terminal 1 : `npm start` qui tourne
- [ ] Terminal 2 : `cloudflared tunnel ...` qui tourne
- [ ] URL Cloudflare copiée
- [ ] Salle créée + code partagé aux amis

---

## Problèmes fréquents

### `npm` ou `node` introuvable
→ Réinstalle Node.js LTS, puis **ferme/rouvre** le terminal.

### `cloudflared` introuvable
→ Réinstalle avec `winget`, puis **ferme/rouvre** le terminal.

### La page locale marche, mais pas le lien Cloudflare
→ Vérifie que **les 2 terminaux** sont bien ouverts en même temps.

### Mes amis ne peuvent pas rejoindre
→ Ils doivent utiliser **exactement** la même URL Cloudflare + le bon code de salle.

### “Port already in use” / port 3000 occupé
→ Un ancien `npm start` tourne encore. Ferme-le (`Ctrl + C`) ou redémarre le PC.

### Ça ne charge plus après une coupure
→ Relance Terminal 1 puis Terminal 2, et utilise la **nouvelle** URL.

### Test du serveur
Ouvre : [http://localhost:3000/health](http://localhost:3000/health)  
Tu dois voir quelque chose comme `{"ok":true,...}`.

---

## Astuces

- Garde les 2 fenêtres PowerShell bien visibles pendant toute la soirée
- Toi aussi, utilise l’URL Cloudflare (pas seulement `localhost`) pour être sûr que tout le monde est sur le même lien
- Le tunnel gratuit donne une URL **temporaire** qui change à chaque relance

---

## Autres guides

- Détails tunnel : `TUTO_TUNNEL.md`
- Héberger sur un VPS (24/7) : `TUTO_VPS.md`
