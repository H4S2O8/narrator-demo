import { popDue, fulfillProphecy, syncFlags, commitRoute, hydrateScene } from "./state.js?v=20260813f";
import { SCENE_VARIANTS } from "../data/content.js?v=20260813f";

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

export const ACT_MIN_SECONDS = { act1:120, act2:240, act3:180 };

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
        if (object.x >= 918 && !object.held) { object.state.lost = true; object.visible = false; }
      }
    }
  }
}

function applySceneHazards(state, dt, emit) {
  if (state.act !== 3) return;
  const elapsed = state.time - state.actStartedAt;
  if (state.sceneId === "roof_yao" && elapsed > 8 && !state.flags.glass_fell) {
    state.flags.glass_fell = true;
    if (!state.flags.yao_eyes_closed && !state.flags.yao_reflection_witness) state.npcs.yao.health = Math.max(1, state.npcs.yao.health - 1);
    emit("action", state.flags.yao_reflection_witness ? "碎玻璃落下时，苏遥仍从反光板里保持见证。" : "招牌碎玻璃落下，苏遥不得不在见证与避让之间转头。 ");
  }
  if (state.sceneId === "roof_luhui" && elapsed > 10 && !state.flags.roof_gap_shifted) {
    state.flags.roof_gap_shifted = true;
    if (!state.flags.rope_with_luhui && !state.flags.roof_gap_crossed) state.npcs.luhui.trust -= 1;
    emit("action", "两段屋顶再次错开。没有共绳的人只能分别留在断口两侧。 ");
  }
  if (state.sceneId === "roof_alone" && elapsed > 9 && !state.flags.washout_arrived) {
    state.flags.washout_arrived = true;
    for (const object of Object.values(state.objects)) if (!object.held && object.portable && object.weight < 1) { object.state.lost = true; object.visible = false; }
    emit("action", "一股横流扫过屋面，未固定的轻物离开可见范围；绳结和重量仍留在原处。 ");
  }
  if (state.sceneId === "darkroom_yao" && elapsed > 7 && !state.flags.screen_desync) {
    state.flags.screen_desync = true;
    emit("action", "监控画面比门缝里的动作慢了半拍。此后画面与本人不能互相替代。 ");
  }
  if (state.sceneId === "darkroom_luhui" && elapsed > 10 && !state.flags.control_pressure_spike) {
    state.flags.control_pressure_spike = true;
    if (!state.flags.controls_swapped && state.flags.luhui_cannot_have_repaired_pump) state.environment.water += .12;
    emit("action", "泵压突然回落。谁曾修泵、谁此刻守闸，开始同时影响积水。 ");
  }
  if (state.sceneId === "darkroom_alone" && state.environment.electric_water && elapsed > 8 && !state.flags.electric_arc) {
    state.flags.electric_arc = true;
    if (!state.flags.head_insulated && state.environment.power) state.player.health = Math.max(1, state.player.health - 1);
    emit("action", state.flags.head_insulated ? "电弧沿湿地面绕过被干布隔开的头肩。" : "带电积水碰到货架，苏岚被迫改变受力姿势。 ");
  }
  if (state.sceneId === "cinema_yao" && elapsed > 8 && !state.flags.projector_flicker) {
    state.flags.projector_flicker = true;
    emit("action", "放映光闪断一次。苏遥必须区分刚才看见的是苏岚，还是上一格残留的轮廓。 ");
  }
  if (state.sceneId === "cinema_luhui" && elapsed > 9 && !state.flags.echo_returned) {
    state.flags.echo_returned = true;
    emit("action", "迟到的回声从座席后方返回；声音证明有人说过话，却不证明说话者仍在那里。 ");
  }
  if (state.sceneId === "cinema_alone" && elapsed > 10 && !state.flags.film_advanced) {
    state.flags.film_advanced = true;
    if (!state.flags.frame_rate_fixed) state.flags.double_exposure_ready = false;
    emit("action", "放映机自行走过一段胶片。没有固定帧速的遮挡失去连续编号。 ");
  }
}

function applyStoryBeats(state, emit) {
  const elapsed=state.time-state.actStartedAt;
  const beat=(at,id,apply,text)=>{
    if(elapsed<at||state.flags[id])return;
    state.flags[id]=true;apply();emit("action",text);
  };
  if(state.act===1){
    beat(18,"beat_ceiling_drip",()=>{state.environment.water=Math.min(1.05,state.environment.water+.018);state.traces.push({id:`T${state.traces.length+1}`,type:"ceiling_drip",x:515,y:250,createdAt:state.time,disturbed:false});},"顶棚接缝开始滴水。新水迹落在旧脚印之间，没有替任何一条脚印命名。");
    beat(43,"beat_power_flicker",()=>{state.environment.pressure+=.03;state.effects.push({id:`E${state.effects.length+1}`,type:"power_flicker",at:state.time,duration:1.2});},"灯与排水泵同时顿了一拍。总闸仍在原位，但停顿已经进入所有人的时间线。");
    beat(71,"beat_floor_current",()=>{for(const object of Object.values(state.objects))if(!object.held&&object.portable&&(object.weight||0)<1){object.x=Math.min(920,object.x+28);object.y+=12;}},"一股贴地水流把未拿起的轻物推向前门。被拿在手里的东西没有随它移动。");
    beat(98,"beat_door_breath",()=>{state.environment.pressure+=.06;state.npcs.luhui.goal=state.flags.door_monitored?"watch_other":"move_negatives";},"卷帘门向内鼓起又落回。门没有自行选择路线，但水压缩短了继续犹豫的余量。");
  }
  if(state.act===2){
    const root=state.sceneId.split("_")[0];
    beat(24,"beat_second_entry",()=>{state.traces.push({id:`T${state.traces.length+1}`,type:`${root}_entry_water`,x:state.player.x,y:state.player.y,createdAt:state.time,disturbed:false});},root==="roof"?"屋面低处出现第一条横向水线。":"门后的水沿新空间重新寻找最低点。");
    beat(58,"beat_second_object_shift",()=>{for(const object of Object.values(state.objects))if(!object.held&&object.portable&&(object.weight||0)<2){object.x=Math.max(35,Math.min(925,object.x+(root==="cinema"?-34:26)));}},"没有被手、绳或监控固定的轻物再次移动。它们的新位置会影响下一次可执行行动。");
    beat(93,"beat_second_npc_split",()=>{if(state.flags.yao_monitored)state.npcs.yao.goal="watch_player";else state.npcs.yao.goal="protect_child";if(state.flags.luhui_monitored)state.npcs.luhui.goal="watch_other";},"苏遥和陆洄各自改变了站位。相机固定的是一段记录，不是让人永远停在原地。");
    beat(132,"beat_second_backflow",()=>{state.environment.water=Math.min(1.05,state.environment.water+(root==="darkroom"?.04:.07));state.environment.pressure+=.04;},"一阵回水穿过已经形成的通路。先前的封堵、破墙和泵压开始显出不同代价。");
    beat(174,"beat_second_trace_mix",()=>{for(const trace of state.traces)if(trace.type.startsWith("flour")&&state.environment.water>.3){trace.disturbed=true;trace.movedTo={x:trace.x+42,y:trace.y+16};}},"水把部分面粉拖成细线。痕迹没有失效，只是从‘有人经过’变成了水流与鞋底共同留下的材料。");
    beat(216,"beat_second_commit_pressure",()=>{if(state.npcs.yao.alive&&!state.flags.yao_witness_chain)state.npcs.yao.trust-=.25;if(state.npcs.luhui.alive&&!state.flags.luhui_mutual_alibi)state.npcs.luhui.trust-=.25;},"救援灯第一次扫过建筑外沿。仍未建立的互证关系不会自动补全；已经建立的限制开始决定谁能一起移动。");
  }
}

function handleDue(state, event, emit) {
  if (event.type === "prophecy_due") {
    const result = fulfillProphecy(state);
    if (result.ok) {
      applyProphecyOutcome(state, result.source.id, result.path.id);
      emit("prophecy", `未来兑现：${result.path.label}。`);
    }
    else if (result.paradox) {
      state.player.health -= 1;
      emit("system", "所有预制实现链都被堵死。讲述从最低代价处撕开一条路径，苏岚因此受伤。 ");
      state.activeProphecy = null;
    }
  } else if (event.type === "basin_fill") {
    const basin = state.objects.basin;
    if (basin && state.flags.basin_under_leak) { basin.state.water = event.data.color; state.flags.basin_water = true; emit("action", "铁盆逐渐接满了水。 "); }
  } else if (event.type === "inspection_resolve") {
    const values = [...new Set(state.worlds.map(world => world.axes[event.data.axis]))];
    if (values.length > 1) {
      const ranked = values.map(value => [value, state.worlds.filter(world => world.axes[event.data.axis] === value).length]).sort((a,b)=>b[1]-a[1]);
      const chosen = ranked[0][0];
      const before = state.worlds.length;
      state.worlds = state.worlds.filter(world => world.axes[event.data.axis] === chosen);
      state.timeline.push({ at: state.time, kind: "inspection", axis: event.data.axis, value: chosen, before, after: state.worlds.length });
      syncFlags(state);
    }
    const value = state.worlds[0]?.axes[event.data.axis];
    if (event.data.axis === "flare") emit("action", value === "loaded" ? "弹膛中有信号弹。检查结果成为硬事实。" : "弹膛是空的。检查结果成为硬事实。");
    else if (event.data.axis === "film") emit("action", value === "empty_camera" ? "相机里没有胶片。检查结果成为硬事实。" : "相机里装着可曝光胶片。检查结果成为硬事实。");
  } else if (event.type === "repair_complete") {
    state.flags.pump_repaired = true; state.environment.pump = state.environment.power;
    emit("action", "排水泵恢复运转。此后水位按泵压真实演化。 ");
  }
}

function applyProphecyOutcome(state, prophecyId, pathId) {
  const object = id => state.objects[id];
  if (prophecyId === "P_RED_LINE") {
    const source = pathId === "basin" ? state.player : pathId === "yao_kick" ? state.npcs.yao : object("chalkLine");
    state.traces.push({ id:`T${state.traces.length+1}`,type:"red_water_line",target:"chalkLine",x:source?.x||760,y:source?.y||290,createdAt:state.time,disturbed:false });
    if (pathId === "yao_kick" && object("redBucket")) { object("redBucket").x=760;object("redBucket").y=300;object("redBucket").state.water=null; }
  }
  if (prophecyId === "P_YAO_SEES_STRIP") {
    state.npcs.yao.goal = "watch_item"; state.npcs.yao.target = pathId === "photo" ? "photo" : "strip";
    state.npcs.yao.knowledge = [...new Set([...(state.npcs.yao.knowledge||[]),`strip_${pathId}`])];
  }
  if (prophecyId === "P_WATER_FROM_BASIN" && object("basin")) {
    object("basin").state.water=null;state.traces.push({id:`T${state.traces.length+1}`,type:"basin_spill",target:"basin",x:object("basin").x,y:object("basin").y,createdAt:state.time,disturbed:false});
  }
  if (prophecyId === "P_FLARE_HEAD") {
    state.effects.push({id:`E${state.effects.length+1}`,type:"shot",at:state.time,duration:.65,weapon:pathId==="foam_self"?"foam":"flare",empty:false,from:{x:state.player.x-90,y:state.player.y-12},to:{x:state.player.x,y:state.player.y-18}});
    if (pathId !== "foam_self" && !state.flags.metal_head_cover) state.player.health=Math.max(1,state.player.health-1);
  }
  if (prophecyId === "P_HEAD_ABOVE_FRAME" && object("frame")) object("frame").y=Math.min(object("frame").y,state.player.y-45);
  if (prophecyId === "P_SHADOW") { state.flags.shadow_visible=true;state.traces.push({id:`T${state.traces.length+1}`,type:"projected_shadow",target:"projector",x:state.player.x,y:state.player.y,createdAt:state.time,disturbed:false}); }
  if (prophecyId === "P_ROPE_TAUT") { state.flags.rope_taut=true;state.effects.push({id:`E${state.effects.length+1}`,type:"rope_tension",at:state.time,duration:1.4}); }
  if (prophecyId === "P_TWO_RECORDS" && object("photo")) { object("photo").state.records=["toward_water","away_from_water"];state.flags.two_records_fixed=true; }
  if (prophecyId === "P_BREAKER_DARK") {
    state.environment.power=false;state.environment.pump=false;state.flags.breaker_off=true;state.flags.indicator_dark=true;
  }
  if (prophecyId === "P_PHOTO_PRINT" && object("photo")) {
    object("photo").state.fingerprint=pathId;state.flags.photo_print_fixed=true;
    state.traces.push({id:`T${state.traces.length+1}`,type:"photo_fingerprint",target:"photo",x:object("photo").x,y:object("photo").y,createdAt:state.time,disturbed:false});
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
  applyStoryBeats(state,emit);
  applySceneHazards(state, dt, emit);
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
    if (choice && state.time - state.actStartedAt >= ACT_MIN_SECONDS.act1 && commitRoute(state, "act1", choice)) {
      hydrateScene(state, choice === "breach" ? "roof" : choice === "seal" ? "darkroom" : "cinema");
      state.act = 2; state.actStartedAt = state.time;
      emit("system", choice === "breach" ? "前门外的水流切断了回到原房间的路。故事进入屋顶线。" : choice === "seal" ? "门、泵与供电形成稳定封闭条件。故事进入暗房保压线。" : "薄墙贯通后，所有人的可达空间改变。故事进入旧影院线。");
    }
  } else if (state.act === 2 && !state.routes.act2) {
    const candidates = ["yao", "luhui", "alone"].map(key => [key, state.branchProgress[key]]).sort((a,b)=>b[1]-a[1]);
    if (state.time - state.actStartedAt >= ACT_MIN_SECONDS.act2 && candidates[0][1] >= 4 && candidates[0][1] >= candidates[1][1] + 1) {
      const choice = candidates[0][0];
      if (commitRoute(state, "act2", choice)) {
        const root = state.sceneId.split("_")[0];
        const variant = SCENE_VARIANTS[root][choice];
        hydrateScene(state, variant.id); state.act = 3; state.actStartedAt = state.time;
        state.branchProgress.sacrifice += 1; state.branchProgress.escape += 1; state.branchProgress.boundary += 1;
        emit("system", choice === "yao" ? "苏遥的连续视线成为这一路事实的主要见证。" : choice === "luhui" ? "苏岚与陆洄的行动开始互相占用对方的历史。" : "没有人替苏岚命名；痕迹链成为唯一连续证明。");
      }
    }
  } else if (state.act === 3 && !state.routes.act3) {
    const candidates = ["sacrifice", "escape", "boundary"].map(key => [key, state.branchProgress[key]]).sort((a,b)=>b[1]-a[1]);
    const intent = state.flags.final_intent;
    const choice = intent || candidates[0][0];
    const boundaryIncomplete = choice === "boundary" && (state.flags.final_hold_progress || 0) < 1;
    const organicLead = candidates[0][1] >= 3 && candidates[0][1] >= candidates[1][1] + .75;
    if (state.time - state.actStartedAt >= ACT_MIN_SECONDS.act3 && !boundaryIncomplete && (intent || organicLead)) {
      if (commitRoute(state, "act3", choice)) state.ending = choice;
    }
  }
}
