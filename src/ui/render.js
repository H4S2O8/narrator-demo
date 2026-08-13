import { PROPHECIES } from "../data/content.js?v=20260813f";

const colors = { sulan: "#dfb76e", yao: "#c36f79", luhui: "#71aab2", luoyi: "#9fa86c" };
const sprites = new Image();
sprites.src = "assets/sprites.png";

function drawFloor(ctx, state, width, height) {
  ctx.fillStyle = state.sceneId.startsWith("cinema") ? "#37323c" : state.sceneId.startsWith("darkroom") ? "#2d3c3f" : state.sceneId.startsWith("roof") ? "#384246" : "#3b413e";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#202626"; ctx.fillRect(0, 0, width, 62);
  ctx.strokeStyle = "rgba(220,220,205,.07)"; ctx.lineWidth = 1;
  for (let x = 16; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 62); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 62; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  if (state.flags.roof_gap_open) { ctx.fillStyle="#050607";ctx.fillRect(455,62,92,height-62);ctx.strokeStyle="#8b7560";ctx.strokeRect(455,62,92,height-62); }
  if (state.flags.screens_active) { ctx.fillStyle="rgba(94,150,145,.22)";for(let x=520;x<820;x+=92)ctx.fillRect(x,82,70,42); }
  if (state.flags.projection_window) { ctx.fillStyle="rgba(229,214,163,.13)";ctx.beginPath();ctx.moveTo(790,120);ctx.lineTo(210,520);ctx.lineTo(610,520);ctx.closePath();ctx.fill(); }
  if (state.flags.echo_corridor) { ctx.strokeStyle="rgba(190,185,160,.18)";for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(760,300,45+i*38,-1.1,1.1);ctx.stroke();} }
  if (state.flags.continuous_exposure) { ctx.fillStyle="rgba(208,190,140,.12)";for(let x=80;x<900;x+=56)ctx.fillRect(x,88,32,20); }
  const waterY = height - state.environment.water * 360;
  if (state.environment.water > 0.01) {
    ctx.fillStyle = "rgba(43,100,113,.28)"; ctx.fillRect(0, waterY, width, height - waterY);
    ctx.strokeStyle = "rgba(112,181,189,.35)";
    for (let y = waterY + 8; y < height; y += 18) { ctx.beginPath(); for (let x = 0; x <= width; x += 12) ctx.lineTo(x, y + Math.sin(x * .04 + state.time * 2) * 3); ctx.stroke(); }
  }
}

function drawObject(ctx, object, state) {
  if (!object.visible || object.held) return;
  ctx.save(); ctx.translate(Math.round(object.x), Math.round(object.y));
  ctx.fillStyle = object.state?.broken ? "#a65d4e" : "#d0b879";
  ctx.strokeStyle = "#0c1011"; ctx.lineWidth = 2.5;
  const shapes = {
    basin: () => { ctx.beginPath(); ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (object.state.water) { ctx.fillStyle = object.state.water === "red" ? "#a64b4d" : "#598b96"; ctx.beginPath(); ctx.ellipse(0, -2, 11, 4, 0, 0, Math.PI * 2); ctx.fill(); } },
    flour: () => { ctx.fillRect(-9, -13, 18, 26); ctx.strokeRect(-9, -13, 18, 26); },
    strip: () => { ctx.fillStyle = object.state.color === "violet" ? "#a479a9" : "#d6c8a0"; ctx.fillRect(-3, -14, 6, 28); },
    camera: () => { ctx.fillRect(-12, -8, 24, 16); ctx.fillStyle = "#2a3334"; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); },
    flare: () => { ctx.rotate(-.35); ctx.fillRect(-13, -4, 23, 8); ctx.fillRect(4, 2, 6, 11); },
    foam: () => { ctx.fillStyle = "#d0a34f"; ctx.rotate(-.35); ctx.fillRect(-13, -4, 23, 8); ctx.fillRect(4, 2, 6, 11); },
    rope: () => { ctx.strokeStyle = "#b9975b"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 1.7); ctx.stroke(); },
    photo: () => { ctx.fillStyle = "#d1c9ad"; ctx.fillRect(-10, -13, 20, 26); ctx.strokeRect(-10, -13, 20, 26); },
    frame: () => { ctx.strokeStyle = "#80725a"; ctx.lineWidth = 5; ctx.strokeRect(-28, -32, 56, 64); },
    pump: () => { ctx.fillStyle = "#65787a"; ctx.fillRect(-24, -20, 48, 40); ctx.strokeRect(-24, -20, 48, 40); ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke(); },
    breaker: () => { ctx.fillStyle = state.environment.power ? "#738b6d" : "#6e5550"; ctx.fillRect(-16, -24, 32, 48); ctx.strokeRect(-16, -24, 32, 48); },
    frontDoor: () => { ctx.fillStyle = "#3a4140"; ctx.fillRect(-25, -60, 50, 120); for(let y=-52;y<60;y+=12){ctx.strokeStyle="#59605d";ctx.beginPath();ctx.moveTo(-25,y);ctx.lineTo(25,y);ctx.stroke();} },
    thinWall: () => { ctx.fillStyle = "#4a4943"; ctx.fillRect(-18, -70, 36, 140); if(object.state.damage){ctx.strokeStyle="#1c1b19";ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(-8,0);ctx.lineTo(8,15);ctx.lineTo(-5,35);ctx.stroke();} },
    redBucket: () => { ctx.fillStyle="#914e50";ctx.fillRect(-12,-15,24,30);ctx.strokeRect(-12,-15,24,30); },
    chalkLine: () => { ctx.strokeStyle="#d7c66f";ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(-40,0);ctx.lineTo(40,0);ctx.stroke(); },
    projector: () => { ctx.fillStyle="#6c665d";ctx.fillRect(-20,-14,40,28);ctx.beginPath();ctx.arc(-11,-17,10,0,Math.PI*2);ctx.arc(11,-17,10,0,Math.PI*2);ctx.fill(); }
  };
  (shapes[object.id] || (() => { ctx.fillRect(-10, -10, 20, 20); }))();
  ctx.restore();
}

function drawPerson(ctx, id, entity, state, isPlayer = false) {
  if (!entity.alive && !isPlayer) return;
  const moving = Math.sin(state.time * 11 + entity.x * .1);
  const personIndex = {sulan:0,yao:1,luhui:2,luoyi:3}[id] ?? 0;
  const walking = isPlayer && state._moving;
  const spriteFrame = walking ? Math.floor(state.time * 8) % 4 : Math.floor(state.time * 2) % 2;
  if (sprites.complete && sprites.naturalWidth) {
    ctx.drawImage(sprites,spriteFrame*32,personIndex*48,32,48,Math.round(entity.x)-16,Math.round(entity.y)-36,32,48);
  } else {
  ctx.save(); ctx.translate(Math.round(entity.x), Math.round(entity.y));
  const scaleY = entity.pose === "crawl" ? .48 : entity.pose === "crouch" ? .72 : 1;
  ctx.scale(1, scaleY);
  ctx.fillStyle = colors[id]; ctx.strokeStyle = "#111516"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -17, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillRect(-8, -9, 16, 24); ctx.strokeRect(-8, -9, 16, 24);
  ctx.beginPath(); ctx.moveTo(-5, 14); ctx.lineTo(-7 + moving, 27); ctx.moveTo(5, 14); ctx.lineTo(7 - moving, 27); ctx.stroke();
  ctx.restore();
  }
  if (isPlayer) {
    const hands=Object.values(state.player.hands).filter(Boolean);
    hands.forEach((itemId,index)=>{
      ctx.fillStyle=itemId==="foam"?"#d5a64d":itemId==="flare"?"#a75e49":"#d3be84";
      ctx.strokeStyle="#101314";ctx.lineWidth=2;
      const x=entity.x+(index===0?-13:13),y=entity.y-8;
      ctx.fillRect(x-5,y-4,10,8);ctx.strokeRect(x-5,y-4,10,8);
    });
  }
  ctx.fillStyle = "rgba(235,235,225,.75)"; ctx.font = "11px Segoe UI"; ctx.textAlign = "center"; ctx.fillText(isPlayer ? "苏岚" : entity.name, entity.x, entity.y + 38);
}

function drawTraces(ctx, state) {
  for (const trace of state.traces) {
    ctx.save(); ctx.translate(trace.x, trace.y);
    if (trace.type.startsWith("flour")) { ctx.strokeStyle = trace.disturbed ? "rgba(220,213,181,.25)" : "rgba(230,224,196,.7)"; ctx.setLineDash([3,4]); ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.stroke(); }
    else if (trace.type.includes("water")) { ctx.fillStyle = trace.type.includes("red") ? "rgba(150,55,60,.45)" : "rgba(70,120,130,.38)"; ctx.beginPath();ctx.ellipse(0,0,35,12,0,0,Math.PI*2);ctx.fill(); }
    else { ctx.fillStyle="rgba(215,190,120,.5)";ctx.fillRect(-4,-4,8,8); }
    ctx.restore();
  }
}

function drawVision(ctx, state, width, height) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.94)";
  ctx.beginPath(); ctx.rect(0,0,width,height); ctx.arc(state.player.x,state.player.y,state.environment.visibility,0,Math.PI*2,true); ctx.fill("evenodd");
  ctx.restore();
}

function drawEffects(ctx, state, width, height) {
  for (const effect of state.effects || []) {
    const p = Math.max(0, Math.min(1, (state.time - effect.at) / effect.duration));
    ctx.save();
    if (effect.type === "shot" && !effect.empty) {
      const x = effect.from.x + (effect.to.x - effect.from.x) * Math.min(1, p * 2.8);
      const y = effect.from.y + (effect.to.y - effect.from.y) * Math.min(1, p * 2.8);
      ctx.strokeStyle = effect.weapon === "foam" ? "#e8b54e" : "#ff7755";
      ctx.lineWidth = effect.weapon === "foam" ? 3 : 5;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(effect.from.x, effect.from.y); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = "rgba(255,244,200,.9)"; ctx.beginPath(); ctx.arc(effect.from.x, effect.from.y, 18 * (1-p), 0, Math.PI * 2); ctx.fill();
    } else if (effect.type === "shot" && effect.empty) {
      ctx.strokeStyle = `rgba(220,205,170,${1-p})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(effect.from.x, effect.from.y, 9 + p * 15, 0, Math.PI * 2); ctx.stroke();
    } else if (effect.type === "wall_break" || effect.type === "impact") {
      ctx.translate(effect.x, effect.y);
      ctx.strokeStyle = `rgba(235,201,138,${1-p})`; ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a) * (18 + p * 55), Math.sin(a) * (18 + p * 55)); ctx.stroke(); }
    } else if (effect.type === "flood_burst") {
      ctx.fillStyle = `rgba(70,157,178,${.55 * (1-p)})`; ctx.fillRect(0, height * (.65 - p * .2), width, height);
    } else if (effect.type === "rope_tension" || effect.type === "brace") {
      ctx.strokeStyle = `rgba(225,190,104,${.8 * (1-p)})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(state.player.x, state.player.y - 8, 28 + p * 18, -.9, .9); ctx.stroke();
    }
    ctx.restore();
  }
}

export function renderGame(ctx, state, canvas) {
  drawFloor(ctx, state, canvas.width, canvas.height);
  drawTraces(ctx, state);
  for (const object of Object.values(state.objects)) drawObject(ctx, object, state);
  for (const [id, npc] of Object.entries(state.npcs)) drawPerson(ctx, id, npc, state);
  drawPerson(ctx, "sulan", state.player, state, true);
  drawEffects(ctx, state, canvas.width, canvas.height);
  drawVision(ctx, state, canvas.width, canvas.height);
  ctx.strokeStyle="rgba(225,205,151,.25)";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(state.player.x,state.player.y,state.environment.visibility,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle="rgba(10,12,13,.8)";ctx.fillRect(12,12,260,34);ctx.fillStyle="#d8d5ca";ctx.font="14px Segoe UI";ctx.textAlign="left";ctx.fillText(state.scene.title,24,34);
  if(state.flags.eyes_closed_final){const p=state.flags.final_hold_progress||0;ctx.fillStyle=`rgba(0,0,0,${Math.min(.98,.25+p*.78)})`;ctx.fillRect(0,0,canvas.width,canvas.height);if(p<.18){ctx.fillStyle="#d4c394";ctx.textAlign="center";ctx.font="14px Segoe UI";ctx.fillText("按住 H。不要校准时刻。",canvas.width/2,canvas.height/2)}}
  if (state.paused && state.started) { ctx.fillStyle="rgba(8,10,11,.55)";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#e4d2a4";ctx.font="600 20px Segoe UI";ctx.textAlign="center";ctx.fillText(state.inputOpen?"讲述暂停 · 输入行动":"已暂停",canvas.width/2,70); }
}

export function updateProphecyUI(state, root) {
  const box = root.querySelector("#prophecy");
  if (!state.activeProphecy) { box.classList.add("hidden"); return; }
  const p = PROPHECIES[state.activeProphecy.id]; box.classList.remove("hidden");
  root.querySelector("#prophecy-text").textContent = p.text;
  const remaining = Math.max(0, state.activeProphecy.dueAt - state.time);
  root.querySelector("#prophecy-progress").style.transform = `scaleX(${remaining / p.duration})`;
}
