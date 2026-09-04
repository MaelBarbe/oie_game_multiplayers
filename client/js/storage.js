function findPlayer(players, id){
  for(let i = 0; i < players.length; i++){
    if(players[i].id === id) return players[i];
  }
  return null;
}

function playerTokenNumber(players, id){
  for(let i = 0; i < players.length; i++){
    if(players[i].id === id) return i + 1;
  }
  return "?";
}

function clamp(n, min, max){
  return Math.max(min, Math.min(max, n));
}

function hslToHex(h, s, l){
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if(h < 60){ r = c; g = x; }
  else if(h < 120){ r = x; g = c; }
  else if(h < 180){ g = c; b = x; }
  else if(h < 240){ g = x; b = c; }
  else if(h < 300){ r = x; b = c; }
  else { r = c; b = x; }
  const toHex = function(v){
    const n = Math.round((v + m) * 255);
    return (n < 16 ? "0" : "") + n.toString(16);
  };
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function colorFromHue(h){
  return hslToHex(h, 72, 58);
}

function hexToHue(hex){
  if(!hex || hex.charAt(0) !== "#" || (hex.length !== 7 && hex.length !== 4)) return 0;
  let r, g, b;
  if(hex.length === 4){
    r = parseInt(hex.charAt(1) + hex.charAt(1), 16) / 255;
    g = parseInt(hex.charAt(2) + hex.charAt(2), 16) / 255;
    b = parseInt(hex.charAt(3) + hex.charAt(3), 16) / 255;
  } else {
    r = parseInt(hex.slice(1, 3), 16) / 255;
    g = parseInt(hex.slice(3, 5), 16) / 255;
    b = parseInt(hex.slice(5, 7), 16) / 255;
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if(d < 0.0001) return 0;
  let h;
  if(max === r) h = ((g - b) / d) % 6;
  else if(max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if(h < 0) h += 360;
  return h;
}

function hueDistance(a, b){
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function isColorTooClose(color, otherColor, minDeg){
  return hueDistance(hexToHue(color), hexToHue(otherColor)) < (minDeg || 18);
}

function pickUniqueColor(players){
  for(let h = 0; h < 360; h += 18){
    const hex = colorFromHue(h);
    const clash = players.some(function(p){ return isColorTooClose(hex, p.color, 18); });
    if(!clash) return hex;
  }
  return colorFromHue(Math.random() * 360);
}

function ensureUniqueColors(players){
  for(let i = 0; i < players.length; i++){
    const others = players.filter(function(_, j){ return j !== i; });
    const clash = others.some(function(p){ return isColorTooClose(players[i].color, p.color, 18); });
    if(!players[i].color || clash){
      players[i].color = pickUniqueColor(others);
    }
  }
}

function normalizeCell(value){
  const cell = Number(value);
  if(!Number.isFinite(cell) || cell <= 0) return 0;
  const num = Math.floor(cell);
  for(let i = 0; i < CELLS.length; i++){
    if(CELLS[i][2] === num) return num;
  }
  return 0;
}

function cellCategory(num){
  for(let i = 0; i < CELLS.length; i++){
    if(CELLS[i][2] === num) return CELLS[i][3];
  }
  return null;
}

function cellPrompt(num){
  for(let i = 0; i < CELLS.length; i++){
    if(CELLS[i][2] === num){
      const parts = String(CELLS[i][5] || "").split("|");
      const body = (parts[1] || parts[0] || "").trim();
      if(!body) return "Cite 3 choses qui commencent par la lettre :";
      return body.replace(/…\s*$/, "").replace(/\s+$/, "") + " :";
    }
  }
  return "Cite 3 choses qui commencent par la lettre :";
}

function normalizeSkipTurns(value){
  const n = Number(value);
  if(!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(3, Math.floor(n));
}

/** Applique les effets de case après un déplacement (ex. BAN). */
function applyMoveEffects(player, fromCell, toCell){
  if(!player || toCell === fromCell) return;
  if(cellCategory(toCell) === "ban"){
    player.skipTurns = 1;
  }
}

function clearPlayerStatuses(players){
  players.forEach(function(p){ p.skipTurns = 0; });
}

function saveState(players, nextId, currentPlayerId){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      nextId: nextId,
      currentPlayerId: currentPlayerId,
      players: players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        cell: p.cell || 0,
        skipTurns: p.skipTurns || 0,
      })),
    }));
  }catch(e){ /* quota / private mode */ }
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw){
      return { players: null, nextId: null, currentPlayerId: null };
    }
    const saved = JSON.parse(raw);
    const playerData = Array.isArray(saved) ? saved : (saved && saved.players);

    let players = null;
    let nextId = null;

    if(Array.isArray(playerData) && playerData.length){
      players = [];
      let maxId = -1;
      playerData.forEach((s, i)=>{
        if(!s || typeof s !== "object") return;
        const id = Number.isFinite(Number(s.id)) ? Number(s.id) : i;
        if(id > maxId) maxId = id;
        const name = (typeof s.name === "string" && s.name.trim())
          ? s.name.trim()
          : ("Joueur " + (players.length + 1));
        players.push({
          id: id,
          name: name,
          color: s.color || colorFromHue(i * 36),
          cell: normalizeCell(s.cell),
          skipTurns: normalizeSkipTurns(s.skipTurns),
        });
      });
      if(players.length > MAX_PLAYERS) players = players.slice(0, MAX_PLAYERS);
      if(players.length < MIN_PLAYERS) players = null;
      else ensureUniqueColors(players);
      nextId = Number.isFinite(Number(saved.nextId))
        ? Number(saved.nextId)
        : (maxId + 1);
    }

    return {
      players: players,
      nextId: nextId,
      currentPlayerId: saved && Number.isFinite(Number(saved.currentPlayerId))
        ? Number(saved.currentPlayerId)
        : null,
    };
  }catch(e){
    return { players: null, nextId: null, currentPlayerId: null };
  }
}

function createDefaultPlayers(count){
  const n = Math.max(1, Math.min(MAX_PLAYERS, count || DEFAULT_PLAYER_COUNT));
  const players = [];
  const step = 360 / Math.max(n, 1);
  for(let i = 0; i < n; i++){
    players.push({
      id: i,
      name: "Joueur " + (i + 1),
      color: colorFromHue(i * step),
      cell: 0,
      skipTurns: 0,
    });
  }
  return { players: players, nextId: n };
}
