(()=>{
  let pending='';
  let overlay=null;
  let input=null;
  function ensure(){
    if(overlay)return;
    overlay=document.createElement('form');
    overlay.id='narrator-action-overlay';
    overlay.innerHTML='<label for="narrator-action-text">说出你想做的事</label><div><input id="narrator-action-text" autocomplete="off" spellcheck="false"><button type="submit">执行</button><button type="button" data-cancel>取消</button></div>';
    const style=document.createElement('style');
    style.textContent='#narrator-action-overlay{position:fixed;z-index:10020;left:50%;bottom:8.5%;transform:translateX(-50%);width:min(760px,82vw);box-sizing:border-box;padding:14px 16px;border:2px solid #64ded5;border-radius:14px;background:#120b20f2;color:#e7d7e8;font:17px system-ui,sans-serif;box-shadow:0 0 0 9999px #05020a30,0 14px 50px #000b}#narrator-action-overlay[hidden]{display:none}#narrator-action-overlay label{display:block;margin-bottom:8px;color:#d6c5dc}#narrator-action-overlay div{display:flex;gap:8px}#narrator-action-text{min-width:0;flex:1;padding:10px 12px;border:2px solid #cfc3db;border-radius:6px;background:#0d0915;color:#fff;font:18px system-ui,sans-serif;outline:none}#narrator-action-text:focus{border-color:#f0bd56}#narrator-action-overlay button{padding:8px 16px;border:1px solid #9f6b8d;border-radius:6px;background:#3a1835;color:#fff;font:16px system-ui,sans-serif;cursor:pointer}@media(max-width:700px){#narrator-action-overlay{bottom:3%;width:94vw;padding:10px}#narrator-action-overlay div{flex-wrap:wrap}#narrator-action-text{flex-basis:100%}}';
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    input=overlay.querySelector('input');
    overlay.addEventListener('submit',event=>{event.preventDefault();pending=input.value;overlay.hidden=true;});
    overlay.querySelector('[data-cancel]').addEventListener('click',()=>{pending='__CANCEL__';overlay.hidden=true;});
  }
  window.NarratorActionInput={
    open(placeholder=''){ensure();pending='';input.value='';input.placeholder=placeholder;overlay.hidden=false;requestAnimationFrame(()=>input.focus());},
    close(){if(overlay)overlay.hidden=true;},
    take(){const value=pending;pending='';return value;}
  };
})();

(()=>{
  const queue=[];
  const judgmentQueue=[];
  const prophecyQueue=[];
  const allowedVerbs=['拿','放','推','拉','扔','砸','转','装','挂','敲','开','拆'];
  const MODEL_ID='Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
  const CPU_MODEL_ID='onnx-community/Qwen2.5-0.5B-Instruct';
  let engine=null;
  let engineKind='none';
  let loading=null;
  let statusButton=null;
  let statusLine=null;
  let progressBar=null;
  let testButton=null;
  let lastError='';
  const attempts=[];

  function readPath(object,path){
    return String(path||'').split('.').filter(Boolean).reduce((value,key)=>value==null?undefined:value[key],object);
  }

  function compare(value,rule){
    switch(rule.op){
      case 'eq': return value===rule.value;
      case 'ne': return value!==rule.value;
      case 'gt': return Number(value)>Number(rule.value);
      case 'gte': return Number(value)>=Number(rule.value);
      case 'lt': return Number(value)<Number(rule.value);
      case 'lte': return Number(value)<=Number(rule.value);
      case 'exists': return value!==undefined&&value!==null;
      case 'truthy': return !!value;
      case 'contains': return Array.isArray(value)?value.includes(rule.value):String(value??'').includes(String(rule.value));
      case 'one_of': return Array.isArray(rule.value)&&rule.value.includes(value);
      default: return false;
    }
  }

  function evaluateRule(snapshot,rule,evidence=[]){
    if(Array.isArray(rule?.all)){
      const children=rule.all.map(child=>evaluateRule(snapshot,child,evidence));
      return {conforms:children.every(Boolean),evidence};
    }
    if(Array.isArray(rule?.any)){
      const local=[];
      const children=rule.any.map(child=>evaluateRule(snapshot,child,local).conforms);
      if(children.some(Boolean)) evidence.push(...local);
      return {conforms:children.some(Boolean),evidence};
    }
    const value=readPath(snapshot,rule?.path);
    const conforms=compare(value,rule||{});
    evidence.push({path:rule?.path,op:rule?.op,expected:rule?.value,actual:value,conforms});
    return {conforms,evidence};
  }

  function fallback(p){
    const synonyms={拾:'拿',捡:'拿',搬:'拿',丢:'扔',投:'扔',击:'砸',打:'砸',旋:'转',朝:'转',塞:'装',放入:'装',拍:'敲',启:'开'};
    let verb=allowedVerbs.find(v=>p.text.includes(v));
    if(!verb) verb=Object.entries(synonyms).find(([k])=>p.text.includes(k))?.[1];
    const mentioned=p.objects.filter(n=>p.text.includes(n));
    const subject=mentioned[0]||p.nearest,target=mentioned[1]||'';
    if(!verb||!subject)return null;
    return {verb,subject,target,normalized:target?`${verb}${subject}向${target}`:`${verb}${subject}`};
  }

  function setStatus(text,kind='idle',progress=null){
    if(statusButton) statusButton.textContent=text;
    if(statusLine) statusLine.textContent=kind==='ready'?'已通过自检；输入内容只在当前浏览器里处理':kind==='error'?text:'第一次约需下载 0.5–1GB，之后直接读浏览器缓存';
    if(progressBar){progressBar.hidden=progress==null; if(progress!=null)progressBar.value=Math.max(0,Math.min(1,Number(progress)));}
  }

  function logAttempt(kind,ok,detail){attempts.push({time:new Date().toISOString(),kind,ok,detail:String(detail||'')});}

  async function importWithFallback(candidates,label){
    let error;
    for(const url of candidates){
      try{
        const module=await Promise.race([
          import(url),
          new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label}组件连接超时`)),12000))
        ]);
        logAttempt(`${label}组件`,true,url);return module
      }
      catch(caught){error=caught;logAttempt(`${label}组件`,false,`${url}｜${caught?.message||caught}`)}
    }
    throw error||new Error(`${label}组件无法下载`);
  }

  async function runSelfTest(){
    if(!engine)throw new Error('模型还没有加载');
    setStatus('正在做一句话自检…','idle',1);
    const messages=[{role:'system',content:'只回答 JSON。'},{role:'user',content:'输出 {"ok":true}'}];
    if(engineKind==='webllm'){
      const result=await engine.chat.completions.create({messages,temperature:0,max_tokens:20,response_format:{type:'json_object'}});
      if(!String(result.choices?.[0]?.message?.content||'').includes('ok'))throw new Error('GPU 模型已加载，但自检没有返回可读结果');
    }else{
      const result=await engine.generator(messages,{max_new_tokens:20,do_sample:false,return_full_text:false});
      if(!result?.length)throw new Error('CPU 模型已加载，但自检没有返回可读结果');
    }
    logAttempt(`${engineKind}自检`,true,'生成成功');
    setStatus(`本地模型已就绪（${engineKind==='webllm'?'GPU':'CPU'}）`,'ready',null);
    if(testButton)testButton.textContent='重新自检';
    return true;
  }

  async function installModel(){
    if(engine)return engine;
    if(loading)return loading;
    loading=(async()=>{
      lastError='';
      if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);
      const estimate=await navigator.storage?.estimate?.().catch(()=>null);
      if(estimate&&estimate.quota-estimate.usage<650_000_000)throw new Error('浏览器可用缓存空间不足 650MB，请先释放空间');
      setStatus('正在连接本地模型组件…','idle',0.01);
      let adapter=null;
      if(navigator.gpu)adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'}).catch(()=>null);
      if(adapter){
        try{
          const webllm=await importWithFallback(['https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/+esm','https://esm.sh/@mlc-ai/web-llm@0.2.84?bundle','https://esm.run/@mlc-ai/web-llm@0.2.84'],'WebLLM');
          engine=await webllm.CreateMLCEngine(MODEL_ID,{
            initProgressCallback:(report)=>{
              const pct=Math.max(0,Math.min(100,Math.round(Number(report.progress||0)*100)));
              setStatus(`正在下载 GPU 模型 ${pct}%`,'idle',pct/100);
            }
          });
          engineKind='webllm';
          logAttempt('GPU模型',true,MODEL_ID);
        }catch(error){
          logAttempt('GPU模型',false,error?.message||error);
          engine=null;
          setStatus('GPU 路径失败，正在改用 CPU…','idle',0.02);
        }
      }else{
        logAttempt('GPU预检',false,'浏览器没有可用 WebGPU 适配器');
      }
      if(!engine){
        const transformers=await importWithFallback(['https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm','https://esm.sh/@huggingface/transformers@3.7.2?bundle','https://esm.run/@huggingface/transformers@3.7.2'],'Transformers.js');
        transformers.env.useBrowserCache=true;
        transformers.env.allowRemoteModels=true;
        const generator=await transformers.pipeline('text-generation',CPU_MODEL_ID,{
          dtype:'q4',
          device:'wasm',
          progress_callback:(report)=>{
            if(report?.status==='progress'){
              const pct=Math.max(0,Math.min(100,Math.round(Number(report.progress||0))));
              setStatus(`正在下载 CPU 模型 ${pct}%`,'idle',pct/100);
            }
          }
        });
        engine={generator};
        engineKind='transformers';
        logAttempt('CPU模型',true,CPU_MODEL_ID);
      }
      await runSelfTest();
      return engine;
    })().catch(error=>{
      engine=null; loading=null;
      lastError=String(error?.message||'未知错误');
      logAttempt('最终结果',false,lastError);
      setStatus(`下载失败，点这里重试`,'error',null);
      if(statusLine)statusLine.textContent=`原因：${lastError}`;
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

  async function browserJudge(p,hard){
    if(!engine)return null;
    const compact={prophecy:p.prophecy,rule:p.rule,snapshot:p.snapshot,hardEvidence:hard.evidence};
    const prompt=`你是游戏里的严格状态判定器。预言是否完成只看给定时刻的物品状态，不识别动作名或解法名。规则和状态如下：${JSON.stringify(compact)}。只输出JSON：{"conforms":true或false,"reason":"一句人话","matchedPaths":["实际满足的字段"]}。不得补充不存在的状态。`;
    try{
      const messages=[{role:'system',content:'你只根据状态快照判断规则，不推测玩家意图，不创造事实，只输出JSON。'},{role:'user',content:prompt}];
      let text='';
      if(engineKind==='webllm'){
        const response=await engine.chat.completions.create({messages,temperature:0,max_tokens:180,response_format:{type:'json_object'}});
        text=String(response.choices?.[0]?.message?.content||'');
      }else{
        const response=await engine.generator(messages,{max_new_tokens:180,do_sample:false,return_full_text:false});
        const generated=response?.[0]?.generated_text;
        text=Array.isArray(generated)?String(generated.at(-1)?.content||''):String(generated||'');
      }
      const parsed=JSON.parse(text.replace(/^```json|```$/g,'').trim());
      return {conforms:hard.conforms&&parsed.conforms===true,reason:String(parsed.reason||''),matchedPaths:Array.isArray(parsed.matchedPaths)?parsed.matchedPaths:[]};
    }catch{return null}
  }

  async function browserChooseProphecy(p){
    if(!engine)return null;
    const prompt=`你是创伤惊恐触发器。只能从候选预言中选择一条，不能改写或新造。场景：${p.scene}。故事：${p.story}。当前物品状态：${JSON.stringify(p.state)}。候选：${JSON.stringify(p.candidates)}。选择与当前触碰对象、空间威胁和行动障碍联系最紧的一条。只输出JSON：{"index":从0开始的整数,"reason":"一句话"}。`;
    try{
      const messages=[{role:'system',content:'只从候选列表选择，只输出JSON。'},{role:'user',content:prompt}];
      let text='';
      if(engineKind==='webllm'){
        const response=await engine.chat.completions.create({messages,temperature:0,max_tokens:80,response_format:{type:'json_object'}});
        text=String(response.choices?.[0]?.message?.content||'');
      }else{
        const response=await engine.generator(messages,{max_new_tokens:80,do_sample:false,return_full_text:false});
        const generated=response?.[0]?.generated_text;
        text=Array.isArray(generated)?String(generated.at(-1)?.content||''):String(generated||'');
      }
      const parsed=JSON.parse(text.replace(/^```json|```$/g,'').trim());
      const index=Math.max(0,Math.min(p.candidates.length-1,Number(parsed.index)||0));
      return {index,reason:String(parsed.reason||''),source:engineKind};
    }catch{return null}
  }

  function mountInstaller(){
    const panel=document.createElement('div');
    panel.id='local-llm-panel';
    panel.innerHTML='<div class="llm-head"><b>本地旁白</b><button class="llm-close" type="button" aria-label="收起">收起</button></div><button class="llm-download" type="button">下载本地模型（约 0.5–1GB）</button><progress max="1" value="0" hidden></progress><small>第一次约需下载 0.5–1GB，之后直接读浏览器缓存</small><button class="llm-test" type="button">连接检查</button>';
    Object.assign(panel.style,{position:'fixed',right:'12px',top:'12px',zIndex:'9999',display:'grid',gap:'4px',maxWidth:'280px',padding:'8px',border:'1px solid #d26b78',borderRadius:'8px',background:'rgba(20,8,30,.92)',color:'#ffe8c5',fontFamily:'"Microsoft YaHei","Noto Sans SC",sans-serif',boxShadow:'0 8px 24px #0008'});
    statusButton=panel.querySelector('.llm-download'); statusLine=panel.querySelector('small');progressBar=panel.querySelector('progress');testButton=panel.querySelector('.llm-test');
    Object.assign(statusButton.style,{padding:'8px 12px',border:'1px solid #efaf58',borderRadius:'6px',background:'#36142e',color:'#fff1cf',cursor:'pointer'});
    statusButton.addEventListener('click',()=>installModel().catch(()=>{}));
    testButton.addEventListener('click',()=>engine?runSelfTest().catch(error=>setStatus(`自检失败：${error.message}`,'error')):installModel().catch(()=>{}));
    panel.querySelector('.llm-close').addEventListener('click',()=>{panel.style.display='none';const reopen=document.createElement('button');reopen.id='local-llm-reopen';reopen.textContent='本地模型';Object.assign(reopen.style,{position:'fixed',right:'8px',top:'8px',zIndex:9999,padding:'7px',background:'#35112e',color:'#fff0ce',border:'1px solid #d26b78',borderRadius:'7px'});reopen.onclick=()=>{reopen.remove();panel.style.display='grid'};document.body.appendChild(reopen)});
    document.body.appendChild(panel);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountInstaller,{once:true}); else mountInstaller();
  window.NarratorAI={
    installModel,
    async rankAction(p){const interpreted=await browserModel(p)||fallback(p);queue.push({id:p.id,ok:!!interpreted,...interpreted});},
    take(){const value=queue.shift();return value?JSON.stringify(value):'';},
    async judgeEvent(p){
      const hard=evaluateRule(p.snapshot,p.rule,[]);
      const model=await browserJudge(p,hard);
      const result=model||{conforms:hard.conforms,reason:hard.conforms?'这一刻的物品状态第一次满足了预言。':'这一刻的物品状态还没有满足预言。',matchedPaths:hard.evidence.filter(x=>x.conforms).map(x=>x.path)};
      judgmentQueue.push({id:p.id,ok:true,conforms:!!result.conforms,reason:result.reason,matchedPaths:result.matchedPaths,evidence:hard.evidence,source:model?engineKind:'strict-state-fallback'});
    },
    takeJudgment(){const value=judgmentQueue.shift();return value?JSON.stringify(value):'';},
    async chooseProphecy(p){
      const model=await browserChooseProphecy(p);
      const stateKeys=Object.keys(p.state||{}).sort();
      const fallbackIndex=stateKeys.length%Math.max(1,p.candidates?.length||1);
      prophecyQueue.push({id:p.id,ok:true,index:model?.index??fallbackIndex,reason:model?.reason||'按当前物品状态选择联系最紧的既有预言',source:model?.source||'strict-state-fallback'});
    },
    takeProphecy(){const value=prophecyQueue.shift();return value?JSON.stringify(value):'';},
    selfTest:runSelfTest,
    diagnostics(){return {engineKind,ready:!!engine,loading:!!loading,webgpu:!!navigator.gpu,online:navigator.onLine,lastError,attempts:[...attempts]};},
    chooseProphecyTiming(context){const pressure=Number(context?.pressure||0);return [5.4,4.2,3.4][Math.max(0,Math.min(2,pressure))];}
  };
})();
