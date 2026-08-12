import { ACTIONS } from "./data/actions.js";
import { ACT1, ACT2, ACT3, OBJECTS, PAST, PROPHECIES, SCENE_VARIANTS, TUTORIAL, createWorldlines } from "./data/content.js";

const q=s=>document.querySelector(s);
const metrics=[['候选历史',createWorldlines().length],['情境动作',ACTIONS.length],['过去陈述',Object.keys(PAST).length],['未来契约',Object.keys(PROPHECIES).length],['实现链',Object.values(PROPHECIES).flatMap(p=>p.paths).length],['大路径',27]];
q('#metrics').innerHTML=metrics.map(([k,v])=>`<span class="metric"><b>${v}</b>${k}</span>`).join('');
q('#tutorial-list').className='rule-grid';q('#tutorial-list').innerHTML=TUTORIAL.map(([id,text],i)=>`<article class="rule"><b>${i+1}. ${id}</b><p>${text}</p></article>`).join('');
const routes=[];for(const [a,av] of Object.entries(ACT1))for(const [b,bv] of Object.entries(ACT2))for(const [c,cv] of Object.entries(ACT3)){const scene=SCENE_VARIANTS[av.scene2][b];routes.push(`<article class="route"><b>${a}-${b}-${c}</b><div>${av.label} → ${bv.label} → ${cv.label}</div><small>${scene.title}；危险：${scene.hazard}；核心预言：${scene.prophecy}</small></article>`)}q('#route-grid').innerHTML=routes.join('');
q('#past-table').innerHTML=Object.values(PAST).map(p=>`<tr><td>${p.id}</td><td>${p.text}</td><td>${p.axis} ∈ {${p.keep.join(' / ')}}</td><td>${p.tags.join('、')}</td></tr>`).join('');
q('#prophecy-list').innerHTML=Object.values(PROPHECIES).map(p=>`<article class="prophecy"><h3>${p.id}：${p.text}</h3><div><b>倒用信用：</b>${p.credit.join('；')}</div><ul>${p.paths.map(x=>`<li><code>${x.id}</code> ${x.label}（要求：${x.flags.join(' + ')}）</li>`).join('')}</ul></article>`).join('');
const semantic=new Set(['player','floor','beam','rope','photo_front','photo_back','wall_sound','double_exposure','pump_reverse','footprints']);
const targetName=e=>OBJECTS[e.target]?.name||OBJECTS[e.item]?.name||(semantic.has(e.target)?e.target:e.target)||'世界状态';
q('#action-table').innerHTML=ACTIONS.map(a=>`<tr><td>${a.id}</td><td>${a.label.replace(/basin/g,'铁盆').replace(/flour/g,'面粉').replace(/strip/g,'试纸').replace(/camera/g,'相机').replace(/flare/g,'信号枪').replace(/foam/g,'软弹枪').replace(/rope/g,'救援绳').replace(/photo/g,'受潮照片').replace(/redBucket/g,'清洗桶')}</td><td>${a.phrases.join(' / ')}</td><td>${a.effect.type} → ${targetName(a.effect)}</td><td>${[...Object.keys(a.effect.flags||{}),a.effect.progress?`${a.effect.progress[0]}+${a.effect.progress[1]}`:'',a.effect.prophecy?`占据${a.effect.prophecy.join('/')}`:''].filter(Boolean).join('；')||'位置/时间/持有历史'}</td></tr>`).join('');

const graph=`flowchart LR
  subgraph T0["T0前：仍并存的完整历史"]
    GF["信号枪史 3"]
    GK["钥匙史 3"]
    GP["照片见证史 3"]
    GM["泵维修史 3"]
    GD["门闩史 3"]
  end
  subgraph H["回向认证：14项预制裁剪"]
    HE["空膛/卸弹者"]
    HK["钥匙持有者"]
    HP["谁见过照片"]
    HM["谁修过泵"]
    HD["哪扇门可开"]
  end
  GF-->HE
  GK-->HK
  GP-->HP
  GM-->HM
  GD-->HD
  HE--"占用陆洄时间"-->HM
  HK--"改变可达路线"-->HD
  HP--"赋予苏遥知识"-->R2
  HM--"水位/供电"-->R1
  HD--"进水路径"-->R1
  subgraph F["前向证明：8条契约 / 24条实现链"]
    FR["红水越线"]
    FS["苏遥看见颜色"]
    FB["盆沿流水"]
    FG["弹丸射向头部位置"]
    FH["背景架高于头部"]
    FI["放映窗轮廓"]
    FT["两人之间绳绷紧"]
    FW["照片保留矛盾记录"]
  end
  HE--"关闭实弹链"-->FG
  HM--"开启自然水链"-->FR
  HK--"人物路线"-->FS
  HP--"照片知识"-->FW
  R1{"第一幕物理结果"}
  R1-->A["前门破流"]
  R1-->B["暗房保压"]
  R1-->C["穿墙影院"]
  R2{"第二幕连续性"}
  A-->R2
  B-->R2
  C-->R2
  R2-->Y["苏遥见证"]
  R2-->L["陆洄互证"]
  R2-->E["身体痕迹链"]
  FS-->Y
  FT-->L
  FH-->E
  FI-->Y
  FW-->E
  Y-->R3{"第三幕行动结果"}
  L-->R3
  E-->R3
  R3-->S["有限牺牲"]
  R3-->X["活着离开"]
  R3-->Z["以身作界"]
  S--"具体认证/丢失物/代价"-->N["下一遍共同记忆"]
  X--"人物知识/现实关系"-->N
  Z--"讲述权与主动限制"-->N
  N--"硬锚裁剪T0"-->T0`;
q('#mermaid-graph').textContent=graph;
const mermaid=await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');mermaid.default.initialize({startOnLoad:false,theme:'neutral',securityLevel:'strict'});await mermaid.default.run({nodes:[q('#mermaid-graph')]});
