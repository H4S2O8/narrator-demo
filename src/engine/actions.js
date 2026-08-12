import { ACTIONS, legalActions } from "../data/actions.js";
import { PAST, PROPHECIES, SCENE_VARIANTS } from "../data/content.js";
import { commitRoute, filterWorlds, hydrateScene, occupyProphecy, schedule, syncFlags } from "./state.js";

function releaseHand(state, id) {
  for (const hand of ["left", "right"]) if (state.player.hands[hand] === id) state.player.hands[hand] = null;
}

function take(state, id) {
  const object = state.objects[id];
  if (!object || object.held) return false;
  const hand = state.player.hands.left ? (state.player.hands.right ? null : "right") : "left";
  if (!hand) return false;
  object.held = true; object.visible = false;
  state.player.hands[hand] = id;
  object.x = state.player.x; object.y = state.player.y;
  return true;
}

function drop(state, id) {
  const object = state.objects[id];
  if (!object?.held) return false;
  releaseHand(state, id);
  object.held = false; object.visible = true; object.x = state.player.x; object.y = state.player.y;
  return true;
}

function addTrace(state, type, target = null) {
  const trace = { id: `T${state.traces.length + 1}`, type, target, x: state.player.x, y: state.player.y, createdAt: state.time, disturbed: false };
  state.traces.push(trace);
  return trace;
}

function addEffect(state, type, data = {}, duration = 0.8) {
  state.effects.push({ id: `E${state.effects.length + 1}`, type, at: state.time, duration, ...data });
}

function setProgress(state, pair) {
  if (!pair) return;
  const [key, amount] = pair;
  state.branchProgress[key] = Math.max(0, (state.branchProgress[key] || 0) + amount);
}

function setFlags(state, flags = {}) {
  Object.assign(state.flags, flags);
}

export function executeAction(state, action, context) {
  const effect = action.effect;
  const result = { ok: true, action, messages: [], narratorNode: effect.narratorNode || null };
  state.stats.actions += 1;
  switch (effect.type) {
    case "take":
      result.ok = take(state, effect.target);
      result.messages.push(result.ok ? `苏岚拿起了${state.objects[effect.target].name}。` : "双手已经没有空位。 ");
      break;
    case "drop":
      result.ok = drop(state, effect.target);
      result.messages.push(result.ok ? `苏岚把${state.objects[effect.target].name}放在脚边。` : "手里没有这件东西。 ");
      break;
    case "wait":
      schedule(state, effect.duration, "wait_complete", { duration: effect.duration });
      result.messages.push(`苏岚决定在原地等${effect.duration}秒。`);
      break;
    case "pose":
      state.player.pose = effect.pose;
      result.messages.push(effect.pose === "stand" ? "苏岚站直身体。" : effect.pose === "crawl" ? "苏岚伏低身体。" : "苏岚蹲了下来。");
      break;
    case "pose_at":
      state.player.pose = effect.pose; setFlags(state, effect.flags);
      result.messages.push("苏岚把头和肩伸进背景架下方。木梁的重量仍由支点承担。");
      break;
    case "place": {
      const object = state.objects[effect.target];
      drop(state, effect.target); setFlags(state, effect.flags);
      if (effect.at === "seep") { object.x = 810; object.y = 330; schedule(state, 4, "basin_fill", { color: "clear" }); }
      result.messages.push(`${object.name}被放到了${effect.at === "seep" ? "渗水路径下" : "指定位置"}。`);
      break;
    }
    case "mutate":
      Object.assign(state.objects[effect.target]?.state || {}, effect.state); setFlags(state, effect.flags);
      result.messages.push(`${state.objects[effect.target]?.name || "物体"}的状态发生了变化。`);
      break;
    case "pour": {
      const basin = state.objects.basin;
      const wasRed = basin?.state.water === "red";
      if (basin) basin.state.water = null;
      setFlags(state, effect.flags);
      if (effect.target === "chalkLine") addTrace(state, wasRed ? "red_water_line" : "water_line", "chalkLine");
      if (effect.target === "breaker") state.environment.power = false;
      if (effect.prophecy) occupyProphecy(state, effect.prophecy[0], effect.prophecy[1]);
      result.messages.push(`水从铁盆边沿流向${effect.target === "chalkLine" ? "粉笔线另一侧" : effect.target === "breaker" ? "电闸下方" : "地面"}。`);
      break;
    }
    case "transfer": {
      const from = state.objects[effect.from], to = state.objects[effect.to];
      if (from) from.state.water = null;
      if (to) to.state.water = effect.liquid;
      setFlags(state, effect.flags);
      result.messages.push("红色清洗水从桶中转移到铁盆。桶的重量、盆的内容和两件物品的位置同时改变。 ");
      break;
    }
    case "roll": {
      const object = state.objects[effect.target], toward = state.objects[effect.toward];
      if (object && toward) { object.x += (toward.x-object.x)*.65; object.y += (toward.y-object.y)*.65; object.state.rolling = true; }
      setFlags(state, effect.flags); if (effect.prophecy) occupyProphecy(state,effect.prophecy[0],effect.prophecy[1],"player_setup");
      result.messages.push("清洗桶滚向粉笔线。它的路径会被地面坡度、积水和碰撞继续改变。 ");
      break;
    }
    case "equip_head":
      state.player.headItem = effect.target; setFlags(state, effect.flags);
      result.messages.push("铁盆罩住头部，也遮挡了上方视野并放大雨声。 ");
      break;
    case "trace":
      addTrace(state, effect.trace, effect.target); setFlags(state, effect.flags); setProgress(state, effect.progress);
      result.messages.push("面粉落在地面和附近物体上。它既是痕迹，也会被水、鞋底和风继续带走。 ");
      break;
    case "hide": {
      const object = state.objects[effect.target];
      drop(state, effect.target); object.visible = false; object.state.hidden = effect.at; setFlags(state, effect.flags);
      result.messages.push(`${object.name}被藏在${effect.at === "frame" ? "背景架下" : "相册夹层"}。`);
      break;
    }
    case "record":
      if ((effect.target === "strip" || effect.target === "footprints" || effect.target === "photo") && state.flags.camera_maybe_empty && !state.flags.camera_has_film) {
        result.narratorNode = result.narratorNode || "use_camera";
        result.messages.push("快门落下，但相机里是否有可曝光胶片仍属于几条不同历史。 ");
      } else {
        setFlags(state, effect.flags); addTrace(state, `record_${effect.target}`, effect.target); setProgress(state, effect.progress);
        result.messages.push("快门落下。这份记录也固定了相机位置、光路和拍摄者当时的时间。 ");
      }
      break;
    case "monitor": {
      drop(state, "camera"); setFlags(state, effect.flags); setProgress(state, effect.progress);
      const monitor = { id: `M${state.observations.length + 1}`, target: effect.target, start: state.time, active: true };
      state.observations.push(monitor);
      if (effect.excludes) {
        filterWorlds(state, world => !effect.excludes.values.includes(world.axes[effect.excludes.axis]), `相机持续监控${effect.target}`);
      }
      result.messages.push(`相机开始持续记录${effect.target === "player" ? "苏岚" : effect.target}。它无法同时拍摄其他方向。`);
      break;
    }
    case "inspect":
      if (effect.axis) {
        const values = [...new Set(state.worlds.map(world => world.axes[effect.axis]))];
        if (values.length === 1) result.messages.push(`检查结果已经唯一：${values[0]}。`);
        else result.messages.push("检查动作开始。在结果被读出以前，旁白仍有一次合法介入窗口。 ");
        result.narratorNode = result.narratorNode || (effect.axis === "flare" ? "aim_at_luhui" : null);
        schedule(state, 0.8, "inspection_resolve", { axis: effect.axis, target: effect.target });
      } else {
        result.messages.push(effect.target === "photo_back" ? "照片背面有一行被水泡开的字，最后一个名字无法辨认。" : effect.target === "wall_sound" ? "墙后有拖动物品的声音，也可能是松动的座椅。" : "苏岚仔细看了一遍。 ");
      }
      break;
    case "inspect_trace": {
      const traces = state.traces.filter(trace => trace.type.startsWith(effect.trace));
      const touched = [...new Set(traces.flatMap(trace => trace.touchedBy || []))];
      const disturbed = traces.some(trace => trace.disturbed);
      result.messages.push(!traces.length ? "这里没有可检查的面粉痕迹。" : `面粉${disturbed ? "已被水带动" : "没有整体移位"}${touched.length ? `，其中有${touched.map(id=>state.npcs[id]?.name||id).join("、")}留下的接触` : "，尚未发现人的鞋底接触"}。`);
      break;
    }
    case "aim":
      state.player.aimingAt = effect.target;
      result.messages.push(`苏岚举起信号枪，瞄准${effect.target === "player" ? "自己头部届时的位置" : state.npcs[effect.target].name}。`);
      break;
    case "fire": {
      const target = effect.target || state.player.aimingAt;
      const targetEntity = target === "player" ? state.player : state.npcs[target] || state.objects[target];
      addEffect(state, "shot", {
        weapon: effect.weapon,
        empty: effect.weapon !== "foam" && state.flags.flare_empty,
        from: { x: state.player.x, y: state.player.y - 12 },
        to: targetEntity ? { x: targetEntity.x, y: targetEntity.y - 12 } : { x: state.player.x + 260, y: state.player.y - 12 }
      }, 0.65);
      if (effect.weapon === "foam") {
        setFlags(state, effect.flags); if (effect.prophecy) occupyProphecy(state, effect.prophecy[0], effect.prophecy[1]);
        result.messages.push(target === "player" ? "软弹越过红绳，击中苏岚头侧的铁盆边缘。" : "软弹击中目标，没有造成贯穿伤。 ");
      } else if (state.flags.flare_empty) {
        result.messages.push("扳机落下。空膛里只有击锤声。 ");
      } else {
        result.messages.push("信号弹离开枪膛。 ");
        if (target && state.npcs[target]) { state.npcs[target].health -= 2; if (state.npcs[target].health <= 0) state.npcs[target].alive = false; }
        if (target === "player") state.player.health -= 2;
      }
      state.player.aimingAt = null;
      break;
    }
    case "equip_body": setFlags(state, effect.flags); result.messages.push("救援绳系在苏岚腰间，之后的拉力会直接作用在身体上。 "); break;
    case "give_end": setFlags(state, effect.flags); setProgress(state, effect.progress); result.messages.push(`${state.npcs[effect.target].name}接住绳的另一端。`); break;
    case "tie": setFlags(state, effect.flags); setProgress(state, effect.progress); addTrace(state, "rope_knot", effect.target); result.messages.push("绳结固定下来。结法、受力方向和解开时间都成为后续事实。 "); break;
    case "body_anchor": setFlags(state, effect.flags); setProgress(state, effect.progress); addEffect(state, "rope_tension", {}, 1.4); result.messages.push("苏岚把自己的重量交给绳。她不能再自由移动而不改变整条受力链。 "); break;
    case "drag": {
      const object=state.objects[effect.target]; if(object){object.x=state.player.x+45;object.y=state.player.y;}
      setFlags(state,effect.flags);setProgress(state,effect.progress);addTrace(state,"drag_mark",effect.target);
      result.messages.push("绳的拉力拖动背景架，地面留下与移动方向一致的擦痕。 ");break;
    }
    case "float": {
      const object=state.objects[effect.target];drop(state,effect.target);object.state.floating=true;setFlags(state,effect.flags);addTrace(state,"float_start",effect.target);
      result.messages.push("照片落入水面，沿真实水流开始漂移。它也不再由苏岚直接控制。 ");break;
    }
    case "give": {
      drop(state, effect.item); state.objects[effect.item].visible = false; state.objects[effect.item].state.heldBy = effect.target;
      setFlags(state, effect.flags); setProgress(state, effect.progress);
      result.messages.push(`${state.npcs[effect.target].name}接过${state.objects[effect.item].name}。`);
      break;
    }
    case "brace": setFlags(state, effect.flags); setProgress(state, effect.progress); addEffect(state, "brace", { target: effect.target }, 1.1); if (effect.prophecy) occupyProphecy(state, effect.prophecy[0], effect.prophecy[1]); result.messages.push("苏岚维持住受力姿势。移动、受伤或积水都会改变支撑结果。 "); break;
    case "damage": {
      const object = state.objects[effect.target]; object.state.damage = (object.state.damage || 0) + effect.amount; setProgress(state, effect.progress);
      if (object.state.damage >= 3) { object.state.broken = true; state.flags[`${effect.target}_broken`] = true; }
      addEffect(state, object.state.broken ? "wall_break" : "impact", { x: object.x, y: object.y }, object.state.broken ? 1.25 : 0.55);
      result.messages.push(`${object.name}受到撞击${object.state.broken ? "，结构被打穿" : "，但还没有完全破开"}。`);
      break;
    }
    case "repair": setFlags(state, effect.flags); setProgress(state, effect.progress); schedule(state, 2.5, "repair_complete", { target: effect.target }); result.messages.push("维修开始。苏岚需要在附近维持动作，离开会留下未完成状态。 "); break;
    case "toggle": setFlags(state, effect.flags); if (effect.target === "pump") state.environment.pump = effect.value; setProgress(state, effect.progress); result.messages.push("机械状态切换，水压开始按新条件演化。 "); break;
    case "power": state.environment.power = effect.value; setProgress(state, effect.progress); result.messages.push(effect.value ? "照明、泵和监控同时恢复。" : "照明、泵和监控同时失去供电。 "); break;
    case "door": setFlags(state, effect.flags); setProgress(state, effect.progress); state.flags[`door_${effect.mode}`] = true; addEffect(state, effect.mode === "open" ? "flood_burst" : "door_lock", {}, 1.3); result.messages.push(effect.mode === "open" ? "卷帘门离开地面，外侧水压立刻作用进来。" : effect.mode === "seal" ? "门缝被封住，墙外水压继续增加。" : "铁盆卡进门底，门获得一条新的开启路径。 "); break;
    case "command_npc": {
      const npc = state.npcs[effect.target]; npc.goal = effect.command; npc.target = context.namedObject?.id || context.nearObjects[0]?.id || null;
      setFlags(state, effect.flags); setProgress(state, effect.progress);
      result.messages.push(`${npc.name}听见了。她/他会按自己的动机判断是否照做，而不是变成玩家的遥控物。`);
      break;
    }
    case "position": setFlags(state, effect.flags); if (effect.prophecy) occupyProphecy(state, effect.prophecy[0], effect.prophecy[1]); result.messages.push("苏岚进入放映光路，身体切断了银幕上的画面。 "); break;
    case "ending_progress":
      if (effect.choice === "boundary") {
        state.flags.eyes_closed_final = true;
        state.finalHold = { startedAt: state.time, required: 6.5, active: true, interrupted: false };
        addEffect(state, "final_hold", {}, 6.5);
        result.messages.push("苏岚闭上眼，停止校准时刻，只维持受力。按住 H；松开或重新检查会中断。 ");
      }
      else result.messages.push(effect.choice === "escape" ? "苏岚开始把现有行动链引向共同出口。" : "苏岚把苏遥推向可获救的位置，自己留在当前受力点。 ");
      if(effect.choice!=="boundary")state.branchProgress[effect.choice] += effect.amount;
      break;
    case "route": {
      result.ok = commitRoute(state, effect.act, effect.choice);
      if (!result.ok) break;
      if (effect.act === "act1") {
        hydrateScene(state, effect.choice === "breach" ? "roof" : effect.choice === "seal" ? "darkroom" : "cinema");
        state.act = 2;
        result.messages.push("洪水改变了建筑的可行路径。后面的故事不会回到同一个房间。 ");
      } else if (effect.act === "act2") {
        const root = state.sceneId.split("_")[0];
        const variant = SCENE_VARIANTS[root][effect.choice];
        hydrateScene(state, variant.id); state.act = 3;
        state.branchProgress.sacrifice += 1; state.branchProgress.escape += 1; state.branchProgress.boundary += 1;
        result.messages.push(`连续性被交给${effect.choice === "yao" ? "童年苏遥的视线" : effect.choice === "luhui" ? "陆洄与苏岚的互证" : "苏岚主动维持的痕迹链"}。`);
      } else {
        state.ending = effect.choice;
        result.messages.push("这一遍讲述抵达了无法再省略的位置。 ");
      }
      break;
    }
    default:
      result.ok = false; result.messages.push("这项行动还没有可靠的世界规则。 ");
  }
  setFlags(state, effect.flags); setProgress(state, effect.progress); syncFlags(state);
  state.timeline.push({ at: state.time, kind: "action", id: action.id, ok: result.ok });
  return result;
}

export function fallbackParse(context) {
  const legal = legalActions(context);
  let best = null;
  let bestScore = -1;
  for (const candidate of legal) {
    let score = 0;
    for (const phrase of candidate.phrases) {
      if (context.text.includes(phrase)) score += phrase.length * 3;
      else for (const char of phrase) if (context.text.includes(char)) score += 0.15;
    }
    if (candidate.effect.target && context.namedObject?.id === candidate.effect.target) score += 5;
    if (candidate.effect.target && context.namedNpc?.id === candidate.effect.target) score += 5;
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  return bestScore >= 1.2 ? { action: best, confidence: Math.min(0.92, bestScore / 12), source: "rules" } : null;
}

export function getAction(id) { return ACTIONS.find(item => item.id === id); }

export function validateEffectReferences() {
  const issues = [];
  for (const item of ACTIONS) {
    if (item.effect.prophecy && !PROPHECIES[item.effect.prophecy[0]]) issues.push(`${item.id}: missing prophecy ${item.effect.prophecy[0]}`);
    if (item.effect.act === "act1" && !["breach", "seal", "cinema"].includes(item.effect.choice)) issues.push(`${item.id}: bad act1 route`);
    if (item.effect.act === "act2" && !["yao", "luhui", "alone"].includes(item.effect.choice)) issues.push(`${item.id}: bad act2 route`);
    if (item.effect.act === "act3" && !["sacrifice", "escape", "boundary"].includes(item.effect.choice)) issues.push(`${item.id}: bad act3 route`);
  }
  for (const id of Object.keys(PAST)) if (!PAST[id].text) issues.push(`${id}: no text`);
  return issues;
}
