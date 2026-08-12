import { popDue, fulfillProphecy, syncFlags, commitRoute, hydrateScene } from "./state.js";
import { SCENE_VARIANTS } from "../data/content.js";

const approach = (entity, target, speed, dt) => {
  const dx = target.x - entity.x, dy = target.y - entity.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  entity.x += dx / d * Math.min(d, speed * dt);
  entity.y += dy / d * Math.min(d, speed * dt);
  return d < 6;
};

const goalTargets = {
  move_negatives: { x: 460, y: 190 },
  watch_mother: { follow: "player" },
  protect_child: { x: 600, y: 450 },
  repair_pump: { object: "pump" },
  watch_player: { follow: "player", distance: 95 },
  film_player: { follow: "player", distance: 125 },
  watch_other: { x: 830, y: 320 },
  close_eyes: null
};

function simulateNpc(state, npc, dt) {
  if (!npc.alive || npc.goal === "close_eyes") return;
  let targetSpec = goalTargets[npc.goal];
  if (npc.goal === "watch_item" && npc.target && state.objects[npc.target]) targetSpec = { object: npc.target };
  if (!targetSpec) return;
  let target = targetSpec;
  if (targetSpec.follow === "player") {
    const angle = npc.id === "yao" ? Math.PI * 0.8 : 0.2;
    target = { x: state.player.x + Math.cos(angle) * (targetSpec.distance || 80), y: state.player.y + Math.sin(angle) * (targetSpec.distance || 80) };
  } else if (targetSpec.object && state.objects[targetSpec.object]) target = state.objects[targetSpec.object];
  const arrived = approach(npc, target, npc.id === "yao" ? 72 : 90, dt);
  if (arrived && npc.goal === "repair_pump") {
    state.flags.pump_repaired = true;
    state.environment.pump = state.environment.power;
    npc.goal = "watch_other";
  }
}

function disturbTraces(state) {
  for (const trace of state.traces) {
    if (trace.disturbed) continue;
    if (state.environment.water > 0.28 && trace.type.startsWith("flour")) {
      trace.disturbed = true;
      trace.movedTo = { x: trace.x + 70, y: trace.y + 25 };
    }
    for (const npc of Object.values(state.npcs)) {
      if (npc.alive && Math.hypot(npc.x - trace.x, npc.y - trace.y) < 22) {
        trace.touchedBy = [...new Set([...(trace.touchedBy || []), npc.id])];
      }
    }
  }
}

function applyFlood(state, dt) {
  let rate = state.environment.floodRate;
  if (state.flags.front_breached || state.flags.door_open) rate *= 4.4;
  if (state.flags.cinema_open || state.flags.thinWall_broken) rate *= 1.7;
  if (state.flags.door_seal || state.flags.door_braced) rate *= 0.45;
  if (state.environment.pump && state.environment.power && state.flags.pump_repaired) rate -= 0.012;
  state.environment.water = Math.max(0, Math.min(1.05, state.environment.water + rate * dt));
  state.environment.pressure = Math.max(0, state.environment.pressure + (state.flags.door_seal ? 0.008 : 0.002) * dt);
  if (state.environment.water > 0.22) state.flags.red_seep_ready = true;
  if (state.environment.water > 0.48 && state.environment.power && !state.flags.breaker_locked) {
    state.flags.electric_water = true;
  }
  if (state.environment.water > 0.72) {
    for (const object of Object.values(state.objects)) {
      if (!object.held && object.portable && (object.weight || 0) < 1) {
        object.x = Math.min(920, object.x + dt * 18);
        object.y = Math.min(540, object.y + Math.sin(state.time + object.x) * dt * 8);
      }
    }
  }
}

function handleDue(state, event, emit) {
  if (event.type === "prophecy_due") {
    const result = fulfillProphecy(state);
    if (result.ok) emit("prophecy", `未来兑现：${result.path.label}。`);
    else if (result.paradox) {
      state.player.health -= 1;
      emit("system", "所有预制实现链都被堵死。讲述从最低代价处撕开一条路径，苏岚因此受伤。 ");
      state.activeProphecy = null;
    }
  } else if (event.type === "basin_fill") {
    const basin = state.objects.basin;
    if (basin && state.flags.basin_under_leak) { basin.state.water = event.data.color; state.flags.basin_water = true; emit("action", "铁盆逐渐接满了水。 "); }
  } else if (event.type === "inspection_resolve") {
    if (event.data.axis === "flare") {
      const loaded = state.worlds.filter(w => w.axes.flare === "loaded").length;
      if (loaded === state.worlds.length) emit("action", "弹膛中有信号弹。检查结果成为硬事实。 ");
      else if (loaded === 0) emit("action", "弹膛是空的。检查结果成为硬事实。 ");
      else emit("system", "检查尚未完成时，剩余历史仍对弹膛状态有分歧。 ");
    }
  } else if (event.type === "repair_complete") {
    state.flags.pump_repaired = true; state.environment.pump = state.environment.power;
    emit("action", "排水泵恢复运转。此后水位按泵压真实演化。 ");
  }
}

export function stepSimulation(state, dt, input, emit) {
  if (state.paused || !state.started || state.ending) return;
  state.time += dt;
  state.effects = state.effects.filter(effect => state.time - effect.at <= effect.duration + 0.1);
  if (state.finalHold?.active) {
    if (!input.has("KeyH")) {
      state.finalHold.active=false;state.finalHold.interrupted=true;state.flags.eyes_closed_final=false;
      emit("system","苏岚松开受力姿势，重新获得信息。旁白也重新获得一次介入窗口。");
    } else {
      const heldFor=state.time-state.finalHold.startedAt;
      state.flags.final_hold_progress=Math.min(1,heldFor/state.finalHold.required);
      state.branchProgress.boundary=Math.max(state.branchProgress.boundary,1+state.flags.final_hold_progress*3);
    }
  }
  let dx = 0, dy = 0;
  if (input.has("KeyW") || input.has("ArrowUp")) dy -= 1;
  if (input.has("KeyS") || input.has("ArrowDown")) dy += 1;
  if (input.has("KeyA") || input.has("ArrowLeft")) dx -= 1;
  if (input.has("KeyD") || input.has("ArrowRight")) dx += 1;
  if (dx || dy) {
    state._moving = true;
    const norm = Math.hypot(dx, dy); dx /= norm; dy /= norm;
    const poseScale = state.player.pose === "crawl" ? 0.45 : state.player.pose === "crouch" ? 0.7 : 1;
    const waterScale = 1 - Math.min(0.5, state.environment.water * 0.55);
    state.player.x = Math.max(24, Math.min(936, state.player.x + dx * state.player.speed * poseScale * waterScale * dt));
    state.player.y = Math.max(76, Math.min(548, state.player.y + dy * state.player.speed * poseScale * waterScale * dt));
    state.player.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
    for (const id of Object.values(state.player.hands).filter(Boolean)) { state.objects[id].x = state.player.x; state.objects[id].y = state.player.y; }
  } else state._moving = false;
  applyFlood(state, dt);
  for (const npc of Object.values(state.npcs)) simulateNpc(state, npc, dt);
  disturbTraces(state);
  for (const event of popDue(state)) handleDue(state, event, emit);
  if (state.environment.water > 0.92 && state.act < 3) state.branchProgress.breach += dt * 0.4;
  if (state.environment.pump && state.environment.power) state.branchProgress.seal += dt * 0.12;
  if (state.flags.thinWall_broken) state.branchProgress.cinema = Math.max(4, state.branchProgress.cinema);
  if (state.flags.yao_witness_chain) state.branchProgress.yao += dt * 0.08;
  if (state.flags.luhui_mutual_alibi) state.branchProgress.luhui += dt * 0.08;
  if (state.flags.embodied_chain) state.branchProgress.alone += dt * 0.08;
  if (state.act === 3) {
    if (state.npcs.yao.alive) state.branchProgress.sacrifice += dt * 0.025;
    if (state.player.health > 0 && state.environment.water < 0.95) state.branchProgress.escape += dt * 0.025;
    if (state.flags.body_supporting_frame || state.flags.body_holds_breaker || state.flags.rope_body_anchor) state.branchProgress.boundary += dt * 0.07;
  }
  resolveOrganicBranches(state, emit);
  syncFlags(state);
}

function resolveOrganicBranches(state, emit) {
  if (state.act === 1 && !state.routes.act1) {
    let choice = null;
    if ((state.flags.door_open || state.flags.frontDoor_broken) && state.environment.water >= 0.22) choice = "breach";
    else if (state.flags.thinWall_broken) choice = "cinema";
    else if (state.flags.door_seal && state.flags.pump_repaired && state.environment.pump && state.environment.pressure >= 0.08) choice = "seal";
    if (choice && commitRoute(state, "act1", choice)) {
      hydrateScene(state, choice === "breach" ? "roof" : choice === "seal" ? "darkroom" : "cinema");
      state.act = 2;
      emit("system", choice === "breach" ? "前门外的水流切断了回到原房间的路。故事进入屋顶线。" : choice === "seal" ? "门、泵与供电形成稳定封闭条件。故事进入暗房保压线。" : "薄墙贯通后，所有人的可达空间改变。故事进入旧影院线。");
    }
  } else if (state.act === 2 && !state.routes.act2) {
    const candidates = ["yao", "luhui", "alone"].map(key => [key, state.branchProgress[key]]).sort((a,b)=>b[1]-a[1]);
    if (candidates[0][1] >= 4 && candidates[0][1] >= candidates[1][1] + 1) {
      const choice = candidates[0][0];
      if (commitRoute(state, "act2", choice)) {
        const root = state.sceneId.split("_")[0];
        const variant = SCENE_VARIANTS[root][choice];
        hydrateScene(state, variant.id); state.act = 3;
        state.branchProgress.sacrifice += 1; state.branchProgress.escape += 1; state.branchProgress.boundary += 1;
        emit("system", choice === "yao" ? "苏遥的连续视线成为这一路事实的主要见证。" : choice === "luhui" ? "苏岚与陆洄的行动开始互相占用对方的历史。" : "没有人替苏岚命名；痕迹链成为唯一连续证明。");
      }
    }
  } else if (state.act === 3 && !state.routes.act3) {
    const candidates = ["sacrifice", "escape", "boundary"].map(key => [key, state.branchProgress[key]]).sort((a,b)=>b[1]-a[1]);
    const boundaryStillHeld = candidates[0][0] === "boundary" && state.finalHold?.active && (state.flags.final_hold_progress || 0) < 1;
    if (!boundaryStillHeld && candidates[0][1] >= 3 && candidates[0][1] >= candidates[1][1] + .75) {
      if (commitRoute(state, "act3", candidates[0][0])) state.ending = candidates[0][0];
    }
  }
}
