(()=>{
  const queue=[];
  const allowedVerbs=['拿','放','推','拉','扔','砸','转','装','敲','开'];
  const MODEL_ID='Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
  const CPU_MODEL_ID='onnx-community/Qwen2.5-0.5B-Instruct';
  let engine=null;
  let engineKind='none';
  let loading=null;
  let statusButton=null;
  let statusLine=null;

  function fallback(p){
    const synonyms={拾:'拿',捡:'拿',搬:'拿',丢:'扔',投:'扔',击:'砸',打:'砸',旋:'转',朝:'转',塞:'装',放入:'装',拍:'敲',启:'开'};
    let verb=allowedVerbs.find(v=>p.text.includes(v));
    if(!verb) verb=Object.entries(synonyms).find(([k])=>p.text.includes(k))?.[1];
    const mentioned=p.objects.filter(n=>p.text.includes(n));
    const subject=mentioned[0]||p.nearest,target=mentioned[1]||'';
    if(!verb||!subject)return null;
    return {verb,subject,target,normalized:target?`${verb}${subject}向${target}`:`${verb}${subject}`};
  }

  function setStatus(text,kind='idle'){
    if(statusButton) statusButton.textContent=text;
    if(statusLine) statusLine.textContent=kind==='ready'?'模型仅在本机浏览器运行':kind==='error'?text:'首次下载后会缓存在浏览器中；无 GPU 时自动改用 CPU';
  }

  async function installModel(){
    if(engine)return engine;
    if(loading)return loading;
    loading=(async()=>{
      setStatus('正在连接本地模型组件…');
      if(navigator.gpu){
        try{
          const webllm=await import('https://esm.run/@mlc-ai/web-llm@0.2.84');
          engine=await webllm.CreateMLCEngine(MODEL_ID,{
            initProgressCallback:(report)=>{
              const pct=Math.max(0,Math.min(100,Math.round(Number(report.progress||0)*100)));
              setStatus(`GPU 本地模型 ${pct}%`);
            }
          });
          engineKind='webllm';
        }catch{
          engine=null;
          setStatus('GPU 不可用，切换 CPU 本地模型…');
        }
      }
      if(!engine){
        const transformers=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
        transformers.env.useBrowserCache=true;
        const generator=await transformers.pipeline('text-generation',CPU_MODEL_ID,{
          dtype:'q4',
          device:'wasm',
          progress_callback:(report)=>{
            if(report?.status==='progress'){
              const pct=Math.max(0,Math.min(100,Math.round(Number(report.progress||0))));
              setStatus(`CPU 本地模型 ${pct}%`);
            }
          }
        });
        engine={generator};
        engineKind='transformers';
      }
      setStatus(`本地旁白模型已就绪（${engineKind==='webllm'?'GPU':'CPU'}）`,'ready');
      return engine;
    })().catch(error=>{
      engine=null; loading=null;
      setStatus(`模型不可用：${error?.message||'未知错误'}`,'error');
      throw error;
    });
    return loading;
  }

  async function browserModel(p){
    if(!engine)return null;
    const prompt=`把玩家动作归一化。合法动词：${p.verbs.join('、')}。合法物品：${p.objects.join('、')}。玩家原句：${p.text}。最近物品：${p.nearest}。只输出JSON：{"verb":"","subject":"","target":"","normalized":""}。不得编造物品或改变事实。`;
    try{
      const messages=[{role:'system',content:'你是严格的游戏动作解析器，只输出单个 JSON 对象。'},{role:'user',content:prompt}];
      let text='';
      if(engineKind==='webllm'){
        const response=await engine.chat.completions.create({messages,temperature:0,max_tokens:96,response_format:{type:'json_object'}});
        text=String(response.choices?.[0]?.message?.content||'');
      }else{
        const response=await engine.generator(messages,{max_new_tokens:96,do_sample:false,return_full_text:false});
        const generated=response?.[0]?.generated_text;
        text=Array.isArray(generated)?String(generated.at(-1)?.content||''):String(generated||'');
      }
      text=text.replace(/^```json|```$/g,'').trim();
      const parsed=JSON.parse(text);
      if(!p.verbs.includes(parsed.verb)||!p.objects.includes(parsed.subject)||(parsed.target&&!p.objects.includes(parsed.target)))return null;
      return parsed;
    }catch{return null}
  }

  function mountInstaller(){
    const panel=document.createElement('div');
    panel.id='local-llm-panel';
    panel.innerHTML='<button type="button">下载本地旁白模型（可选）</button><small>首次下载后会缓存在浏览器中；无 GPU 时自动改用 CPU</small>';
    Object.assign(panel.style,{position:'fixed',right:'12px',top:'12px',zIndex:'9999',display:'grid',gap:'4px',maxWidth:'280px',padding:'8px',border:'1px solid #d26b78',borderRadius:'8px',background:'rgba(20,8,30,.92)',color:'#ffe8c5',fontFamily:'"Microsoft YaHei","Noto Sans SC",sans-serif',boxShadow:'0 8px 24px #0008'});
    statusButton=panel.querySelector('button'); statusLine=panel.querySelector('small');
    Object.assign(statusButton.style,{padding:'8px 12px',border:'1px solid #efaf58',borderRadius:'6px',background:'#36142e',color:'#fff1cf',cursor:'pointer'});
    statusButton.addEventListener('click',()=>installModel().catch(()=>{}));
    document.body.appendChild(panel);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountInstaller,{once:true}); else mountInstaller();
  window.NarratorAI={
    installModel,
    async rankAction(p){const interpreted=await browserModel(p)||fallback(p);queue.push({id:p.id,ok:!!interpreted,...interpreted});},
    take(){const value=queue.shift();return value?JSON.stringify(value):'';},
    chooseProphecyTiming(context){const pressure=Number(context?.pressure||0);return [5.4,4.2,3.4][Math.max(0,Math.min(2,pressure))];}
  };
})();
