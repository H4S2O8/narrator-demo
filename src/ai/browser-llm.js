import { legalActions } from "../data/actions.js";
import { NARRATOR_NODES, PAST, PROPHECIES } from "../data/content.js";
import { fallbackParse } from "../engine/actions.js";
import { narratorPrompt, parserPrompt } from "./prompts.js";

const MODEL_ID = "HuggingFaceTB/SmolLM2-135M-Instruct";

export class BrowserLLM {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus;
    this.generator = null;
    this.loading = false;
    this.mode = "rules";
    this.lastNarratorSource = "rules";
    this.lastCompletion = "";
  }

  async load() {
    if (this.loading || this.generator) return;
    this.loading = true;
    this.onStatus("loading", "正在浏览器内加载小型语言模型…");
    try {
      const module = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2");
      module.env.allowLocalModels = false;
      module.env.useBrowserCache = true;
      this.generator = await module.pipeline("text-generation", MODEL_ID, { dtype: "q4" });
      this.mode = "llm";
      this.onStatus("ready", "浏览器语言模型已就绪");
    } catch (error) {
      this.mode = "rules";
      this.onStatus("fallback", `模型暂时不可用，使用确定性策略：${error.message}`);
    } finally {
      this.loading = false;
    }
  }

  async chooseIndex(prompt, optionCount) {
    if (!this.generator) return null;
    const tokenizer = this.generator.tokenizer;
    const model = this.generator.model;
    const inputs = tokenizer(`${prompt}\nAnswer:`);
    const output = await model(inputs);
    const logits = output.logits;
    const vocab = logits.dims.at(-1);
    const sequence = logits.dims.at(-2);
    const offset = (sequence - 1) * vocab;
    const scores = [];
    for (let index = 0; index < optionCount; index += 1) {
      const tokenized = tokenizer(String(index), { add_special_tokens: false });
      const tokenId = Number(tokenized.input_ids.data.at(-1));
      scores.push(Number(logits.data[offset + tokenId]));
    }
    const index = scores.indexOf(Math.max(...scores));
    this.lastCompletion = `scores:${scores.map(score => score.toFixed(2)).join(",")}`;
    return Number.isInteger(index) && index >= 0 ? { index } : null;
  }

  async parseAction(context) {
    const legal = legalActions(context);
    if (!legal.length) return null;
    const exact = legal.filter(action => context.text === action.label || context.text.includes(action.label) || action.phrases.some(phrase => context.text === phrase || context.text.includes(phrase)));
    if (exact.length === 1) return { action: exact[0], confidence: 1, source: "authored_phrase" };
    if (this.generator) {
      const choice = await this.chooseIndex(parserPrompt(context, legal), legal.length);
      if (Number.isInteger(choice?.index) && legal[choice.index]) return { action: legal[choice.index], confidence: choice.confidence || 0.5, source: "llm" };
    }
    return fallbackParse(context);
  }

  async chooseNarrator(state, node) {
    const ids = (NARRATOR_NODES[node] || []).filter(id => id === "SILENCE" || PAST[id] || PROPHECIES[id]);
    const legal = ids.filter(id => {
      if (id === "SILENCE") return true;
      if (PAST[id]) return state.worlds.some(world => PAST[id].keep.includes(world.axes[PAST[id].axis]));
      return !state.activeProphecy;
    });
    if (!legal.length) return "SILENCE";
    const evaluated = legal.map(id => ({ id, effects: this.evaluateNarratorOperation(state, id) }));
    if (this.generator) {
      const choice = await this.chooseIndex(narratorPrompt(state, node, evaluated), legal.length);
      if (Number.isInteger(choice?.index) && legal[choice.index]) {
        this.lastNarratorSource = "llm";
        return legal[choice.index];
      }
    }
    this.lastNarratorSource = "rules";
    return this.ruleNarrator(state, node, legal);
  }

  evaluateNarratorOperation(state, id) {
    if (id === "SILENCE") return { cut:0,immediate:"保留全部历史",longTerm:"等待玩家暴露更多意图",credit:0,risk:state.narrator.pressure };
    if (PAST[id]) {
      const operation=PAST[id];
      const after=state.worlds.filter(world=>operation.keep.includes(world.axes[operation.axis])).length;
      const timeLocks=operation.tags.filter(tag=>tag.includes("past")||tag.includes("knows"));
      return {cut:state.worlds.length-after,after,timeLocks,immediate:operation.tags.includes("flare_empty")?"阻止当前实弹链":"固定一段有用过去",longTerm:timeLocks.length?"会排除同一人物同期行为":"仍保留行动者模糊性",credit:operation.keep.length===1?3:1};
    }
    const p=PROPHECIES[id];
    return {cut:0,immediate:"建立必然未来",longTerm:`保留${p.paths.length}条预制实现链`,credit:p.credit.length,risk:"玩家可以抢占或倒用"};
  }

  ruleNarrator(state, node, legal) {
    const memories = state.meta.strategyMemory || {};
    if (node.startsWith("aim_") && memories.fakeAim > 1 && legal.includes("SILENCE")) return "SILENCE";
    const past = legal.filter(id => PAST[id]);
    if (past.length && (state.npcs.yao.health <= 1 || state.narrator.pressure > 0.55)) {
      return past.sort((a, b) => PAST[a].keep.length - PAST[b].keep.length)[0];
    }
    const prophecy = legal.find(id => PROPHECIES[id]);
    if (prophecy && !state.activeProphecy) return prophecy;
    return legal.includes("SILENCE") ? "SILENCE" : legal[0];
  }
}
