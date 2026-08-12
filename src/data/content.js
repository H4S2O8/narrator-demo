export const AXES = {
  flare: ["loaded", "luhui_unloaded", "yao_unloaded"],
  backKey: ["luhui", "yao", "counter"],
  wetPhoto: ["yao_saw", "luhui_saw", "unseen"],
  pump: ["luhui_repaired", "sulan_repaired", "untouched"],
  door: ["front_unlatched", "back_unlatched", "both_latched"],
  film: ["portrait_loaded", "flood_loaded", "empty_camera"]
};

const eventTemplates = {
  flare: {
    loaded: [],
    luhui_unloaded: [{ at: -30, actor: "luhui", place: "counter", verb: "unload_flare" }],
    yao_unloaded: [{ at: -69, actor: "yao", place: "counter", verb: "unload_flare" }]
  },
  backKey: {
    luhui: [{ at: -61, actor: "luhui", place: "counter", verb: "take_back_key" }],
    yao: [{ at: -57, actor: "yao", place: "counter", verb: "take_back_key" }],
    counter: []
  },
  wetPhoto: {
    yao_saw: [{ at: -43, actor: "yao", place: "studio", verb: "see_wet_photo" }],
    luhui_saw: [{ at: -39, actor: "luhui", place: "studio", verb: "see_wet_photo" }],
    unseen: []
  },
  pump: {
    luhui_repaired: [{ at: -28, actor: "luhui", place: "darkroom", verb: "repair_pump" }],
    sulan_repaired: [{ at: -25, actor: "sulan", place: "darkroom", verb: "repair_pump" }],
    untouched: []
  },
  door: {
    front_unlatched: [{ at: -16, actor: "luoyi", place: "front", verb: "unlatch_front" }],
    back_unlatched: [{ at: -15, actor: "luhui", place: "back", verb: "unlatch_back" }],
    both_latched: []
  },
  film: {
    portrait_loaded: [{ at: -8, actor: "sulan", place: "studio", verb: "load_portrait_film" }],
    flood_loaded: [{ at: -7, actor: "yao", place: "studio", verb: "load_flood_film" }],
    empty_camera: []
  }
};

export function createWorldlines(anchors = []) {
  let id = 1;
  const worlds = [];
  for (const flare of AXES.flare)
    for (const backKey of AXES.backKey)
      for (const wetPhoto of AXES.wetPhoto)
        for (const pump of AXES.pump)
          for (const door of AXES.door)
            for (const film of AXES.film) {
            const axes = { flare, backKey, wetPhoto, pump, door, film };
            if (!anchors.every(anchor => axes[anchor.axis] === anchor.value)) continue;
            const events = Object.entries(axes).flatMap(([axis, value]) => eventTemplates[axis][value]);
            const collision = events.some((event, index) => events.slice(index + 1).some(other =>
              event.actor === other.actor && Math.abs(event.at - other.at) < 9 && event.place !== other.place
            ));
            if (collision) continue;
            worlds.push({ id: `W${String(id++).padStart(3, "0")}`, axes, events });
          }
  return worlds;
}

export const PAST = {
  H_FLARE_EMPTY: { id: "H_FLARE_EMPTY", axis: "flare", keep: ["luhui_unloaded", "yao_unloaded"], text: "信号枪的弹药在水进门以前已经被取出。", tags: ["flare_empty"] },
  H_LUHUI_UNLOADED: { id: "H_LUHUI_UNLOADED", axis: "flare", keep: ["luhui_unloaded"], text: "陆洄在三十秒前取出了信号枪弹药。", tags: ["flare_empty", "luhui_knows_flare", "luhui_darkroom_past"] },
  H_YAO_UNLOADED: { id: "H_YAO_UNLOADED", axis: "flare", keep: ["yao_unloaded"], text: "我在六十九秒前取出了信号枪弹药。", tags: ["flare_empty", "yao_knows_flare", "yao_counter_past"] },
  H_KEY_MOVED: { id: "H_KEY_MOVED", axis: "backKey", keep: ["luhui", "yao"], text: "后门钥匙已经被人从柜台拿走。", tags: ["key_moved"] },
  H_LUHUI_KEY: { id: "H_LUHUI_KEY", axis: "backKey", keep: ["luhui"], text: "陆洄在雨水进门以前拿走了后门钥匙。", tags: ["key_moved", "luhui_has_key"] },
  H_YAO_KEY: { id: "H_YAO_KEY", axis: "backKey", keep: ["yao"], text: "我在雨水进门以前拿走了后门钥匙。", tags: ["key_moved", "yao_has_key"] },
  H_PHOTO_SEEN: { id: "H_PHOTO_SEEN", axis: "wetPhoto", keep: ["yao_saw", "luhui_saw"], text: "那张受潮照片，当时已经有人看见。", tags: ["photo_seen"] },
  H_YAO_PHOTO: { id: "H_YAO_PHOTO", axis: "wetPhoto", keep: ["yao_saw"], text: "我在水来以前见过照片背面的字。", tags: ["photo_seen", "yao_knows_back"] },
  H_LUHUI_PHOTO: { id: "H_LUHUI_PHOTO", axis: "wetPhoto", keep: ["luhui_saw"], text: "陆洄在水来以前见过照片背面的字。", tags: ["photo_seen", "luhui_knows_back"] },
  H_PUMP_REPAIRED: { id: "H_PUMP_REPAIRED", axis: "pump", keep: ["luhui_repaired", "sulan_repaired"], text: "排水泵在停电以前已经被修过。", tags: ["pump_repaired"] },
  H_LUHUI_PUMP: { id: "H_LUHUI_PUMP", axis: "pump", keep: ["luhui_repaired"], text: "陆洄在二十八秒前修过排水泵。", tags: ["pump_repaired", "luhui_darkroom_past"] },
  H_SULAN_PUMP: { id: "H_SULAN_PUMP", axis: "pump", keep: ["sulan_repaired"], text: "你在二十五秒前修过排水泵。", tags: ["pump_repaired", "sulan_darkroom_past"] },
  H_DOOR_OPENABLE: { id: "H_DOOR_OPENABLE", axis: "door", keep: ["front_unlatched", "back_unlatched"], text: "洪水抵达以前，至少有一扇门的内闩已经松开。", tags: ["door_unlatched"] },
  H_BACK_UNLATCHED: { id: "H_BACK_UNLATCHED", axis: "door", keep: ["back_unlatched"], text: "陆洄在后门内闩上留下了松动。", tags: ["back_unlatched", "luhui_back_past"] }
  ,H_FILM_LOADED: { id: "H_FILM_LOADED", axis: "film", keep: ["portrait_loaded", "flood_loaded"], text: "停电以前，相机里已经装入了一卷胶片。", tags: ["camera_has_film"] }
  ,H_YAO_FILM: { id: "H_YAO_FILM", axis: "film", keep: ["flood_loaded"], text: "我在停电以前把洪水测试胶片装进了相机。", tags: ["camera_has_film", "yao_knows_camera", "yao_studio_past"] }
};

export const PROPHECIES = {
  P_RED_LINE: {
    id: "P_RED_LINE", duration: 12,
    text: "十二秒后，红色的水会越过门槛内侧那条粉笔线。",
    credit: ["粉笔线会保持可指认", "红色液体与一条越线水路会存在"],
    paths: [
      { id: "seep", label: "红色显影废液随渗水越线", flags: ["red_seep_ready"] },
      { id: "basin", label: "苏岚用盆里的红水抢占", flags: ["basin_red_water"] },
      { id: "yao_kick", label: "童年苏遥踢翻清洗桶", flags: ["yao_near_red_bucket"] }
    ]
  },
  P_YAO_SEES_STRIP: {
    id: "P_YAO_SEES_STRIP", duration: 14,
    text: "十四秒后，苏遥会看见试纸显出的颜色。",
    credit: ["兑现时苏遥能看见", "试纸颜色或其可见记录必须存在"],
    paths: [
      { id: "direct", label: "试纸留在视线中", flags: ["strip_visible"] },
      { id: "search", label: "苏遥寻找藏起的试纸", flags: ["strip_hidden"] },
      { id: "photo", label: "苏遥看见拍下的试纸", flags: ["strip_photo"] }
    ]
  },
  P_WATER_FROM_BASIN: {
    id: "P_WATER_FROM_BASIN", duration: 18,
    text: "十八秒后，水会从这只铁盆的边沿流出。",
    credit: ["铁盆会保持到足以盛水", "兑现时盆中有水且边沿可用"],
    paths: [
      { id: "player_pour", label: "苏岚主动倾倒", flags: ["basin_held", "basin_water"] },
      { id: "overflow", label: "持续漏水使铁盆溢出", flags: ["basin_under_leak"] },
      { id: "luhui_tip", label: "陆洄碰倒铁盆", flags: ["luhui_near_basin"] }
    ]
  },
  P_FLARE_HEAD: {
    id: "P_FLARE_HEAD", duration: 10,
    text: "十秒后，一枚弹丸会在陆洄扣动扳机以前的瞬间穿过红绳，射向你头部届时所在的位置。",
    credit: ["兑现时苏岚仍有可指认的头部位置", "一枚弹丸、发射工具和合法弹道必须存在"],
    paths: [
      { id: "foam_self", label: "苏岚用软弹枪朝自己头部位置射击", flags: ["foam_held", "near_red_rope"] },
      { id: "flare_luhui", label: "陆洄使用信号枪", flags: ["flare_loaded", "luhui_has_flare"] },
      { id: "projector", label: "放映机弹簧射出校准珠", flags: ["projector_armed"] }
    ]
  },
  P_HEAD_ABOVE_FRAME: {
    id: "P_HEAD_ABOVE_FRAME", duration: 19,
    text: "十九秒后，背景架的下沿会停在你头部届时所在高度之上。",
    credit: ["兑现时苏岚仍有头部位置", "背景架不会在兑现前彻底毁坏"],
    paths: [
      { id: "head_brace", label: "苏岚用头肩顶住背景架", flags: ["head_under_frame"] },
      { id: "counterweight", label: "配重悬起背景架", flags: ["frame_counterweighted"] },
      { id: "shelf", label: "背景架卡在高处", flags: ["frame_on_shelf"] }
    ]
  },
  P_SHADOW: {
    id: "P_SHADOW", duration: 16,
    text: "十六秒后，苏遥会在放映窗里看见你的轮廓。",
    credit: ["放映窗与光路在兑现前可用", "一个与苏岚轮廓相容的遮挡会出现"],
    paths: [
      { id: "body", label: "苏岚本人进入光路", flags: ["player_in_beam"] },
      { id: "coat", label: "外套和背景架组成轮廓", flags: ["coat_silhouette"] },
      { id: "film", label: "旧胶片投出苏岚轮廓", flags: ["sulan_film_loaded"] }
    ]
  },
  P_ROPE_TAUT: {
    id: "P_ROPE_TAUT", duration: 22,
    text: "二十二秒后，这根绳会在两个人之间保持绷紧。",
    credit: ["绳在兑现前不会断裂", "兑现时至少两端各有可承受拉力的对象"],
    paths: [
      { id: "sulan_luhui", label: "苏岚与陆洄分别持绳", flags: ["rope_with_luhui"] },
      { id: "sulan_yao", label: "苏岚与苏遥分别持绳", flags: ["rope_with_yao"] },
      { id: "body_anchor", label: "苏岚身体与屋顶构件形成两端", flags: ["rope_body_anchor"] }
    ]
  },
  P_TWO_RECORDS: {
    id: "P_TWO_RECORDS", duration: 28,
    text: "二十八秒后，两份互相矛盾的记录会同时留在这张照片上。",
    credit: ["照片在兑现前可留存两种痕迹", "至少两条不相容历史保持可表达"],
    paths: [
      { id: "two_witnesses", label: "苏遥与陆洄各写一面", flags: ["two_witnesses_ready"] },
      { id: "double_exposure", label: "连续曝光叠加互斥动作", flags: ["double_exposure_ready"] },
      { id: "water_ink", label: "水迹与墨迹保留相反方向", flags: ["water_ink_ready"] }
    ]
  }
};

export const ACT1 = {
  breach: { label: "破开前门", scene2: "roof", tags: ["front_breached", "fast_flood"], relation: { yao: 1, luhui: 0 }, description: "水贯穿照相馆，物品开始漂移，进入屋顶线。" },
  seal: { label: "封闭保压", scene2: "darkroom", tags: ["shop_sealed", "power_preserved"], relation: { yao: 0, luhui: -1 }, description: "泵和监控继续工作，墙外水压持续上升。" },
  cinema: { label: "穿墙入影院", scene2: "cinema", tags: ["cinema_open", "split_sightlines"], relation: { yao: 0, luhui: 1 }, description: "两个建筑相连，人物进入互不可见的区域。" }
};

export const ACT2 = {
  yao: { label: "让苏遥见证", tags: ["yao_witness_chain"], description: "童年苏遥持续确认母亲，但她也承担了不能移开视线的责任。" },
  luhui: { label: "与陆洄互证", tags: ["luhui_mutual_alibi"], description: "两人交换无法独自覆盖的现实，也交换了背叛的机会。" },
  alone: { label: "建立身体连续链", tags: ["embodied_chain"], description: "痕迹只证明同一身体，不替它命名；每个锚点都成为主动限制。" }
};

export const ACT3 = {
  sacrifice: { label: "成为那场牺牲", tags: ["ending_sacrifice"] },
  escape: { label: "活着离开", tags: ["ending_escape"] },
  boundary: { label: "不把死亡交给任何名字", tags: ["ending_boundary"] }
};

export const SCENE_VARIANTS = {
  roof: {
    yao: { id: "roof_yao", title: "招牌屋脊 · 苏遥视线", hazard: "glass", prophecy: "P_YAO_SEES_STRIP" },
    luhui: { id: "roof_luhui", title: "两段屋顶 · 共绳", hazard: "rope", prophecy: "P_ROPE_TAUT" },
    alone: { id: "roof_alone", title: "漂移楼梯 · 无人见证", hazard: "washout", prophecy: "P_HEAD_ABOVE_FRAME" }
  },
  darkroom: {
    yao: { id: "darkroom_yao", title: "监控暗房 · 两种看见", hazard: "screens", prophecy: "P_YAO_SEES_STRIP" },
    luhui: { id: "darkroom_luhui", title: "泵房夹层 · 互持开关", hazard: "pump", prophecy: "P_FLARE_HEAD" },
    alone: { id: "darkroom_alone", title: "带电货架 · 身体边界", hazard: "electric", prophecy: "P_HEAD_ABOVE_FRAME" }
  },
  cinema: {
    yao: { id: "cinema_yao", title: "放映窗 · 影子见证", hazard: "shadow", prophecy: "P_SHADOW" },
    luhui: { id: "cinema_luhui", title: "回声廊 · 人声分离", hazard: "echo", prophecy: "P_FLARE_HEAD" },
    alone: { id: "cinema_alone", title: "连续曝光 · 无名行动者", hazard: "film", prophecy: "P_TWO_RECORDS" }
  }
};

export const NARRATOR_NODES = {
  aim_at_yao: ["SILENCE", "H_FLARE_EMPTY", "H_LUHUI_UNLOADED"],
  aim_at_luhui: ["SILENCE", "H_FLARE_EMPTY", "H_YAO_UNLOADED"],
  leave_counter_unseen: ["SILENCE", "H_KEY_MOVED", "H_YAO_KEY", "H_LUHUI_KEY"],
  hide_photo: ["SILENCE", "H_PHOTO_SEEN", "H_YAO_PHOTO", "H_LUHUI_PHOTO"],
  use_camera: ["SILENCE", "H_FILM_LOADED", "H_YAO_FILM"],
  rely_on_pump: ["SILENCE", "H_PUMP_REPAIRED", "H_LUHUI_PUMP", "H_SULAN_PUMP"],
  approach_door: ["SILENCE", "H_DOOR_OPENABLE", "H_BACK_UNLATCHED"],
  tutorial_prophecy: ["P_RED_LINE"],
  act1_prophecy: ["P_WATER_FROM_BASIN", "P_YAO_SEES_STRIP"],
  final_prophecy: ["P_FLARE_HEAD", "P_HEAD_ABOVE_FRAME", "P_SHADOW", "P_ROPE_TAUT", "P_TWO_RECORDS"]
};

export const OBJECTS = {
  basin: { name: "铁盆", portable: true, weight: 2, sprite: 4 },
  flour: { name: "面粉袋", portable: true, weight: 1, sprite: 5 },
  strip: { name: "检测试纸", portable: true, weight: 0.1, sprite: 6 },
  camera: { name: "相机", portable: true, weight: 0.6, sprite: 7 },
  flare: { name: "信号枪", portable: true, weight: 1.1, sprite: 8 },
  foam: { name: "软弹校准枪", portable: true, weight: 0.7, sprite: 9 },
  rope: { name: "救援绳", portable: true, weight: 3, sprite: 10 },
  photo: { name: "受潮照片", portable: true, weight: 0.1, sprite: 11 },
  frame: { name: "背景架", portable: false, weight: 43, sprite: 12 },
  pump: { name: "排水泵", portable: false, weight: 70, sprite: 13 },
  breaker: { name: "总电闸", portable: false, weight: 20, sprite: 14 },
  frontDoor: { name: "卷帘门", portable: false, weight: 180, sprite: 15 },
  thinWall: { name: "影院薄墙", portable: false, weight: 260, sprite: 16 },
  redBucket: { name: "红色清洗桶", portable: true, weight: 6, sprite: 17 },
  chalkLine: { name: "门槛粉笔线", portable: false, weight: 0, sprite: 18 },
  projector: { name: "放映机", portable: false, weight: 22, sprite: 19 }
};

const baseLayout = {
  studio: {
    title: "潮汐照相馆",
    spawn: [120, 420],
    objects: {
      basin: [220, 370], flour: [170, 170], strip: [355, 405], camera: [320, 150], flare: [680, 315], foam: [250, 480],
      rope: [565, 180], photo: [450, 345], frame: [535, 390], pump: [820, 175], breaker: [860, 390], frontDoor: [900, 290],
      thinWall: [60, 285], redBucket: [730, 440], chalkLine: [770, 290]
    },
    npcs: { yao: [650, 230], luhui: [745, 395], luoyi: [610, 470] }
  },
  roof: { title: "被水切开的屋顶", spawn: [120, 430], objects: { rope: [430, 300], basin: [650, 420], strip: [760, 190], frame: [540, 410], flare: [780, 390], foam: [230, 450], camera: [335, 180] }, npcs: { yao: [700, 210], luhui: [820, 425], luoyi: [610, 470] } },
  darkroom: { title: "仍通电的暗房", spawn: [130, 420], objects: { pump: [760, 170], breaker: [850, 385], basin: [620, 390], frame: [510, 390], flare: [690, 315], foam: [210, 460], camera: [340, 160], strip: [420, 420], photo: [550, 200] }, npcs: { yao: [720, 230], luhui: [790, 410], luoyi: [610, 470] } },
  cinema: { title: "旧影院", spawn: [110, 425], objects: { projector: [760, 170], rope: [530, 250], frame: [500, 400], flare: [670, 320], foam: [215, 455], camera: [330, 170], strip: [420, 420], photo: [570, 210] }, npcs: { yao: [715, 225], luhui: [805, 405], luoyi: [610, 470] } }
};

export function sceneDefinition(id, loop = 1, inherited = {}) {
  const root = id.includes("_") ? id.split("_")[0] : id;
  const base = baseLayout[root] || baseLayout.studio;
  const missing = new Set(inherited.missingItems || []);
  const objects = Object.fromEntries(Object.entries(base.objects).filter(([key]) => !missing.has(key)).map(([key, pos]) => [key, {
    id: key, x: pos[0], y: pos[1], held: false, visible: true, state: {}
  }]));
  return { ...base, id, title: loop > 1 ? `${base.title} · 第${loop}遍` : base.title, objects, npcs: structuredClone(base.npcs) };
}

export const TUTORIAL = [
  ["move", "使用 WASD 移动。讲述中的时间持续前进；不行动也是行为。"],
  ["enter", "靠近人或物后按回车。时间暂停，你可以直接描述想做的事。"],
  ["hold", "双手真实持物，没有神奇背包。拿起的物品会离开地面，放下后留在当前位置。"],
  ["observe", "视线、相机、面粉和水迹都能压缩历史，但它们本身也是世界的一部分。"],
  ["future", "旁白说出的未来百分之百发生。争夺它怎样发生，并倒用它保证的最低条件。"],
  ["past", "旁白说出的过去会永久裁剪候选历史。它为眼前得利而固定的事实，也会限制很久以后。"]
];

export function routeKey(routes) { return `${routes.act1}-${routes.act2}-${routes.act3}`; }

export function endingCopy(state) {
  const key = routeKey(state.routes);
  const loop = state.meta.loop;
  const titles = { sacrifice: "一场有限的牺牲", escape: "活着而未被命名", boundary: "代价没有继承人" };
  const relation = state.routes.act2 === "yao" ? "苏遥记得母亲一直在视线里" : state.routes.act2 === "luhui" ? "陆洄的证词与苏岚互相锁住" : "没有人替行动者命名，痕迹仍连续";
  const reveal = loop === 1
    ? "柯宁问：如果她不是为了你死，你这些年又欠了谁？"
    : loop === 2
      ? "苏遥第一次承认，她反复压缩故事，不是为了记住母亲，而是想让所有未付代价在母亲身上结清。"
      : "柯宁没有继承这笔债。她也没有宣布任何人无辜；她把自己明天的选择留在了故事之外。";
  return { title: titles[state.routes.act3], key, paragraphs: [`${relation}。仍有 ${state.worlds.length} 条完整历史与这次讲述相容。`, reveal, `路径 ${key}；第 ${loop} 遍讲述结束。`] };
}
