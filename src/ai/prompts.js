export function parserPrompt(context, legal) {
  return `你是游戏动作选择器。只从合法动作中选择一个编号，不创造事实。\n玩家输入：${context.text}\n当前附近：${context.nearObjects.map(o => o.name).join("、") || "无"}\n双手：${context.heldObjects.map(o => o.name).join("、") || "空"}\n姿势：${context.state.player.pose}\n合法动作：\n${legal.map((a, i) => `${i}|${a.id}|${a.label}`).join("\n")}\n只输出所选编号的整数，不输出其他字符。`;
}

export function narratorPrompt(state, node, candidates) {
  const memory = state.meta.strategyMemory || {};
  const options = candidates.map((item, i) => {
    const e = item.effects;
    const risk = typeof e.risk === "number" ? e.risk : (e.risk ? 1 : 0);
    return `${i}: id=${item.id}; cut=${e.cut || 0}; remain=${e.after ?? state.worlds.length}; credit=${e.credit || 0}; risk=${risk}; locks=${e.timeLocks?.length || 0}`;
  }).join("\n");
  return `Choose one strategy for a hostile long-term narrator. The narrator must preserve a mother-sacrifice outcome, constrain the player, avoid giving exploitable certainty, and may wait instead of taking a bad local move.\nNode=${node}\nWorlds=${state.worlds.length}/${state.initialWorldCount}\nActiveFuture=${state.activeProphecy?.id || "none"}\nPlayerPattern=${JSON.stringify(memory)}\nOptions:\n${options}\nReply with only the option number.`;
}
