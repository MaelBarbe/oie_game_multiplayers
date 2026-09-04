const BOARD_COLS = 7;
const BOARD_ROWS = 7;

/** Génère les positions [row, col] d'un escargot (départ en haut à gauche, sens horaire). */
function generateSpiralPositions(rows, cols){
  const result = [];
  let r = 0, c = 0, dr = 0, dc = 1;
  const seen = [];
  for(let i = 0; i < rows; i++){
    seen[i] = [];
    for(let j = 0; j < cols; j++) seen[i][j] = false;
  }
  for(let n = 0; n < rows * cols; n++){
    result.push([r + 1, c + 1]);
    seen[r][c] = true;
    const nr = r + dr;
    const nc = c + dc;
    if(nr < 0 || nr >= rows || nc < 0 || nc >= cols || seen[nr][nc]){
      const ndr = dc;
      const ndc = -dr;
      dr = ndr;
      dc = ndc;
    }
    r += dr;
    c += dc;
  }
  return result;
}

// Contenu des cases dans l'ordre du parcours (1 → N)
// Les 7 cases avant la victoire sont des placeholders à remplir plus tard.
const CELL_CONTENTS = [
  ["start","🥂","DÉPART|La soirée commence, préparez vos verres !"],
  ["imitate","🎭","MIME|Mime un personnage du type tiré"],
  ["race","⌨️","CHAT GG|Le dernier à écrire GG boit|GG"],
  ["normal","🍺","|Bois 2 gorgées"],
  ["normal","🎮","|Le plus haut elo sur LOL boit"],
  ["aegis","🛡️","AEGIS OF VALOR|Distribue 2 gorgées et rejoue"],
  ["normal","😌","|Chill, rien ne se passe"],
  ["normal","🍷","|Les filles boivent"],
  ["genre","🔫","GENRE ALÉATOIRE|Cite 3 jeux du genre tiré"],
  ["imitate","🎮","MIME|Mime un personnage du type tiré"],
  ["normal","🍻","|Distribue 5 gorgées"],
  ["normal","➡️","|Avance de 3 cases"],
  ["ban","🚫","BAN !|En prison pour un tour et bois 3 gorgées"],
  ["normal","🍺","|Les hommes boivent"],
  ["normal","🔴","|Bois si tu as plus de rouge que de bleu dans ton historique"],
  ["normal","💬","|Le dernier à dire FUCK KC boit 3 gorgées"],
  ["letter","🎮","|Cite 3 champions de LOL qui commencent par la lettre…"],
  ["duel","⚔️","DUEL DE THÈME|"],
  ["normal","🍺","|Bois 3 gorgées"],
  ["normal","🍺","|La personne au-dessus de toi boit 2 gorgées"],
  ["normal","😌","|Chill, rien ne se passe"],
  ["aegis","🛡️","AEGIS OF VALOR|Distribue 2 gorgées et rejoue"],
  ["normal","🍻","|Distribue 3 gorgées"],
  ["normal","🍺","|Tout le monde boit !"],
  ["paint","🎨","PAINT TIME|"],
  ["ban","🚫","BAN !|En prison pour un tour et bois 3 gorgées"],
  ["normal","🎮","|Le plus bas elo sur LOL boit"],
  ["duel","⚔️","DUEL DE THÈME|"],
  ["normal","⬅️","|Recule de 3 cases"],
  ["imitate","🦸","MIME|Mime un personnage du type tiré"],
  ["normal","🍺","|Bois 3 gorgées"],
  ["paint","🎨","PAINT TIME|"],
  ["lag","🐌","LAAAAAG !|Ping catastrophique, recule à la case 24 et bois 4 gorgées"],
  ["race","⌨️","CHAT GG|Le dernier à écrire GG boit|GG"],
  ["ban","🚫","BAN !|En prison pour un tour et bois 3 gorgées"],
  ["normal","🍺","|La personne en dessous de toi boit 3 gorgées"],
  ["imitate","🎭","MIME|Mime un personnage du type tiré"],
  ["normal","👥","|Choisis un duo, buvez 8 gorgées réparties entre vous deux"],
  ["genre","🔫","GENRE ALÉATOIRE|Cite 3 jeux du genre tiré"],
  ["normal","🍻","|Distribue 5 gorgées"],
  ["normal","🍺","|Bois 4 gorgées"],
  ["aegis","🛡️","AEGIS OF VALOR|Distribue 2 gorgées et rejoue"],
  ["normal","✂️","|Shifumi en 1, 3 gorgées pour le perdant"],
  ["normal","🍺","|Bois  3 gorgées si tu as perdu ta dernière game  sinon distribue les"],
  ["normal","🍺","|Bois 3 gorgées"],
  ["normal","🍺","|Distribue 3 gorgées"],
  ["letter","🎬","|Cite 3 films qui commencent par la lettre…"],
  ["normal","🍺","|Tout le monde boit !"],
  ["victory","🏆","VICTOIRE !|Distribue un cul-sec"],
];

const SPIRAL = generateSpiralPositions(BOARD_ROWS, BOARD_COLS);

// Cases du plateau : [row, col, num, category, icon, "LABEL|texte"]
const CELLS = SPIRAL.map(function(pos, i){
  const content = CELL_CONTENTS[i] || ["soon","✨","|À venir"];
  return [pos[0], pos[1], i + 1, content[0], content[1], content[2]];
});

const BIG_LABEL_CATS = ["start","victory","aegis","ban","duel","paint","lag","letter","genre","race","soon"];

const PLAYER_COLORS = [
  "#ff5fa2","#22d3ee","#a855f7","#22c55e","#fb923c",
  "#e8b64f","#60a5fa","#f472b6","#34d399","#f87171"
];

const STORAGE_KEY = "oie_alcool_game_state";
const DEFAULT_PLAYER_COUNT = 4;
const MIN_PLAYERS = 0;
const MAX_PLAYERS = PLAYER_COLORS.length;
