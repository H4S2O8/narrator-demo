(()=>{
  const queue=[];
  const allowedVerbs=['拿','放','推','拉','扔','砸','转','装','敲','开'];
  function fallback(p){
    const synonyms={拾:'拿',捡:'拿',搬:'拿',丢:'扔',投:'扔',击:'砸',打:'砸',旋:'转',朝:'转',塞:'装',放入:'装',拍:'敲',启:'开'};
    let verb=allowedVerbs.find(v=>p.text.includes(v));
    if(!verb) verb=Object.entries(synonyms).find(([k])=>p.text.includes(k))?.[1];
    const mentioned=p.objects.filter(n=>p.text.includes(n));
    const subject=mentioned[0]||p.nearest,target=mentioned[1]||'';
    if(!verb||!subject)return null;
    const normalized=target?`${verb}${subject}向${target}`:`${verb}${subject}`;
    return {verb,subject,target,normalized};
  }
  async function browserModel(p){
    const prompt=`你是游戏动作语义解析器。只能从这些动词中选一个：${p.verbs.join('、')}。只能从这些物品中选主体和可选目标：${p.objects.join('、')}。玩家原句：${p.text}。最近物品：${p.nearest}。输出单行JSON，字段verb,subject,target,normalized。不得改变世界事实，不得编造物品。`;
    try{
      let session=null;
      if(globalThis.LanguageModel?.create) session=await globalThis.LanguageModel.create({systemPrompt:'只输出严格JSON。'});
      else if(globalThis.ai?.languageModel?.create) session=await globalThis.ai.languageModel.create({systemPrompt:'只输出严格JSON。'});
      if(!session)return null;
      const out=await session.prompt(prompt); const text=String(out).replace(/^```json|```$/g,'').trim(); const parsed=JSON.parse(text);
      if(!p.verbs.includes(parsed.verb)||!p.objects.includes(parsed.subject)||(parsed.target&&!p.objects.includes(parsed.target)))return null;
      return parsed;
    }catch{return null}
  }
  window.NarratorAI={
    async rankAction(p){const interpreted=await browserModel(p)||fallback(p);queue.push({id:p.id,ok:!!interpreted,...interpreted});},
    take(){const value=queue.shift();return value?JSON.stringify(value):'';},
    chooseProphecyTiming(context){const pressure=Number(context?.pressure||0);return [5.4,4.2,3.4][Math.max(0,Math.min(2,pressure))];}
  };
})();

