const isNear = (c, id, range = 105) => c.nearIds.includes(id) || c.heldIds.includes(id) || (c.object(id) && Math.hypot(c.state.player.x - c.object(id).x, c.state.player.y - c.object(id).y) <= range);
const has = (c, id) => c.heldIds.includes(id);
const free = c => c.freeHand;

function action(id, label, phrases, available, effect, help = "") {
  return { id, label, phrases, available, effect, help };
}

const takeActions = ["basin", "flour", "strip", "camera", "flare", "foam", "rope", "photo", "redBucket"].map(id =>
  action(`take_${id}`, `拿起${id}`, ["拿", "拿起", "捡", "抓起"], c => free(c) && isNear(c, id) && !has(c, id), { type: "take", target: id }, "需要空闲的一只手并靠近物品。")
);

const dropActions = ["basin", "flour", "strip", "camera", "flare", "foam", "rope", "photo", "redBucket"].map(id =>
  action(`drop_${id}`, `放下${id}`, ["放", "放下", "丢下", "扔下"], c => has(c, id), { type: "drop", target: id }, "物品会留在当前位置，不进入背包。")
);

export const ACTIONS = [
  ...takeActions,
  ...dropActions,
  action("wait_short", "等待三秒", ["等", "等待", "什么也不做", "停三秒"], () => true, { type: "wait", duration: 3 }),
  action("wait_long", "等待八秒", ["等八秒", "一直等", "不动"], () => true, { type: "wait", duration: 8 }),
  action("crouch", "蹲下", ["蹲", "蹲下", "压低身体"], c => c.state.player.pose !== "crouch", { type: "pose", pose: "crouch" }),
  action("crawl", "趴下", ["趴下", "爬", "伏低", "钻"], c => c.state.player.pose !== "crawl", { type: "pose", pose: "crawl" }),
  action("stand", "站起", ["站起来", "起身", "站直"], c => c.state.player.pose !== "stand", { type: "pose", pose: "stand" }),

  action("basin_under_seep", "把铁盆放到渗水下", ["用盆接水", "把盆放到漏水下面", "盆接水"], c => has(c, "basin") && isNear(c, "frontDoor", 180), { type: "place", target: "basin", at: "seep", flags: { basin_under_leak: true } }),
  action("fill_basin_red", "用红色清洗水装满铁盆", ["盆装红水", "接红色的水", "把红水倒进盆"], c => has(c, "basin") && isNear(c, "redBucket", 120), { type: "mutate", target: "basin", state: { water: "red" }, flags: { basin_red_water: true, basin_water: true } }),
  action("fill_basin_clear", "用渗水装满铁盆", ["盆装水", "接清水", "用盆接漏水"], c => has(c, "basin") && c.state.environment.water > 0.04, { type: "mutate", target: "basin", state: { water: "clear" }, flags: { basin_water: true } }),
  action("pour_basin_line", "把盆中水泼过粉笔线", ["泼过线", "把水倒过粉笔线", "往门槛倒水", "泼水"], c => has(c, "basin") && c.object("basin")?.state.water && isNear(c, "chalkLine", 150), { type: "pour", target: "chalkLine", prophecy: ["P_RED_LINE", "basin"] }),
  action("pour_basin_breaker", "把盆中水泼向电闸下方", ["往电闸泼水", "把水倒在电闸旁"], c => has(c, "basin") && c.object("basin")?.state.water && isNear(c, "breaker", 150), { type: "pour", target: "breaker", flags: { breaker_floor_wet: true } }),
  action("tip_basin", "侧放铁盆让水从边沿流出", ["侧过盆", "让盆里的水流出来", "倾斜铁盆"], c => has(c, "basin") && c.object("basin")?.state.water, { type: "pour", target: "floor", prophecy: ["P_WATER_FROM_BASIN", "player_pour"] }),
  action("empty_red_bucket_basin", "把清洗桶的红水倒入铁盆", ["红桶倒进盆", "把清洗水倒入铁盆", "转移红水"], c => has(c, "redBucket") && isNear(c, "basin", 110), { type: "transfer", from: "redBucket", to: "basin", liquid: "red", flags: { basin_red_water: true, basin_water: true } }),
  action("roll_red_bucket_line", "把清洗桶滚向粉笔线", ["滚红桶", "把桶踢向粉笔线", "推桶过线"], c => isNear(c, "redBucket", 105) && isNear(c, "chalkLine", 190), { type: "roll", target: "redBucket", toward: "chalkLine", flags: { red_bucket_rolling: true }, prophecy: ["P_RED_LINE", "yao_kick"] }),
  action("shield_with_basin", "用铁盆护住头部", ["盆扣头上", "用盆挡头", "铁盆护头"], c => has(c, "basin"), { type: "equip_head", target: "basin", flags: { metal_head_cover: true } }),
  action("strike_wall_basin", "用铁盆砸薄墙", ["用盆砸墙", "铁盆敲墙"], c => has(c, "basin") && isNear(c, "thinWall", 125), { type: "damage", target: "thinWall", amount: 1, progress: ["cinema", 2] }),

  action("spread_flour_ring", "在当前位置撒面粉圈", ["撒面粉圈", "用面粉围一圈", "面粉做记号"], c => has(c, "flour"), { type: "trace", trace: "flour_ring", amount: 1, progress: ["alone", 1] }),
  action("spread_flour_door", "沿门槛撒面粉", ["门口撒面粉", "沿门撒面粉", "监视门口"], c => has(c, "flour") && isNear(c, "frontDoor", 150), { type: "trace", trace: "flour_door", amount: 1, flags: { flour_at_door: true }, progress: ["alone", 1] }),
  action("dust_flare", "给信号枪表面撒面粉", ["枪上撒面粉", "用面粉标记枪"], c => has(c, "flour") && isNear(c, "flare", 110), { type: "trace", trace: "flour_flare", amount: 1, flags: { flare_dusted: true } }),
  action("dust_key_counter", "给钥匙位置撒面粉", ["钥匙边撒面粉", "柜台撒面粉"], c => has(c, "flour") && c.state.sceneId === "studio", { type: "trace", trace: "flour_key", amount: 1, flags: { key_area_dusted: true } }),
  action("throw_flour_water", "把面粉撒进水里观察流向", ["面粉撒水里", "看水流", "测水流方向"], c => has(c, "flour") && c.state.environment.water > 0.03, { type: "trace", trace: "flour_current", amount: 1, flags: { current_known: true } }),
  action("inspect_flour_trace", "检查面粉痕迹是否被扰动", ["检查面粉", "看面粉圈", "谁踩了面粉"], c => c.state.traces.some(t => t.type.startsWith("flour")), { type: "inspect_trace", trace: "flour" }),
  action("photograph_footprints", "拍摄水迹与脚印", ["拍脚印", "记录水迹", "相机拍地面痕迹"], c => has(c, "camera") && c.state.traces.length > 0, { type: "record", target: "footprints", flags: { footprints_recorded: true }, progress: ["alone", 1] }),

  action("test_red_water", "用试纸检测红色水", ["试纸测红水", "检测红水", "试纸碰水"], c => has(c, "strip") && (isNear(c, "redBucket", 130) || c.object("basin")?.state.water === "red"), { type: "mutate", target: "strip", state: { color: "violet", wet: true }, flags: { strip_visible: true } }),
  action("test_clear_water", "用试纸检测地面积水", ["试纸测地上的水", "检测积水"], c => has(c, "strip") && c.state.environment.water > 0.04, { type: "mutate", target: "strip", state: { color: "amber", wet: true }, flags: { strip_visible: true } }),
  action("hide_strip_frame", "把试纸藏到背景架下", ["把试纸藏起来", "试纸塞架子下面", "藏试纸"], c => has(c, "strip") && isNear(c, "frame", 120), { type: "hide", target: "strip", at: "frame", flags: { strip_hidden: true, strip_visible: false } }),
  action("pin_strip_wall", "把试纸贴在墙上", ["试纸贴墙", "把试纸挂起来"], c => has(c, "strip") && isNear(c, "thinWall", 130), { type: "place", target: "strip", at: "thinWall", flags: { strip_visible: true } }),
  action("photograph_strip", "拍下试纸颜色", ["给试纸拍照", "拍颜色", "记录试纸"], c => has(c, "camera") && isNear(c, "strip", 100), { type: "record", target: "strip", flags: { strip_photo: true } }),

  action("camera_watch_flare", "架相机持续拍信号枪", ["监控信号枪", "相机看着枪", "拍着枪"], c => has(c, "camera") && isNear(c, "flare", 150), { type: "monitor", target: "flare", excludes: { axis: "flare", values: ["luhui_unloaded", "yao_unloaded"] }, progress: ["alone", 1] }),
  action("camera_watch_door", "架相机拍门口", ["监控门口", "相机看门", "拍门"], c => has(c, "camera") && isNear(c, "frontDoor", 170), { type: "monitor", target: "frontDoor", flags: { door_monitored: true }, progress: ["alone", 1] }),
  action("camera_watch_yao", "架相机持续拍苏遥", ["监控苏遥", "拍苏遥", "相机跟着苏遥"], c => has(c, "camera") && c.state.npcs.yao.alive, { type: "monitor", target: "yao", flags: { yao_monitored: true }, progress: ["yao", 1] }),
  action("camera_watch_luhui", "架相机持续拍陆洄", ["监控陆洄", "拍陆洄", "相机跟着陆洄"], c => has(c, "camera") && c.state.npcs.luhui.alive, { type: "monitor", target: "luhui", flags: { luhui_monitored: true }, progress: ["luhui", 1] }),
  action("camera_timer_self", "设置定时自拍记录动作连续性", ["定时自拍", "相机拍我", "记录我自己"], c => has(c, "camera"), { type: "monitor", target: "player", flags: { self_timer_chain: true }, progress: ["alone", 2] }),
  action("camera_photo_photo", "拍摄受潮照片的正反面", ["拍那张照片", "记录照片背面", "翻拍照片"], c => has(c, "camera") && isNear(c, "photo", 100), { type: "record", target: "photo", flags: { wet_photo_copied: true } }),
  action("inspect_camera_film", "检查相机里装着哪卷胶片", ["检查相机胶片", "看相机里有什么", "打开相机后盖"], c => has(c, "camera"), { type: "inspect", target: "camera", axis: "film", narratorNode: "use_camera" }),

  action("inspect_flare", "检查信号枪弹膛", ["检查信号枪", "看枪里有没有弹", "验枪"], c => has(c, "flare"), { type: "inspect", target: "flare", axis: "flare" }),
  action("aim_flare_yao", "用信号枪瞄准苏遥", ["瞄准苏遥", "枪指苏遥", "拿枪对着苏遥"], c => has(c, "flare") && c.state.npcs.yao.alive, { type: "aim", target: "yao", narratorNode: "aim_at_yao" }),
  action("aim_flare_luhui", "用信号枪瞄准陆洄", ["瞄准陆洄", "枪指陆洄", "拿枪对着陆洄"], c => has(c, "flare") && c.state.npcs.luhui.alive, { type: "aim", target: "luhui", narratorNode: "aim_at_luhui" }),
  action("aim_flare_self", "把信号枪对准自己的头部位置", ["瞄准自己", "枪对着我", "信号枪对头"], c => has(c, "flare"), { type: "aim", target: "player" }),
  action("fire_flare", "扣动信号枪扳机", ["开枪", "发射信号枪", "扣扳机"], c => has(c, "flare") && Boolean(c.state.player.aimingAt), { type: "fire", weapon: "flare" }),
  action("fire_foam_self", "用软弹朝自己的头部位置射击", ["软弹枪打自己", "软弹射我的头", "朝自己开软弹"], c => has(c, "foam"), { type: "fire", weapon: "foam", target: "player", prophecy: ["P_FLARE_HEAD", "foam_self"] }),
  action("fire_foam_rope", "用软弹射过红绳", ["软弹穿过红绳", "朝红绳射", "软弹枪射绳"], c => has(c, "foam") && c.state.flags.near_red_rope, { type: "fire", weapon: "foam", target: "rope", flags: { foam_crossed_rope: true } }),
  action("fire_foam_switch", "用软弹撞击远处开关", ["软弹打开关", "射电闸", "用软弹开机关"], c => has(c, "foam") && isNear(c, "breaker", 260), { type: "fire", weapon: "foam", target: "breaker", flags: { remote_switch_hit: true } }),

  action("tie_rope_player", "把救援绳系在自己腰上", ["绳绑腰", "把绳系身上", "绳子绑我"], c => has(c, "rope"), { type: "equip_body", target: "rope", flags: { rope_on_player: true }, progress: ["alone", 1] }),
  action("give_rope_yao", "把绳的另一端交给苏遥", ["绳给苏遥", "让苏遥抓绳", "和苏遥拉绳"], c => has(c, "rope") && c.nearNpcIds.includes("yao"), { type: "give_end", target: "yao", flags: { rope_with_yao: true }, progress: ["yao", 2] }),
  action("give_rope_luhui", "把绳的另一端交给陆洄", ["绳给陆洄", "让陆洄抓绳", "和陆洄拉绳"], c => has(c, "rope") && c.nearNpcIds.includes("luhui"), { type: "give_end", target: "luhui", flags: { rope_with_luhui: true }, progress: ["luhui", 2] }),
  action("tie_rope_frame", "把救援绳系在背景架上", ["绳系架子", "背景架绑绳", "固定背景架"], c => has(c, "rope") && isNear(c, "frame", 115), { type: "tie", target: "frame", flags: { frame_counterweighted: true } }),
  action("tie_rope_door", "把救援绳系在卷帘门上", ["绳系门", "拉卷帘门", "门上绑绳"], c => has(c, "rope") && isNear(c, "frontDoor", 130), { type: "tie", target: "frontDoor", flags: { door_rope: true }, progress: ["breach", 1] }),
  action("body_anchor_rope", "用身体重量绷紧救援绳", ["用身体拉住绳", "拿自己当锚", "身体压绳"], c => c.state.flags.rope_on_player, { type: "body_anchor", target: "rope", flags: { rope_body_anchor: true }, progress: ["boundary", 2] }),
  action("drag_frame_rope", "用救援绳拖动背景架", ["绳拖背景架", "拉动架子", "用绳把架子拖走"], c => has(c, "rope") && isNear(c, "frame", 150), { type: "drag", target: "frame", flags: { frame_moved_by_rope: true }, progress: ["cinema", 1] }),

  action("read_photo_front", "查看受潮照片正面", ["看照片", "检查照片正面", "照片是什么"], c => isNear(c, "photo", 100) || has(c, "photo"), { type: "inspect", target: "photo_front" }),
  action("read_photo_back", "翻看受潮照片背面", ["看照片背面", "翻照片", "背面写了什么"], c => isNear(c, "photo", 100) || has(c, "photo"), { type: "inspect", target: "photo_back", narratorNode: "hide_photo" }),
  action("give_photo_yao", "把受潮照片交给苏遥", ["照片给苏遥", "让苏遥看照片"], c => has(c, "photo") && c.nearNpcIds.includes("yao"), { type: "give", target: "yao", item: "photo", flags: { yao_holds_photo: true }, progress: ["yao", 1] }),
  action("give_photo_luhui", "把受潮照片交给陆洄", ["照片给陆洄", "让陆洄看照片"], c => has(c, "photo") && c.nearNpcIds.includes("luhui"), { type: "give", target: "luhui", item: "photo", flags: { luhui_holds_photo: true }, progress: ["luhui", 1] }),
  action("hide_photo", "把受潮照片藏进相册夹层", ["藏照片", "把照片收起来", "照片塞夹层"], c => has(c, "photo"), { type: "hide", target: "photo", at: "album", narratorNode: "hide_photo" }),
  action("wedge_photo_door", "用受潮照片试探门缝水流", ["照片塞门缝", "用照片测门缝", "照片堵门"], c => has(c, "photo") && isNear(c, "frontDoor", 115), { type: "place", target: "photo", at: "door_gap", flags: { door_current_marked: true } }),
  action("float_photo", "让受潮照片随水漂流", ["把照片放水里", "让照片漂走", "用照片看水流"], c => has(c, "photo") && c.state.environment.water > 0.08, { type: "float", target: "photo", flags: { photo_afloat: true, current_known: true } }),

  action("head_under_frame", "把头肩伸到背景架下", ["头伸架子下面", "钻到背景架下", "拿头顶架子"], c => isNear(c, "frame", 115), { type: "pose_at", pose: "crawl", target: "frame", flags: { head_under_frame: true } }),
  action("brace_frame_head", "用头肩顶住背景架", ["用头顶住背景架", "头肩支撑", "用头扛架子"], c => c.state.flags.head_under_frame, { type: "brace", target: "frame", flags: { body_supporting_frame: true }, progress: ["boundary", 2], prophecy: ["P_HEAD_ABOVE_FRAME", "head_brace"] }),
  action("push_frame_wall", "推倒背景架撞击薄墙", ["背景架撞墙", "推架子砸墙", "用背景架破墙"], c => isNear(c, "frame", 120) && isNear(c, "thinWall", 210), { type: "damage", target: "thinWall", amount: 3, progress: ["cinema", 3] }),
  action("prop_frame_door", "用背景架抵住卷帘门", ["背景架顶门", "用架子堵门", "架子抵住门"], c => isNear(c, "frame", 120) && isNear(c, "frontDoor", 210), { type: "brace", target: "frontDoor", flags: { door_braced: true }, progress: ["seal", 2] }),
  action("hang_coat_frame", "把外套挂在背景架上组成轮廓", ["外套挂架子", "做一个人影", "假轮廓"], c => isNear(c, "frame", 100) && c.state.sceneId.startsWith("cinema"), { type: "mutate", target: "frame", state: { coat: true }, flags: { coat_silhouette: true } }),

  action("repair_pump", "维修排水泵", ["修泵", "维修排水泵", "让泵工作"], c => isNear(c, "pump", 105), { type: "repair", target: "pump", narratorNode: "rely_on_pump", flags: { pump_running: true }, progress: ["seal", 2] }),
  action("start_pump", "启动排水泵", ["开泵", "启动泵", "排水"], c => isNear(c, "pump", 105) && c.state.flags.pump_repaired, { type: "toggle", target: "pump", value: true, progress: ["seal", 2] }),
  action("reverse_pump", "反转排水泵制造吸力", ["反转泵", "让泵倒转", "用泵吸东西"], c => isNear(c, "pump", 105) && c.state.environment.power, { type: "toggle", target: "pump_reverse", value: true, flags: { pump_reverse: true } }),
  action("monitor_pump_gauge", "持续盯住泵压表", ["看泵压", "监控压力", "盯着泵表"], c => isNear(c, "pump", 120), { type: "monitor", target: "pump", excludes: { axis: "pump", values: ["untouched"] }, progress: ["alone", 1] }),

  action("breaker_off", "切断总电源", ["关电闸", "切断电源", "拉闸断电"], c => isNear(c, "breaker", 105) && c.state.environment.power, { type: "power", value: false, progress: ["breach", 1] }),
  action("breaker_on", "恢复总电源", ["开电闸", "恢复供电", "合闸"], c => isNear(c, "breaker", 105) && !c.state.environment.power, { type: "power", value: true, progress: ["seal", 1] }),
  action("lock_breaker", "用绳结固定电闸位置", ["固定电闸", "绑住电闸", "让闸不能动"], c => has(c, "rope") && isNear(c, "breaker", 105), { type: "tie", target: "breaker", flags: { breaker_locked: true }, progress: ["alone", 1] }),
  action("head_hold_breaker", "用头肩压住回弹电闸", ["用头顶电闸", "头压住开关", "身体顶闸"], c => isNear(c, "breaker", 95) && c.state.player.pose !== "stand", { type: "brace", target: "breaker", flags: { body_holds_breaker: true }, progress: ["boundary", 2] }),

  action("pull_front_door", "拉起卷帘门", ["开前门", "拉卷帘门", "打开门"], c => isNear(c, "frontDoor", 110), { type: "door", target: "frontDoor", mode: "open", narratorNode: "approach_door", progress: ["breach", 2] }),
  action("force_front_door_basin", "用铁盆卡入卷帘门底", ["盆卡门", "铁盆塞门下面", "用盆撬门"], c => has(c, "basin") && isNear(c, "frontDoor", 120), { type: "door", target: "frontDoor", mode: "wedge", progress: ["breach", 2] }),
  action("seal_front_door", "用背景布封住卷帘门缝", ["封门", "堵住前门", "挡住门缝"], c => isNear(c, "frontDoor", 120), { type: "door", target: "frontDoor", mode: "seal", progress: ["seal", 2] }),
  action("ram_thin_wall", "推动配重撞开影院薄墙", ["撞开墙", "砸影院墙", "用配重破墙"], c => isNear(c, "thinWall", 120), { type: "damage", target: "thinWall", amount: 2, progress: ["cinema", 2] }),
  action("listen_through_wall", "贴墙听影院中的动静", ["听墙后", "贴墙听", "影院里有人吗"], c => isNear(c, "thinWall", 100), { type: "inspect", target: "wall_sound", flags: { cinema_sound_known: true } }),

  action("talk_yao_stay", "让苏遥留在原地看着你", ["让苏遥看着我", "苏遥别走", "苏遥留在这里"], c => c.nearNpcIds.includes("yao"), { type: "command_npc", target: "yao", command: "watch_player", progress: ["yao", 2] }),
  action("talk_yao_watch_item", "让苏遥看守附近物品", ["苏遥看着这个", "让苏遥守着", "苏遥监控物品"], c => c.nearNpcIds.includes("yao") && Boolean(c.namedObject || c.nearObjects[0]), { type: "command_npc", target: "yao", command: "watch_item", progress: ["yao", 1] }),
  action("talk_yao_take_photo", "让苏遥拿相机记录你", ["苏遥拿相机", "让苏遥拍我", "苏遥记录"], c => c.nearNpcIds.includes("yao") && (has(c, "camera") || isNear(c, "camera", 100)), { type: "command_npc", target: "yao", command: "film_player", progress: ["yao", 2] }),
  action("talk_yao_close_eyes", "让苏遥闭眼躲开玻璃", ["苏遥闭眼", "别看玻璃", "低头闭眼"], c => c.nearNpcIds.includes("yao"), { type: "command_npc", target: "yao", command: "close_eyes", flags: { yao_eyes_closed: true } }),
  action("talk_luhui_watch", "让陆洄监控另一处", ["陆洄帮我看着", "让陆洄守着", "陆洄监控"], c => c.nearNpcIds.includes("luhui"), { type: "command_npc", target: "luhui", command: "watch_other", progress: ["luhui", 1] }),
  action("talk_luhui_pump", "让陆洄去维修排水泵", ["陆洄去修泵", "让陆洄维修", "陆洄开泵"], c => c.nearNpcIds.includes("luhui"), { type: "command_npc", target: "luhui", command: "repair_pump", progress: ["luhui", 2] }),
  action("talk_luhui_flare", "把信号枪交给陆洄", ["枪给陆洄", "陆洄拿枪", "让陆洄发信号"], c => c.nearNpcIds.includes("luhui") && has(c, "flare"), { type: "give", target: "luhui", item: "flare", flags: { luhui_has_flare: true }, progress: ["luhui", 1] }),
  action("talk_luoyi_trace", "请罗姨看守地面痕迹", ["罗姨看着痕迹", "让罗姨守面粉", "罗姨帮我看"], c => c.nearNpcIds.includes("luoyi"), { type: "command_npc", target: "luoyi", command: "watch_trace", flags: { trace_witnessed: true } }),

  action("projector_load_film", "把苏岚的旧胶片装入放映机", ["装胶片", "放映我的照片", "把胶片放进去"], c => c.state.sceneId.startsWith("cinema") && isNear(c, "projector", 110), { type: "mutate", target: "projector", state: { film: "sulan" }, flags: { sulan_film_loaded: true } }),
  action("projector_arm_spring", "给放映机校准弹簧上弦", ["放映机上弦", "给弹簧上劲", "准备校准珠"], c => c.state.sceneId.startsWith("cinema") && isNear(c, "projector", 110), { type: "mutate", target: "projector", state: { armed: true }, flags: { projector_armed: true } }),
  action("projector_enter_beam", "站进放映光路", ["站到光里", "挡住放映机", "进入光路"], c => c.state.sceneId.startsWith("cinema") && isNear(c, "projector", 250), { type: "position", target: "beam", flags: { player_in_beam: true }, prophecy: ["P_SHADOW", "body"] }),
  action("double_expose", "让同一张胶片连续曝光两个动作", ["双重曝光", "连续拍两个动作", "胶片记录两次"], c => c.state.sceneId.startsWith("cinema") && (has(c, "camera") || isNear(c, "projector", 100)), { type: "record", target: "double_exposure", flags: { double_exposure_ready: true }, progress: ["alone", 2], prophecy: ["P_TWO_RECORDS", "double_exposure"] }),

  action("send_yao_rescue", "把苏遥送向救援处并留在原地", ["让苏遥走", "我留下", "救苏遥"], c => c.state.act === 3 && c.state.npcs.yao.alive, { type: "ending_progress", choice: "sacrifice", amount: 3 }),
  action("lead_everyone_exit", "维持行动链并带人一起离开", ["一起离开", "我要活着出去", "带大家走"], c => c.state.act === 3 && c.state.player.health > 0, { type: "ending_progress", choice: "escape", amount: 3 }),
  action("hold_final_boundary", "闭眼维持最终物理边界", ["闭眼坚持", "用身体撑住", "不把死亡给任何人"], c => c.state.act === 3 && (c.state.flags.body_supporting_frame || c.state.flags.body_holds_breaker || c.state.flags.rope_body_anchor), { type: "ending_progress", choice: "boundary", amount: 3 })
];

export function legalActions(context) {
  return ACTIONS.filter(item => item.available(context));
}

export function contentNodeCount() {
  return ACTIONS.length;
}
