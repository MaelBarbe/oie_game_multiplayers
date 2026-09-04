const benchEl = document.getElementById("bench");
let dragState = null;
let tokensCanDrag = null;

/** Texte sombre ou clair selon la luminance de la couleur du pion. */
function contrastTextForColor(hex){
  if(!hex || typeof hex !== "string" || hex.charAt(0) !== "#") return "#1a1440";
  let r, g, b;
  if(hex.length === 4){
    r = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    g = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    b = parseInt(hex.charAt(3) + hex.charAt(3), 16);
  } else if(hex.length === 7){
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    return "#1a1440";
  }
  if(Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "#1a1440";
  // Luminance relative (approx. sRGB)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? "#1a1440" : "#ffffff";
}

function renderTokens(players, onMoved, currentPlayerId, canDragFn){
  tokensCanDrag = typeof canDragFn === "function" ? canDragFn : null;

  Object.values(cellEls).forEach(el=>{
    const slot = el.querySelector(".tokenslot");
    if(slot) slot.innerHTML = "";
  });
  if(benchEl) benchEl.innerHTML = "";

  players.forEach((p, index)=>{
    const slot = (p.cell === 0)
      ? benchEl
      : (cellEls[p.cell] && cellEls[p.cell].querySelector(".tokenslot"));
    if(!slot) return;

    const banned = (p.skipTurns || 0) > 0;
    const active = p.id === currentPlayerId;
    const finished = !!p.finished;
    const tok = document.createElement("div");
    tok.className = "token"
      + (banned ? " token-banned" : "")
      + (active ? " token-active" : "")
      + (finished ? " token-finished" : "");
    tok.style.background = p.color;
    tok.style.color = finished ? "#1a1440" : contrastTextForColor(p.color);
    tok.textContent = finished ? "🏆" : String(index + 1);
    tok.dataset.playerId = String(p.id);
    tok.setAttribute("role", "listitem");
    tok.setAttribute(
      "aria-label",
      p.name
        + (finished ? ", gagné" : "")
        + (p.cell === 0 ? ", hors jeu" : ", case " + p.cell)
        + (banned ? ", BAN" : "")
        + (active ? ", à jouer" : "")
    );
    tok.title = p.name
      + (finished ? " — gagné (hors tours)" : "")
      + (p.cell === 0 ? " — hors jeu" : " — case " + p.cell)
      + (banned ? " — 🚫 passe 1 tour" : "")
      + (active ? " — à jouer" : "");
    slot.appendChild(tok);
    if(!finished) attachDrag(tok, players, onMoved);
  });
}

function clearDragStyles(tok){
  tok.classList.remove("dragging");
  tok.style.left = "";
  tok.style.top = "";
  tok.style.width = "";
  tok.style.height = "";
  tok.style.pointerEvents = "";
}

function attachDrag(tok, players, onMoved){
  function onPointerMove(e){
    if(!dragState || String(dragState.playerId) !== String(tok.dataset.playerId)) return;
    dragState.lastX = e.clientX;
    dragState.lastY = e.clientY;
    tok.style.left = (e.clientX - dragState.offsetX) + "px";
    tok.style.top = (e.clientY - dragState.offsetY) + "px";

    document.querySelectorAll(".drop-hover").forEach(c=>c.classList.remove("drop-hover"));
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const cellDiv = target ? target.closest(".cell") : null;
    const onBench = target ? target.closest("#bench") : null;
    if(cellDiv) cellDiv.classList.add("drop-hover");
    else if(onBench && benchEl) benchEl.classList.add("drop-hover");
  }

  function endDrag(e){
    if(!dragState || String(dragState.playerId) !== String(tok.dataset.playerId)) return;

    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", endDrag, true);
    window.removeEventListener("pointercancel", endDrag, true);

    document.querySelectorAll(".drop-hover").forEach(c=>c.classList.remove("drop-hover"));

    const fromCell = dragState.fromCell;
    const playerId = dragState.playerId;
    const clientX = (e && e.clientX != null) ? e.clientX : dragState.lastX;
    const clientY = (e && e.clientY != null) ? e.clientY : dragState.lastY;
    const target = document.elementFromPoint(clientX, clientY);
    const cellDiv = target ? target.closest(".cell") : null;
    const toCell = cellDiv ? parseInt(cellDiv.dataset.num, 10) : 0;

    dragState = null;

    clearDragStyles(tok);
    if(tok.parentNode) tok.remove();

    if(onMoved) onMoved({ playerId: playerId, fromCell: fromCell, toCell: toCell });
  }

  tok.addEventListener("pointerdown", (e)=>{
    if(tokensCanDrag && !tokensCanDrag()) return;

    e.preventDefault();
    e.stopPropagation();

    const playerId = tok.dataset.playerId;
    const player = findPlayer(players, playerId);
    if(!player) return;
    if((player.skipTurns || 0) > 0) return;

    const rect = tok.getBoundingClientRect();

    dragState = {
      playerId: playerId,
      fromCell: player.cell,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      lastX: e.clientX,
      lastY: e.clientY,
    };

    document.body.appendChild(tok);
    tok.classList.add("dragging");
    tok.style.width = rect.width + "px";
    tok.style.height = rect.height + "px";
    tok.style.left = rect.left + "px";
    tok.style.top = rect.top + "px";
    tok.style.pointerEvents = "none";

    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", endDrag, true);
    window.addEventListener("pointercancel", endDrag, true);
  });
}
