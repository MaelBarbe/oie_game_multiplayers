const boardEl = document.getElementById("board");
const cellEls = {}; // num -> element
let boardNativeW = 0;
let boardNativeH = 0;

function getBoardMetrics(){
  const css = getComputedStyle(document.documentElement);
  return {
    cellW: parseFloat(css.getPropertyValue("--cellW")) || 198,
    cellH: parseFloat(css.getPropertyValue("--cellH")) || 152,
    gap: parseFloat(css.getPropertyValue("--gap")) || 24,
    marginX: parseFloat(css.getPropertyValue("--marginX")) || 22,
    topOff: parseFloat(css.getPropertyValue("--top")) || 16,
    boardBottom: parseFloat(css.getPropertyValue("--boardBottom")) || 16,
  };
}

function cellPos(row, col, metrics){
  const { cellW, cellH, gap, marginX, topOff } = metrics;
  return {
    x: marginX + (col - 1) * (cellW + gap),
    y: topOff + (row - 1) * (cellH + gap),
  };
}

function cellCenter(row, col, metrics){
  const { x, y } = cellPos(row, col, metrics);
  return {
    cx: x + metrics.cellW / 2,
    cy: y + metrics.cellH / 2,
  };
}

/** Flèche quasi entièrement dans l'écart, léger chevauchement sur les bords. */
function arrowSegment(a, b, metrics){
  const from = cellCenter(a[0], a[1], metrics);
  const to = cellCenter(b[0], b[1], metrics);
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const intoCell = 6; // dépasse très peu sur les cases
  const half = (Math.abs(dx) >= Math.abs(dy) ? metrics.cellW : metrics.cellH) / 2;

  return {
    x1: from.cx + ux * (half - intoCell),
    y1: from.cy + uy * (half - intoCell),
    x2: to.cx - ux * (half - intoCell),
    y2: to.cy - uy * (half - intoCell),
    ux: ux,
    uy: uy,
  };
}

function appendArrow(svg, seg){
  const { x1, y1, x2, y2, ux, uy } = seg;
  const px = -uy;
  const py = ux;
  const headLen = 11;
  const headSpread = 8;

  // Embout de la tige (avant la pointe)
  const bx = x2 - ux * headLen;
  const by = y2 - uy * headLen;

  // Ailes de la pointe en V
  const w1x = x2 - ux * headLen + px * headSpread;
  const w1y = y2 - uy * headLen + py * headSpread;
  const w2x = x2 - ux * headLen - px * headSpread;
  const w2y = y2 - uy * headLen - py * headSpread;

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", "flow-arrow");

  // Ombre douce (trait plus épais derrière)
  const shaftShadow = document.createElementNS("http://www.w3.org/2000/svg", "line");
  shaftShadow.setAttribute("x1", x1);
  shaftShadow.setAttribute("y1", y1);
  shaftShadow.setAttribute("x2", bx);
  shaftShadow.setAttribute("y2", by);
  shaftShadow.setAttribute("class", "flow-arrow-shadow");
  g.appendChild(shaftShadow);

  const headShadow = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  headShadow.setAttribute("points", [w1x, w1y, x2, y2, w2x, w2y].join(" "));
  headShadow.setAttribute("class", "flow-arrow-shadow");
  g.appendChild(headShadow);

  // Flèche blanche style UI (bouts arrondis)
  const shaft = document.createElementNS("http://www.w3.org/2000/svg", "line");
  shaft.setAttribute("x1", x1);
  shaft.setAttribute("y1", y1);
  shaft.setAttribute("x2", bx);
  shaft.setAttribute("y2", by);
  shaft.setAttribute("class", "flow-arrow-stroke");
  g.appendChild(shaft);

  const head = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  head.setAttribute("points", [w1x, w1y, x2, y2, w2x, w2y].join(" "));
  head.setAttribute("class", "flow-arrow-stroke");
  g.appendChild(head);

  svg.appendChild(g);
}

function pathDirection(a, b){
  const dr = b[0] - a[0];
  const dc = b[1] - a[1];
  if(Math.abs(dc) >= Math.abs(dr)) return dc > 0 ? "right" : "left";
  return dr > 0 ? "down" : "up";
}

function buildArrowLayer(sorted, metrics){
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("id", "arrow-layer");
  svg.setAttribute("width", String(boardNativeW));
  svg.setAttribute("height", String(boardNativeH));
  svg.setAttribute("viewBox", "0 0 " + boardNativeW + " " + boardNativeH);
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.width = boardNativeW + "px";
  svg.style.height = boardNativeH + "px";
  svg.style.zIndex = "8";
  svg.style.pointerEvents = "none";
  svg.style.overflow = "visible";

  // Départ + virages uniquement
  if(sorted.length > 1){
    appendArrow(svg, arrowSegment(sorted[0], sorted[1], metrics));
  }
  for(let i = 1; i < sorted.length - 1; i++){
    const prevDir = pathDirection(sorted[i - 1], sorted[i]);
    const nextDir = pathDirection(sorted[i], sorted[i + 1]);
    if(prevDir === nextDir) continue;
    appendArrow(svg, arrowSegment(sorted[i], sorted[i + 1], metrics));
  }

  boardEl.appendChild(svg);
}

function buildBoard(){
  const metrics = getBoardMetrics();
  const { cellW, cellH, gap, marginX, topOff, boardBottom } = metrics;
  const cols = (typeof BOARD_COLS === "number") ? BOARD_COLS : 7;
  const rows = (typeof BOARD_ROWS === "number") ? BOARD_ROWS : 7;

  boardNativeW = marginX * 2 + cellW * cols + gap * (cols - 1);
  boardNativeH = topOff + cellH * rows + gap * (rows - 1) + boardBottom;
  boardEl.style.width = boardNativeW + "px";
  boardEl.style.height = boardNativeH + "px";

  CELLS.forEach(c=>{
    const [row, col, num, cat, icon, text] = c;
    const { x, y } = cellPos(row, col, metrics);
    const [label, body] = text.split("|");
    const div = document.createElement("div");
    div.className = "cell cat-" + cat;
    div.style.left = x + "px";
    div.style.top = y + "px";
    div.dataset.num = num;

    const bigClass = (BIG_LABEL_CATS.includes(cat) && !label) ? "big" : "";
    let fontSize = 15;
    if(body.length > 70) fontSize = 12.5;
    else if(body.length > 45) fontSize = 13.5;

    div.innerHTML = `
      <div class="cell-head">
        <div class="num">${num}</div>
        <div class="icon">${icon}</div>
      </div>
      <div class="cell-content">
        ${label ? `<div class="label">${label}</div>` : ""}
        <div class="body ${bigClass}" style="font-size:${fontSize}px">${body}</div>
      </div>
      <div class="tokenslot" data-slot="${num}"></div>
    `;
    boardEl.appendChild(div);
    cellEls[num] = div;

    if(cat === "letter"){
      div.title = "Case lettre";
      div.addEventListener("click", function(e){
        if(e.target.closest(".token")) return;
        // En multijoueur, la lettre est gérée par le serveur (évite de bloquer la partie)
        if(window.gameClient) return;
        if(typeof openLetterModal === "function"){
          openLetterModal(null, typeof cellPrompt === "function" ? cellPrompt(num) : null);
        }
      });
    }
  });

  const sorted = CELLS.slice().sort(function(a, b){ return a[2] - b[2]; });
  buildArrowLayer(sorted, metrics);
}

function fitBoard(){
  const wrap = document.getElementById("board-wrap");
  const layout = document.querySelector(".layout");
  const panel = document.getElementById("panel");

  const gapPx = 16;
  const availW = layout.clientWidth - panel.offsetWidth - gapPx;
  const availH = layout.clientHeight;

  let scale = Math.min(availW / boardNativeW, availH / boardNativeH);
  if(scale < 0.35) scale = 0.35;

  boardEl.style.transform = "scale(" + scale + ")";
  wrap.style.width = (boardNativeW * scale) + "px";
  wrap.style.height = (boardNativeH * scale) + "px";
}
