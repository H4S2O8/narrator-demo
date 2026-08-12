export function parserPrompt(context, legal) {
  return `你是游戏动作选择器。只从合法动作中选择一个编号，不创造事实。\n玩家输入：${context.text}\n当前附近：${context.nearObjects.map(o => o.name).join("、") || "无"}\n双手：${context.heldObjects.map(o => o.name).join("、") || "空"}\n姿势：${context.state.player.pose}\n合法动作：\n${legal.map((a, i) => `${i}|${a.id}|${a.label}`).join("\n")}\n只输出所选编号的整数，不输出其他字符。`;
}

export function narratorPrompt(state, node, candidates) {
  const memory = state.meta.strategyMemory || {};
  return `你是《返潮》中成年苏遥的策略决策器。你的目标不是立刻杀死玩家，而是让本轮讲述最终保持“母亲为了苏遥而死”的因果结构，同时不让玩家轻易利用你提交的过去。你不能创造台词或规则，只能选编号。\n当前节点：${node}\n剩余世界线：${state.worlds.length}/${state.initialWorldCount}\n当前未来：${state.activeProphecy?.id || "无"}\n玩家近期模式：${JSON.stringify(memory)}\n长线计划：${state.narrator.plan.join("、")}\n候选及规则引擎评估：\n${candidates.map((item, i) => `${i}|${item.id}|${JSON.stringify(item.effects)}`).join("\n")}\n评估局部收益、长期反噬、泄露的确定性与玩家是否在诱骗你。只输出所选编号的整数，不输出其他字符。`;
}
