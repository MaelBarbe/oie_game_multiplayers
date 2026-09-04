/**
 * Données plateau minimales pour les règles serveur.
 * Aligné sur client/js/data.js (CELL_CONTENTS).
 */
const CELL_CONTENTS = [
  ["start", "🥂", "DÉPART|La soirée commence, préparez vos verres !"],
  ["imitate", "🎭", "MIME|Mime un personnage du type tiré"],
  ["race", "⌨️", "CHAT GG|Le dernier à écrire GG boit|GG"],
  ["normal", "🍺", "|Bois 2 gorgées"],
  ["normal", "🎮", "|Le plus haut elo sur LOL boit"],
  ["aegis", "🛡️", "AEGIS OF VALOR|Distribue 2 gorgées et rejoue"],
  ["normal", "😌", "|Chill, rien ne se passe"],
  ["normal", "🍷", "|Les filles boivent"],
  ["genre", "🔫", "GENRE ALÉATOIRE|Cite 3 jeux du genre tiré"],
  ["imitate", "🎮", "MIME|Mime un personnage du type tiré"],
  ["normal", "🍻", "|Distribue 5 gorgées"],
  ["normal", "➡️", "|Avance de 3 cases"],
  ["ban", "🚫", "BAN !|En prison pour un tour et bois 3 gorgées"],
  ["normal", "🍺", "|Les hommes boivent"],
  ["normal", "🔴", "|Bois si tu as plus de rouge que de bleu dans ton historique"],
  ["normal", "💬", "|Le dernier à dire FUCK KC boit 3 gorgées"],
  ["letter", "🎮", "|Cite 3 champions de LOL qui commencent par la lettre…"],
  ["duel", "⚔️", "DUEL DE THÈME|"],
  ["normal", "🍺", "|Bois 3 gorgées"],
  ["normal", "🍺", "|La personne au-dessus de toi boit 2 gorgées"],
  ["normal", "😌", "|Chill, rien ne se passe"],
  ["aegis", "🛡️", "AEGIS OF VALOR|Distribue 2 gorgées et rejoue"],
  ["normal", "🍻", "|Distribue 3 gorgées"],
  ["normal", "🍺", "|Tout le monde boit !"],
  ["paint", "🎨", "PAINT TIME|"],
  ["ban", "🚫", "BAN !|En prison pour un tour et bois 3 gorgées"],
  ["normal", "🎮", "|Le plus bas elo sur LOL boit"],
  ["duel", "⚔️", "DUEL DE THÈME|"],
  ["normal", "⬅️", "|Recule de 3 cases"],
  ["imitate", "🦸", "MIME|Mime un personnage du type tiré"],
  ["normal", "🍺", "|Bois 3 gorgées"],
  ["paint", "🎨", "PAINT TIME|"],
  ["lag", "🐌", "LAAAAAG !|Ping catastrophique, recule à la case 24 et bois 4 gorgées"],
  ["race", "⌨️", "CHAT GG|Le dernier à écrire GG boit|GG"],
  ["ban", "🚫", "BAN !|En prison pour un tour et bois 3 gorgées"],
  ["normal", "🍺", "|La personne en dessous de toi boit 3 gorgées"],
  ["imitate", "🎭", "MIME|Mime un personnage du type tiré"],
  ["normal", "👥", "|Choisis un duo, buvez 8 gorgées réparties entre vous deux"],
  ["genre", "🔫", "GENRE ALÉATOIRE|Cite 3 jeux du genre tiré"],
  ["normal", "🍻", "|Distribue 5 gorgées"],
  ["normal", "🍺", "|Bois 4 gorgées"],
  ["aegis", "🛡️", "AEGIS OF VALOR|Distribue 2 gorgées et rejoue"],
  ["normal", "✂️", "|Shifumi en 1, 3 gorgées pour le perdant"],
  ["normal", "🍺", "|Bois  3 gorgées si tu as perdu ta dernière game  sinon distribue les"],
  ["normal", "🍺", "|Bois 3 gorgées"],
  ["normal", "🍺", "|Distribue 3 gorgées"],
  ["letter", "🎬", "|Cite 3 films qui commencent par la lettre…"],
  ["normal", "🍺", "|Tout le monde boit !"],
  ["victory", "🏆", "VICTOIRE !|Distribue un cul-sec"],
];

/** num (1-based) -> { category, icon, label, body } */
const CELLS_BY_NUM = {};
CELL_CONTENTS.forEach(function (content, i) {
  const num = i + 1;
  const parts = String(content[2] || "").split("|");
  CELLS_BY_NUM[num] = {
    num: num,
    category: content[0],
    icon: content[1],
    label: parts[0] || "",
    body: parts[1] || parts[0] || "",
    keyword: (parts[2] || "").trim() || null,
  };
});

const MAX_CELL = CELL_CONTENTS.length;

function cellCategory(num) {
  const cell = CELLS_BY_NUM[num];
  return cell ? cell.category : null;
}

function cellPrompt(num) {
  const cell = CELLS_BY_NUM[num];
  if (!cell) return "Cite 3 choses qui commencent par la lettre :";
  const body = (cell.body || "").trim();
  if (!body) return "Cite 3 choses qui commencent par la lettre :";
  return body.replace(/…\s*$/, "").replace(/\s+$/, "") + " :";
}

function cellKeyword(num) {
  const cell = CELLS_BY_NUM[num];
  return cell && cell.keyword ? cell.keyword : null;
}

module.exports = {
  CELL_CONTENTS,
  CELLS_BY_NUM,
  MAX_CELL,
  cellCategory,
  cellPrompt,
  cellKeyword,
};
