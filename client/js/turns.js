function getMaxCellNum(){
  let max = 1;
  for(let i = 0; i < CELLS.length; i++){
    if(CELLS[i][2] > max) max = CELLS[i][2];
  }
  return max;
}

/** Cases traversées pour un lancer (rebond au-delà de la victoire). */
function cellsToTraverse(fromCell, steps){
  const max = getMaxCellNum();
  const path = [];
  let pos = Math.max(0, fromCell || 0);
  let dir = 1;
  const n = Math.max(0, Math.floor(steps));

  for(let i = 0; i < n; i++){
    if(pos <= 0){
      pos = 1;
      dir = 1;
    } else {
      let next = pos + dir;
      if(next > max){
        dir = -1;
        next = pos + dir;
      } else if(next < 1){
        dir = 1;
        next = pos + dir;
      }
      pos = next;
    }
    path.push(pos);
  }
  return path;
}

function destinationAfter(fromCell, steps){
  const path = cellsToTraverse(fromCell, Math.abs(steps));
  if(!path.length) return Math.max(0, fromCell || 0);
  if(steps >= 0) return path[path.length - 1];
  // Reculer : simple décrement borné
  return Math.max(1, (fromCell || 1) + steps);
}

/**
 * Effets de case après arrêt (BAN, LAG, avance/recul, Aegis = rejoue).
 * @returns {{ extraTurn: boolean, notes: string[] }}
 */
function resolveLandingEffects(player){
  const notes = [];
  let extraTurn = false;
  let guard = 0;

  while(guard++ < 6){
    const cell = player.cell;
    const cat = cellCategory(cell);

    if(cat === "ban"){
      player.skipTurns = 1;
      notes.push("BAN — passera le prochain tour");
      break;
    }

    if(cat === "lag"){
      player.cell = 24;
      notes.push("LAG → case 24");
      continue;
    }

    if(cell === 12){
      player.cell = destinationAfter(cell, 3);
      notes.push("Avance de 3 → case " + player.cell);
      continue;
    }

    if(cell === 29){
      player.cell = Math.max(1, cell - 3);
      notes.push("Recule de 3 → case " + player.cell);
      continue;
    }

    if(cat === "aegis"){
      extraTurn = true;
      notes.push("Aegis — rejoue");
      break;
    }

    if(cat === "letter"){
      notes.push("Tire une lettre");
      return { extraTurn: false, notes: notes, victory: false, letterPick: true, genrePick: false, mimePick: false, racePick: false };
    }

    if(cat === "genre"){
      notes.push("Tire un genre");
      return { extraTurn: false, notes: notes, victory: false, letterPick: false, genrePick: true, mimePick: false, racePick: false };
    }

    if(cat === "imitate"){
      notes.push("Tire un type à mimer");
      return { extraTurn: false, notes: notes, victory: false, letterPick: false, genrePick: false, mimePick: true, racePick: false };
    }

    if(cat === "race"){
      notes.push("Défi chat");
      return { extraTurn: false, notes: notes, victory: false, letterPick: false, genrePick: false, mimePick: false, racePick: true };
    }

    if(cat === "victory"){
      notes.push("Victoire !");
      return { extraTurn: false, notes: notes, victory: true, letterPick: false, genrePick: false, mimePick: false, racePick: false };
    }

    break;
  }

  return { extraTurn: extraTurn, notes: notes, victory: false, letterPick: false, genrePick: false, mimePick: false, racePick: false };
}

function ensureCurrentPlayerId(players, currentId){
  if(findPlayer(players, currentId)) return currentId;
  return players.length ? players[0].id : null;
}

function playerIndexById(players, id){
  for(let i = 0; i < players.length; i++){
    if(players[i].id === id) return i;
  }
  return -1;
}

/**
 * Passe au joueur suivant. Si BAN, consomme le skip automatiquement.
 * @returns {{ currentId: number|null, skipped: object[] }}
 */
function advanceToNextPlayer(players, currentId){
  if(!players.length) return { currentId: null, skipped: [] };

  let idx = playerIndexById(players, currentId);
  if(idx < 0) idx = 0;
  else idx = (idx + 1) % players.length;

  const skipped = [];
  const start = idx;
  do {
    const p = players[idx];
    if((p.skipTurns || 0) > 0){
      p.skipTurns = 0;
      skipped.push(p);
      idx = (idx + 1) % players.length;
      continue;
    }
    return { currentId: p.id, skipped: skipped };
  } while(idx !== start);

  // Tout le monde en BAN (cas extrême) : débloquer le premier
  const p = players[start];
  p.skipTurns = 0;
  return { currentId: p.id, skipped: skipped };
}

let tokenAnimTimer = null;
let tokenAnimCancelled = false;

function cancelTokenAnimation(){
  tokenAnimCancelled = true;
  if(tokenAnimTimer){
    clearTimeout(tokenAnimTimer);
    tokenAnimTimer = null;
  }
}

function animateTokenSteps(player, path, onStep, onDone){
  if(!path || !path.length){
    if(onDone) onDone();
    return;
  }

  // Onglet caché : aller directement à la case finale
  if(document.hidden){
    player.cell = path[path.length - 1];
    if(onStep) onStep(player.cell, path.length - 1);
    if(onDone) onDone();
    return;
  }

  tokenAnimCancelled = false;
  let i = 0;
  function step(){
    if(tokenAnimCancelled){
      player.cell = path[path.length - 1];
      if(onDone) onDone();
      return;
    }
    if(document.hidden){
      player.cell = path[path.length - 1];
      if(onStep) onStep(player.cell, path.length - 1);
      if(onDone) onDone();
      return;
    }
    player.cell = path[i];
    if(onStep) onStep(player.cell, i);
    i++;
    if(i >= path.length){
      tokenAnimTimer = null;
      if(onDone) onDone();
      return;
    }
    tokenAnimTimer = setTimeout(step, 140);
  }
  step();
}
