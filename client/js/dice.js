const DIE_DOTS = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};

let diceRolling = false;
let diceAnimTimer = null;
let diceCount = 2;
let diceOnRequestRoll = null;
let diceCanRoll = null;
let diceLockCount = false;

function buildDieFace(el, value){
  el.innerHTML = "";
  el.dataset.face = String(value);
  const face = document.createElement("div");
  face.className = "die-face";
  for(let i = 1; i <= 9; i++){
    const pip = document.createElement("span");
    pip.className = "die-pip";
    if(DIE_DOTS[value].indexOf(i) === -1) pip.classList.add("empty");
    face.appendChild(pip);
  }
  el.appendChild(face);
}

function setDiceFaces(a, b){
  const d1 = document.getElementById("die-1");
  const d2 = document.getElementById("die-2");
  if(d1) buildDieFace(d1, a);
  if(d2 && diceCount === 2) buildDieFace(d2, b);
}

function setDiceTotal(total, rolling){
  const el = document.getElementById("dice-total");
  if(!el) return;
  if(rolling){
    el.textContent = "…";
    el.classList.add("rolling");
  } else {
    el.textContent = total == null ? "—" : String(total);
    el.classList.remove("rolling");
  }
}

function rollDie(){
  return 1 + Math.floor(Math.random() * 6);
}

function isDiceBusy(){
  return diceRolling;
}

function updateDiceModeUI(){
  const box = document.querySelector(".dice-box");
  const btn = document.getElementById("roll-dice-btn");
  const d2 = document.getElementById("die-2");
  const allowed = !diceRolling && (!diceCanRoll || diceCanRoll());

  if(box) box.classList.toggle("dice-single", diceCount === 1);
  if(d2) d2.hidden = diceCount === 1;
  if(btn) btn.disabled = !allowed;

  document.querySelectorAll(".dice-mode-btn").forEach(function(el){
    const count = parseInt(el.dataset.count, 10);
    el.classList.toggle("active", count === diceCount);
    el.disabled = diceRolling || diceLockCount;
  });
}

function setDiceButtonLabel(label){
  const btn = document.getElementById("roll-dice-btn");
  if(!btn) return;
  btn.textContent = label || (diceCount === 1 ? "Lancer le dé" : "Lancer les dés");
}

function setDiceCount(count, options){
  if(diceRolling) return;
  if(count !== 1 && count !== 2) return;
  const preserveFaces = !!(options && options.preserveFaces);
  diceCount = count;
  updateDiceModeUI();
  if(!preserveFaces){
    setDiceFaces(1, 1);
    setDiceTotal(null, false);
  }
}

/** Affiche des valeurs sans animation (garde le résultat visible). */
function showDiceValues(values, total){
  if(!values || !values.length) return;
  diceCount = values.length === 1 ? 1 : 2;
  updateDiceModeUI();
  const a = values[0];
  const b = values.length > 1 ? values[1] : a;
  const sum = total != null
    ? total
    : values.reduce(function(s, v){ return s + v; }, 0);
  setDiceFaces(a, b);
  setDiceTotal(sum, false);
}

/** Affiche une animation puis les valeurs finales fournies par le serveur. */
function animateDiceResult(values, onDone){
  const btn = document.getElementById("roll-dice-btn");
  const d1 = document.getElementById("die-1");
  const d2 = document.getElementById("die-2");

  const finals = Array.isArray(values) && values.length
    ? values.slice()
    : [1];
  diceCount = finals.length === 1 ? 1 : 2;
  updateDiceModeUI();

  const finalA = finals[0];
  const finalB = finals.length > 1 ? finals[1] : finalA;
  const total = finals.reduce(function(sum, v){ return sum + v; }, 0);

  function finishInstant(){
    if(diceAnimTimer){
      clearInterval(diceAnimTimer);
      diceAnimTimer = null;
    }
    if(d1){
      d1.classList.remove("rolling");
      d1.classList.remove("landed");
    }
    if(d2){
      d2.classList.remove("rolling");
      d2.classList.remove("landed");
    }
    setDiceFaces(finalA, finalB);
    setDiceTotal(total, false);
    diceRolling = false;
    updateDiceModeUI();
    if(onDone) onDone(total);
  }

  // Onglet en arrière-plan : pas d'anim (timers navigateur gelés)
  if(document.hidden || !d1){
    finishInstant();
    return;
  }

  diceRolling = true;
  if(btn) btn.disabled = true;
  d1.classList.add("rolling");
  if(diceCount === 2 && d2) d2.classList.add("rolling");
  setDiceTotal(null, true);

  let ticks = 0;
  const maxTicks = 12;

  if(diceAnimTimer) clearInterval(diceAnimTimer);
  diceAnimTimer = setInterval(function(){
    if(document.hidden){
      finishInstant();
      return;
    }
    ticks++;
    setDiceFaces(rollDie(), rollDie());
    if(ticks >= maxTicks){
      clearInterval(diceAnimTimer);
      diceAnimTimer = null;

      setDiceFaces(finalA, finalB);
      setDiceTotal(total, false);

      d1.classList.remove("rolling");
      d1.classList.add("landed");
      if(d2){
        d2.classList.remove("rolling");
        if(diceCount === 2) d2.classList.add("landed");
      }
      setTimeout(function(){
        d1.classList.remove("landed");
        if(d2) d2.classList.remove("landed");
      }, 450);

      diceRolling = false;
      updateDiceModeUI();
      if(onDone) onDone(total);
    }
  }, 70);
}

function skipDiceAnimation(){
  if(!diceRolling && !diceAnimTimer) return;
  if(diceAnimTimer){
    clearInterval(diceAnimTimer);
    diceAnimTimer = null;
  }
  const d1 = document.getElementById("die-1");
  const d2 = document.getElementById("die-2");
  if(d1){
    d1.classList.remove("rolling");
    d1.classList.remove("landed");
  }
  if(d2){
    d2.classList.remove("rolling");
    d2.classList.remove("landed");
  }
  diceRolling = false;
  updateDiceModeUI();
}

function requestDiceRoll(){
  if(diceRolling) return;
  if(diceCanRoll && !diceCanRoll()) return;
  if(diceOnRequestRoll) diceOnRequestRoll();
}

function bindDice(options){
  const btn = document.getElementById("roll-dice-btn");
  if(!btn) return;

  diceOnRequestRoll = options && options.onRequestRoll ? options.onRequestRoll : null;
  diceCanRoll = options && options.canRoll ? options.canRoll : null;
  diceLockCount = !!(options && options.lockDiceCount);

  if(options && (options.diceCount === 1 || options.diceCount === 2)){
    diceCount = options.diceCount;
  }

  updateDiceModeUI();
  setDiceFaces(1, 1);
  setDiceTotal(null, false);
  setDiceButtonLabel(null);

  btn.addEventListener("click", requestDiceRoll);
}
