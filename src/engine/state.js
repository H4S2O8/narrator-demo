import { ACT1, ACT2, ACT3, OBJECTS, PAST, PROPHECIES, createWorldlines, sceneDefinition } from "../data/content.js?v=20260813f";

export function loadMeta() {
  if (typeof localStorage === "undefined") return { version: 1, loop: 1, anchors: [], missingItems: [], strategyMemory: {}, priorRoutes: [], reality: {} };
  try {
    const saved = JSON.parse(localStorage.getItem("fanchao-meta") || "null");
    if (saved?.version === 1) return saved;
  } catch {}
  return { version: 1, loop: 1, anchors: [], missingItems: [], strategyMemory: {}, priorRoutes: [], reality: {} };
}

export function saveMeta(meta) {
  if (typeof localStorage !== "undefined") localStorage.setItem("fanchao-meta", JSON.stringify(meta));
}

export function createState(meta = loadMeta()) {
  const worlds = createWorldlines(meta.anchors);
  const priorReality = meta.reality || {};
  return {
    meta,
    started: false,
    paused: true,
    pauseBeforeInput: false,
    pauseReasonBeforeInput: null,
    inputOpen: false,
    pauseReason: "boot",
    time: 0,
    act: 0,
    actStartedAt: 0,
    sceneId: "studio",
    scene: sceneDefinition("studio", meta.loop, meta),
    worlds,
    initialWorldCount: worlds.length,
    player: { x: 120, y: 420, facing: "down", pose: "stand", health: 3, hands: { left: null, right: null }, aimingAt: null, speed: 128 },
    npcs: {
      yao: { id: "yao", name: "苏遥", x: 650, y: 230, alive: priorReality.yaoAlive !== false, health: 2, trust: priorReality.yaoTrust || 0, goal: "watch_mother", target: null, path: [], knowledge: [...(priorReality.yaoKnowledge || [])] },
      luhui: { id: "luhui", name: "陆洄", x: 745, y: 395, alive: priorReality.luhuiAlive !== false, health: 3, trust: priorReality.luhuiTrust || 0, goal: priorReality.luhuiAlive === false ? "close_eyes" : "move_negatives", target: null, path: [], knowledge: [...(priorReality.luhuiKnowledge || [])] },
      luoyi: { id: "luoyi", name: "罗姨", x: 610, y: 470, alive: true, health: 2, trust: 0, goal: "protect_child", target: null, path: [] }
    },
    objects: {},
    persistentObjects: {},
    environment: { water: 0, pressure: 0, power: true, pump: false, floodRate: 0.007, visibility: 190, rain: 1 },
    flags: {
      red_seep_ready: true, yao_near_red_bucket: true, strip_visible: true, frame_on_shelf: true,
      luhui_near_basin: true, luhui_near_breaker: true, two_witnesses_ready: true, water_ink_ready: true,
      prior_unpaid_cost: Boolean(priorReality.unpaidCost), prior_route_known: Boolean(meta.priorRoutes?.length)
    },
    routes: { act1: null, act2: null, act3: null },
    pastCommitted: [],
    propheciesFulfilled: [],
    activeProphecy: null,
    observations: [],
    traces: [],
    timeline: [],
    effects: [],
    scheduled: [],
    narrator: {
      strategy: "preserve_sacrifice",
      pressure: 0,
      patience: 0.7,
      lastDecisionAt: -99,
      decisionCooldown: 5,
      plan: priorReality.unpaidCost
        ? ["collect_unpaid_cost", "deny_repeat_escape"]
        : priorReality.lastEnding === "sacrifice"
          ? ["preserve_specific_sacrifice", "prevent_reinterpretation"]
          : ["make_yao_only_witness", "move_cost_to_sulan"],
      modelReady: false,
      modelMode: "idle",
      decisions: []
    },
    parser: { modelReady: false, modelMode: "idle", lastSource: null, lastModelOutput: "" },
    tutorial: { index: 0, seen: [], complete: false },
    branchProgress: { breach: 0, seal: 0, cinema: 0, yao: 0, luhui: 0, alone: 0, sacrifice: 0, escape: 0, boundary: 0 },
    ending: null,
    logs: [],
    stats: { actions: 0, rejected: 0, wordsEntered: 0, pauses: 0, narratorSpeaks: 0 }
  };
}

export function hydrateScene(state, sceneId) {
  for (const object of Object.values(state.objects)) {
    state.persistentObjects[object.id] = structuredClone(object);
  }
  state.sceneId = sceneId;
  state.scene = sceneDefinition(sceneId, state.meta.loop, state.meta);
  const [x, y] = state.scene.spawn;
  state.player.x = x; state.player.y = y;
  const placements = { ...state.scene.objects };
  for (const id of heldIds(state)) {
    if (!placements[id] && state.persistentObjects[id]) placements[id] = { id, x: state.player.x, y: state.player.y, held: true, visible: false, state: {} };
  }
  state.objects = Object.fromEntries(Object.entries(placements).map(([id, placement]) => {
    const source = state.persistentObjects[id] || {};
    const held = heldIds(state).includes(id);
    return [id, { ...OBJECTS[id], ...placement, ...source, id, x: held ? state.player.x : placement.x, y: held ? state.player.y : placement.y, held, visible: held ? false : source.visible !== false, state: { ...(source.state || {}) } }];
  }));
  for (const [id, pos] of Object.entries(state.scene.npcs)) {
    if (!state.npcs[id]) continue;
    state.npcs[id].x = pos[0]; state.npcs[id].y = pos[1];
  }
  Object.assign(state.environment, state.scene.environment || {});
  Object.assign(state.flags, state.scene.initialFlags || {});
  if (state.meta.loop >= 3) state.flags.precise_hearing = true;
  const priorAct1 = state.meta.priorRoutes?.at(-1)?.act1;
  if (sceneId === "studio" && state.meta.loop > 1) {
    if (priorAct1 === "breach" && state.objects.frontDoor) state.objects.frontDoor.state.damage = 1;
    if (priorAct1 === "cinema" && state.objects.thinWall) state.objects.thinWall.state.damage = 1;
    if (priorAct1 === "seal") state.flags.prior_pump_procedure_known = true;
  }
  syncFlags(state);
}

export function schedule(state, delay, type, data = {}) {
  const item = { id: `${type}-${state.timeline.length}-${state.scheduled.length}`, at: state.time + delay, type, data };
  state.scheduled.push(item);
  state.scheduled.sort((a, b) => a.at - b.at);
  return item;
}

export function popDue(state) {
  const due = [];
  while (state.scheduled.length && state.scheduled[0].at <= state.time) due.push(state.scheduled.shift());
  return due;
}

export function commitPast(state, id) {
  const operation = PAST[id];
  if (!operation) return { ok: false, reason: "未知的过去操作" };
  const next = state.worlds.filter(world => operation.keep.includes(world.axes[operation.axis]));
  if (!next.length) return { ok: false, reason: "这句话与所有剩余历史矛盾" };
  const before = state.worlds.length;
  state.worlds = next;
  state.pastCommitted.push({ id, at: state.time, before, after: next.length });
  for (const tag of operation.tags) state.flags[tag] = true;
  if (operation.tags.some(tag => tag.startsWith("yao_knows"))) state.npcs.yao.knowledge = [...new Set([...(state.npcs.yao.knowledge || []), id])];
  if (operation.tags.some(tag => tag.startsWith("luhui_knows"))) state.npcs.luhui.knowledge = [...new Set([...(state.npcs.luhui.knowledge || []), id])];
  if (id === "H_LUHUI_UNLOADED") {
    state.flags.luhui_cannot_have_repaired_pump = true;
    state.worlds = state.worlds.filter(world => world.axes.pump !== "luhui_repaired");
  }
  const backlash = {
    H_FLARE_EMPTY: () => { state.flags.all_flare_uses_empty = true; },
    H_YAO_UNLOADED: () => { state.npcs.yao.goal = "watch_other"; state.npcs.yao.trust -= .5; },
    H_KEY_MOVED: () => { state.flags.counter_key_unavailable = true; },
    H_LUHUI_KEY: () => { state.flags.exit_depends_on_luhui = true; state.npcs.luhui.trust += .5; },
    H_YAO_KEY: () => { state.flags.exit_depends_on_yao = true; },
    H_PHOTO_SEEN: () => { state.flags.photo_can_be_searched = true; },
    H_YAO_PHOTO: () => { state.flags.yao_witness_burden = true; },
    H_LUHUI_PHOTO: () => { state.flags.luhui_bargaining_knowledge = true; },
    H_PUMP_REPAIRED: () => { state.flags.darkroom_was_occupied = true; },
    H_LUHUI_PUMP: () => { state.flags.pump_depends_on_luhui = true; },
    H_SULAN_PUMP: () => { state.flags.sulan_darkroom_locked_time = true; },
    H_DOOR_OPENABLE: () => { state.environment.floodRate += .0015; },
    H_BACK_UNLATCHED: () => { state.environment.floodRate += .003; },
    H_FILM_LOADED: () => { state.flags.film_frames_limited = true; },
    H_YAO_FILM: () => { state.flags.yao_camera_burden = true; }
  };
  backlash[id]?.();
  state.timeline.push({ at: state.time, kind: "past", id, before, after: next.length });
  syncFlags(state);
  return { ok: true, operation, before, after: next.length };
}

export function filterWorlds(state, predicate, reason) {
  const next = state.worlds.filter(predicate);
  if (!next.length) return { ok: false, reason: "该行动会使所有候选历史互相矛盾" };
  const before = state.worlds.length;
  state.worlds = next;
  state.timeline.push({ at: state.time, kind: "filter", reason, before, after: next.length });
  syncFlags(state);
  return { ok: true, before, after: next.length };
}

export function startProphecy(state, id) {
  if (state.activeProphecy) return { ok: false, reason: "上一句未来尚未兑现" };
  const source = PROPHECIES[id];
  if (!source) return { ok: false, reason: "未知预言" };
  const guaranteedPath = source.paths.find(item => item.flags.every(flag => state.flags[flag]));
  if (!guaranteedPath) return { ok: false, reason: "当前没有可保证兑现的物理链" };
  state.activeProphecy = { id, startedAt: state.time, dueAt: state.time + source.duration, occupied: null, path: null, guaranteedPath: guaranteedPath.id };
  schedule(state, source.duration, "prophecy_due", { id });
  state.timeline.push({ at: state.time, kind: "prophecy", id });
  return { ok: true, prophecy: source };
}

export function occupyProphecy(state, id, path, actor = "player") {
  if (!state.activeProphecy || state.activeProphecy.id !== id || state.activeProphecy.occupied) return false;
  const definition = PROPHECIES[id];
  const selected = definition.paths.find(item => item.id === path);
  if (!selected || !selected.flags.every(flag => state.flags[flag])) return false;
  state.activeProphecy.occupied = actor;
  state.activeProphecy.path = path;
  state.timeline.push({ at: state.time, kind: "occupy", id, path, actor });
  return true;
}

export function fulfillProphecy(state) {
  const active = state.activeProphecy;
  if (!active) return { ok: false };
  const source = PROPHECIES[active.id];
  let path = active.path && source.paths.find(item => item.id === active.path);
  if (!path) path = source.paths.find(item => item.flags.every(flag => state.flags[flag]));
  if (!path) path = source.paths.find(item => item.id === active.guaranteedPath);
  if (!path) return { ok: false, paradox: true, source };
  state.propheciesFulfilled.push({ id: active.id, path: path.id, occupied: active.occupied, at: state.time });
  state.timeline.push({ at: state.time, kind: "fulfilled", id: active.id, path: path.id });
  state.activeProphecy = null;
  return { ok: true, source, path, occupied: Boolean(active.occupied) };
}

export function commitRoute(state, act, choice) {
  const table = act === "act1" ? ACT1 : act === "act2" ? ACT2 : ACT3;
  if (!table[choice] || state.routes[act]) return false;
  state.routes[act] = choice;
  for (const tag of table[choice].tags) state.flags[tag] = true;
  state.timeline.push({ at: state.time, kind: "route", act, choice });
  return true;
}

export function syncFlags(state) {
  for (const object of Object.values(state.objects)) {
    state.flags[`${object.id}_held`] = object.held === true;
  }
  const loaded = state.worlds.filter(world => world.axes.flare === "loaded").length;
  state.flags.flare_loaded = loaded === state.worlds.length;
  state.flags.flare_empty = loaded === 0;
  const filmWorlds = state.worlds.filter(world => world.axes.film !== "empty_camera").length;
  state.flags.camera_has_film = filmWorlds === state.worlds.length;
  state.flags.camera_maybe_empty = filmWorlds < state.worlds.length;
  state.flags.basin_held = heldIds(state).includes("basin");
  state.flags.foam_held = heldIds(state).includes("foam");
  state.flags.basin_water = Boolean(state.objects.basin?.state.water);
  state.flags.basin_red_water = state.objects.basin?.state.water === "red";
  state.flags.strip_hidden = Boolean(state.objects.strip?.state.hidden);
  state.flags.strip_visible = Boolean(state.objects.strip && !state.objects.strip.state.hidden);
}

export function heldIds(state) {
  return Object.values(state.player.hands).filter(Boolean);
}

export function finaliseLoop(state) {
  const newAnchors = [];
  for (const commit of state.pastCommitted.slice(-2)) {
    const op = PAST[commit.id];
    if (op.keep.length === 1) newAnchors.push({ axis: op.axis, value: op.keep[0] });
  }
  let anchors = [...(state.meta.anchors || [])];
  for (const anchor of newAnchors) {
    const candidate = [...anchors.filter(item => item.axis !== anchor.axis), anchor];
    if (createWorldlines(candidate).length >= 20) anchors = candidate;
  }
  const knownObjects = { ...state.persistentObjects, ...state.objects };
  const lost = Object.values(knownObjects).filter(object => object.state?.lost).map(object => object.id);
  const nextMeta = {
    ...state.meta,
    loop: Math.min(4, state.meta.loop + 1),
    anchors,
    missingItems: [...new Set([...state.meta.missingItems, ...lost])],
    priorRoutes: [...state.meta.priorRoutes, { ...state.routes }],
    strategyMemory: { ...state.meta.strategyMemory, ...state.narrator.playerPatterns },
    reality: {
      ...state.meta.reality,
      lastEnding: state.routes.act3,
      yaoTrust: state.npcs.yao.trust,
      yaoAlive: state.npcs.yao.alive,
      yaoKnowledge: [...(state.npcs.yao.knowledge || [])],
      luhuiTrust: state.npcs.luhui.trust,
      luhuiAlive: state.npcs.luhui.alive,
      luhuiKnowledge: [...(state.npcs.luhui.knowledge || [])],
      unpaidCost: state.routes.act3 !== "sacrifice"
    }
  };
  saveMeta(nextMeta);
  return nextMeta;
}
