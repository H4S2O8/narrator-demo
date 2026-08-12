import { TUTORIAL, PAST, PROPHECIES, endingCopy, ACT1, ACT2, SCENE_VARIANTS } from "./data/content.js";
import { buildContext } from "./engine/context.js";
import { executeAction, getAction } from "./engine/actions.js";
import { createState, hydrateScene, commitPast, startProphecy, finaliseLoop } from "./engine/state.js";
import { stepSimulation } from "./engine/simulation.js";
import { BrowserLLM } from "./ai/browser-llm.js";
import { renderGame, updateProphecyUI } from "./ui/render.js";
import { Sound } from "./ui/audio.js";

const root = document;
const canvas = root.querySelector("#stage");
const ctx = canvas.getContext("2d");
const transcript = root.querySelector("#transcript");
const inputBar = root.querySelector("#command-bar");
const command = root.querySelector("#command-input");
const tutorialCard = root.querySelector("#tutorial-card");
const keys = new Set();
const sound = new Sound();
let state = createState();
let last = performance.now();
let modelStatus = "模型准备中";
let inputSession = 0;
let submitting = false;
let narratorThinking = false;
let endingShown = false;

hydrateScene(state, "studio");
root.querySelector("#loop-mark").textContent = state.meta.loop;
window.__FANCHAO__ = {
  get state() { return state; },
  buildContext: raw => buildContext(state, raw),
  async act(raw) {
    const context = buildContext(state, raw);
    const parsed = await llm.parseAction(context);
    if (!parsed) return null;
    return executeAction(state, parsed.action, buildContext(state, raw));
  },
  executeId(id) {
    const context=buildContext(state,id);
    const action=getAction(id);
    return action?.available(context) ? executeAction(state,action,context) : null;
  },
  step(seconds) {
    const was=state.paused;state.paused=false;
    const count=Math.ceil(seconds/.05);for(let i=0;i<count;i++)stepSimulation(state,.05,new Set(),emit);
    state.paused=was;return state;
  },
  setPaused,
  maybeNarrator
};
const llm = new BrowserLLM((mode, message) => {
  state.parser.modelReady = mode === "ready"; state.parser.modelMode = mode;
  state.narrator.modelReady = mode === "ready"; state.narrator.modelMode = mode;
  modelStatus = message;
  emit("system", message);
});

function emit(type, text, speaker = null) {
  const line = document.createElement("div"); line.className = `line ${type}`;
  const who = speaker || (type === "narrator" ? "苏遥（旁白）" : type === "system" ? "讲述" : type === "action" ? "行动" : "");
  line.innerHTML = `<span class="speaker"></span><span class="text"></span>`;
  line.querySelector(".speaker").textContent = who;
  line.querySelector(".text").textContent = text;
  transcript.append(line); transcript.scrollTop = transcript.scrollHeight;
  state.logs.push({ at: state.time, type, text, speaker: who });
}

function narrationIntro() {
  const loop = state.meta.loop;
  if (loop === 1) {
    emit("dialogue", "再讲一遍。别说她为了你死，先说那天房间里有什么。", "柯宁");
    emit("narrator", "那天晚上，水先从照相馆后门进来。", "苏遥（成年）");
  } else if (loop === 2) {
    emit("dialogue", "上一次你说出口的别改。没说清楚的，重讲。", "柯宁");
    emit("narrator", "铁盆、照片和信号枪的位置，与上一次共同记住的部分相同。", "苏遥（成年）");
  } else {
    emit("dialogue", "你说‘看见’以前，先说清楚：是看见她，还是看见她留下的东西？", "柯宁");
    emit("narrator", "讲述从仍然相容的历史开始。", "苏遥（成年）");
  }
  emit("system", "WASD移动；P或空格暂停；回车输入行动并自动暂停。 ");
  showTutorial();
}

function showTutorial() {
  if (state.tutorial.complete) { tutorialCard.classList.add("hidden"); return; }
  const item = TUTORIAL[state.tutorial.index];
  if (!item) { state.tutorial.complete = true; tutorialCard.classList.add("hidden"); return; }
  tutorialCard.classList.remove("hidden");
  root.querySelector("#tutorial-step").textContent = `教程 ${state.tutorial.index + 1}/${TUTORIAL.length}`;
  root.querySelector("#tutorial-text").textContent = item[1];
}

function advanceTutorial(trigger) {
  const item = TUTORIAL[state.tutorial.index];
  if (item?.[0] === trigger) { state.tutorial.index += 1; showTutorial(); }
}

function setPaused(value, reason = "manual") {
  state.paused = value;
  state.pauseReason = value ? reason : null;
  if (value && reason === "manual") state.stats.pauses += 1;
  root.querySelector("#pause-state").textContent = value ? (state.inputOpen ? "输入中" : reason === "reasoning" ? "旁白推演中" : "已暂停") : "运行中";
}

function openInput() {
  if (!state.started || state.ending || state.inputOpen || submitting) return;
  inputSession += 1;
  state.pauseBeforeInput = state.paused;
  state.pauseReasonBeforeInput = state.pauseReason;
  state.inputOpen = true; setPaused(true, "input");
  inputBar.classList.remove("hidden"); command.value = ""; command.focus();
  advanceTutorial("enter");
}

function closeInput(session = inputSession) {
  if (session !== inputSession || !state.inputOpen) return;
  state.inputOpen = false; inputBar.classList.add("hidden"); command.blur();
  setPaused(state.pauseBeforeInput, state.pauseBeforeInput ? (state.pauseReasonBeforeInput || "manual") : "input");
}

async function submitInput() {
  if (submitting) return;
  const raw = command.value.trim(); if (!raw) { closeInput(); return; }
  const session = inputSession;
  submitting = true;
  state.stats.wordsEntered += raw.length;
  const context = buildContext(state, raw);
  emit("action", `“${raw}”`);
  root.querySelector("#submit-command").disabled = true;
  let parsed;
  try { parsed = await llm.parseAction(context); } catch (error) { emit("system", `意图模型失败：${error.message}`); }
  root.querySelector("#submit-command").disabled = false;
  if (!parsed) {
    state.stats.rejected += 1; sound.error();
    const near = context.nearObjects.map(o => o.name).join("、") || "没有可触及物品";
    emit("system", `没有找到能诚实执行的预设行动。附近：${near}；双手：${context.heldObjects.map(o=>o.name).join("、") || "空"}。`);
    submitting = false; return;
  }
  const latestContext = buildContext(state, raw);
  if (!parsed.action.available(latestContext)) {
    state.stats.rejected += 1; sound.error(); emit("system", "模型选择的行动已经因当前状态变化而失效，没有执行。 "); submitting = false; return;
  }
  const result = executeAction(state, parsed.action, latestContext);
  for (const message of result.messages) emit(result.ok ? "action" : "system", message);
  if (result.ok) sound.action(); else sound.error();
  updatePatterns(parsed.action.id);
  await maybeNarrator(result.narratorNode);
  if (parsed.action.effect.type === "take" || parsed.action.effect.type === "drop") advanceTutorial("hold");
  if (parsed.action.effect.type === "monitor" || parsed.action.effect.type === "trace") advanceTutorial("observe");
  if (state.ending) showEnding();
  submitting = false;
  closeInput(session);
}

function updatePatterns(actionId) {
  const p = state.narrator.playerPatterns || (state.narrator.playerPatterns = {});
  if (actionId.startsWith("aim_")) p.fakeAim = (p.fakeAim || 0) + 1;
  if (actionId.includes("camera") || actionId.includes("monitor")) p.monitoring = (p.monitoring || 0) + 1;
  if (actionId.includes("inspect")) p.checking = (p.checking || 0) + 1;
  if (actionId.includes("foam")) p.safeOccupation = (p.safeOccupation || 0) + 1;
  if (actionId.includes("head") || actionId.includes("body")) p.embodiedCredit = (p.embodiedCredit || 0) + 1;
}

async function maybeNarrator(node) {
  if (!node || narratorThinking || state.time - state.narrator.lastDecisionAt < state.narrator.decisionCooldown) return;
  state.narrator.lastDecisionAt = state.time;
  narratorThinking = true;
  const wasPaused = state.paused;
  const priorReason = state.pauseReason;
  setPaused(true, state.inputOpen ? "input" : "reasoning");
  let choice = "SILENCE";
  try {
    choice = await llm.chooseNarrator(state, node);
  } finally {
    narratorThinking = false;
    if (state.inputOpen) setPaused(true, "input");
    else if (wasPaused) setPaused(true, priorReason || "manual");
    else setPaused(false, "reasoning");
  }
  state.narrator.decisions.push({ at: state.time, node, choice });
  if (choice === "SILENCE") { state.narrator.patience = Math.min(1, state.narrator.patience + .08); return; }
  if (PAST[choice]) {
    const result = commitPast(state, choice);
    if (result.ok) { sound.narrator(); state.stats.narratorSpeaks += 1; emit("narrator", PAST[choice].text); advanceTutorial("past"); }
  } else if (PROPHECIES[choice]) {
    const result = startProphecy(state, choice);
    if (result.ok) { sound.prophecy(); state.stats.narratorSpeaks += 1; emit("narrator", PROPHECIES[choice].text); advanceTutorial("future"); }
  }
}

function updateUi() {
  root.querySelector("#world-clock").textContent = `${String(Math.floor(state.time / 60)).padStart(2,"0")}:${(state.time % 60).toFixed(1).padStart(4,"0")}`;
  root.querySelector("#act-label").textContent = state.act === 0 ? `第${state.meta.loop}遍 · 教程` : `第${state.meta.loop}遍 · 第${state.act}幕`;
  root.querySelector("#world-count").textContent = state.worlds.length;
  root.querySelector("#world-meter i").style.transform = `scaleX(${state.worlds.length / state.initialWorldCount})`;
  const held = Object.values(state.player.hands).filter(Boolean).map(id => state.objects[id]?.name).filter(Boolean).join(" / ") || "空";
  const route = [state.routes.act1 && ACT1[state.routes.act1]?.label, state.routes.act2 && ACT2[state.routes.act2]?.label].filter(Boolean).join(" → ") || "未形成";
  root.querySelector("#status-list").innerHTML = `
    <dt>左/右手</dt><dd>${held}</dd>
    <dt>姿势</dt><dd>${state.player.pose}</dd>
    <dt>水位</dt><dd>${Math.round(state.environment.water*100)}%</dd>
    <dt>供电 / 泵</dt><dd>${state.environment.power?"有":"无"} / ${state.environment.pump?"运行":"停止"}</dd>
    <dt>路线</dt><dd>${route}</dd>
    <dt>模型</dt><dd>${state.narrator.modelMode === "ready" ? "浏览器轻量LLM" : modelStatus}</dd>`;
  updateProphecyUI(state, root);
}

function showEnding() {
  if (endingShown) return;
  endingShown = true;
  setPaused(true);
  const data = endingCopy(state);
  const curtain = root.querySelector("#curtain"); curtain.classList.remove("hidden");
  const block = curtain.querySelector(".title-block");
  block.innerHTML = `<span>第 ${state.meta.loop} 遍讲述 · ${data.key}</span><h1>${data.title}</h1>${data.paragraphs.map(p=>`<p>${p}</p>`).join("")}<button id="next-loop">再讲一遍</button>`;
  finaliseLoop(state);
  block.querySelector("#next-loop").addEventListener("click", () => location.reload());
}

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  stepSimulation(state, dt, keys, emit);
  renderGame(ctx, state, canvas); updateUi();
  if (state.ending && !endingShown) showEnding();
  if (state.started && state.time > 2 && !state.activeProphecy && state.propheciesFulfilled.length === 0) maybeNarrator("tutorial_prophecy");
  if (state.started && state.act === 0 && state.time > 28) state.act = 1;
  if (state.act === 1 && state.time - state.narrator.lastDecisionAt > 22 && !state.activeProphecy) maybeNarrator("act1_prophecy");
  if (state.act === 3 && state.time - state.narrator.lastDecisionAt > 20 && !state.activeProphecy) maybeNarrator("final_prophecy");
  requestAnimationFrame(frame);
}

root.querySelector("#start-button").addEventListener("click", () => {
  sound.ensure(); root.querySelector("#curtain").classList.add("hidden"); state.started = true; setPaused(false); narrationIntro(); llm.load();
});
root.querySelector("#submit-command").addEventListener("click", submitInput);
root.querySelector("#cancel-command").addEventListener("click", closeInput);
command.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); if (!submitting) submitInput(); } else if (event.key === "Escape" && !submitting) closeInput(); });
window.addEventListener("keydown", event => {
  if (state.inputOpen) return;
  if (event.code === "Enter") { event.preventDefault(); openInput(); return; }
  if (event.code === "Space" || event.code === "KeyP") { event.preventDefault(); setPaused(!state.paused); return; }
  keys.add(event.code);
  if (["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.code)) advanceTutorial("move");
});
window.addEventListener("keyup", event => keys.delete(event.code));

requestAnimationFrame(frame);
