(() => {
  const $ = s => document.querySelector(s);
  const logEl = $('#log'), factsEl = $('#facts'), cluesEl = $('#clues');
  const clockEl = $('#clock'), roomEl = $('#room'), phaseEl = $('#phase');
  const HUMAN_ACTIONS = ['观察', '移动', '抓取', '使用工具', '布置/组合', '等待/姿势'];
  const INTERACTIONS = ['抓起', '放下', '使用', '戴上', '吃/喝', '专用检查', '放置', '推/拉', '打开/关闭', '扣动/触发'];
  const ITEM_STATES = ['形态', '实体性', '硬度', '重量', '可携带', '可食用', '毒性', '容纳性', '完整性', '位置/归属'];
  const ITEMS = {
    gun: { name:'枪', x:34, y:61, states:{形态:'固体',实体性:'可碰撞',硬度:'硬',重量:'中',可携带:true,可食用:false,毒性:'无',容纳性:'可容纳弹药',完整性:'完整',位置归属:'书房桌面'} },
    coffee: { name:'咖啡', x:62, y:62, states:{形态:'液体',实体性:'不可阻挡',硬度:'无',重量:'轻',可携带:true,可食用:true,毒性:'未确认',容纳性:'不可容纳',完整性:'未饮用',位置归属:'厨房台面'} },
    flour: { name:'面粉', x:20, y:53, states:{形态:'粉体',实体性:'可留痕',硬度:'软',重量:'轻',可携带:true,可食用:true,毒性:'无',容纳性:'不可容纳',完整性:'袋装',位置归属:'书房桌面'} },
    tray: { name:'金属托盘', x:47, y:53, states:{形态:'固体',实体性:'可碰撞',硬度:'硬',重量:'中',可携带:true,可食用:false,毒性:'无',容纳性:'可承载物品',完整性:'完整',位置归属:'书房桌面'} },
    mirror: { name:'镜子', x:71, y:31, states:{形态:'固体',实体性:'可碰撞/反射',硬度:'脆',重量:'中',可携带:true,可食用:false,毒性:'无',容纳性:'不可容纳',完整性:'完整',位置归属:'书房墙面'} },
    test: { name:'试纸', x:81, y:53, states:{形态:'固体',实体性:'可接触',硬度:'软',重量:'极轻',可携带:true,可食用:false,毒性:'无',容纳性:'吸收液体',完整性:'未使用',位置归属:'柜面'} }
  };
  const initial = () => ({ t:0, alive:true, ended:false, selected:null, inventory:[], pose:'站立', x:28, y:70, facts:[], clues:[], visible:{gun:true,coffee:true,flour:true,tray:true,mirror:true,test:true}, flourRing:false, coffeeChecked:false, coffeePoison:null, coffeeVisited:false, coffeeUnconfirmed:false, gunVisited:false, gunLoaded:true, gunUnconfirmed:false, shotAt:null, shotResolved:false, shotTarget:null, postShotNarrated:false, narratorCount:0 });
  let s = initial();
  const say = (who,text,kind='') => { const p=document.createElement('p'); p.className=`line ${kind}`; p.innerHTML=`<span class="tag">${who}：</span>${text}`; logEl.appendChild(p); logEl.scrollTop=logEl.scrollHeight; };
  const addFact = f => { if(!s.facts.includes(f)){s.facts.push(f);say('记录',f,'system');} };
  const narrate = text => { s.narratorCount++; say('旁白',text,'narrator'); phaseEl.textContent='旁白：已固定一项过去/未来事实'; };
  const dist = (id) => Math.hypot(s.x-ITEMS[id].x, s.y-ITEMS[id].y);
  const nearby = id => dist(id) < 18;
  const inSight = id => s.visible[id] !== false && dist(id) < 14 && !(s.pose === '闭眼');
  const itemName = id => ITEMS[id]?.name || id;
  function updateRoom(){ roomEl.textContent = s.x > 58 ? '安全屋 · 厨房侧' : '安全屋 · 书房侧'; }
  function render(){
    const left=Math.max(0,600-s.t),m=Math.floor(left/60),sec=left%60; clockEl.textContent=`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; updateRoom();
    $('#player').style.left=`${s.x}%`; $('#player').style.top=`${s.y}%`; $('#scene').style.setProperty('--px',`${s.x}%`); $('#scene').style.setProperty('--py',`${s.y}%`); $('#pose').textContent=`姿势：${s.pose}`; $('#selection').textContent=s.selected?`已选：${itemName(s.selected)}`:'先选择一个物品'; const shooterVisible=s.shotResolved&&s.pose!=='闭眼'&&Math.hypot(s.x-88,s.y-42)<18; $('#shooter').classList.toggle('show',shooterVisible); $('#shot-line').classList.toggle('show',shooterVisible);
    factsEl.innerHTML=s.facts.map(x=>`<li>${x}</li>`).join('')||'<li>还没有不可逆的事实。</li>'; cluesEl.innerHTML=s.clues.map(x=>`<li>${x}</li>`).join('')||'<li>暗处的物品没有被确认。</li>';
    document.querySelectorAll('.object').forEach(el=>el.classList.toggle('selected',el.dataset.item===s.selected));
    document.querySelectorAll('[data-interaction]').forEach(btn=>{const ok=s.selected&&allowed(s.selected).includes(btn.dataset.interaction);btn.disabled=!ok||s.ended;});
  }
  function allowed(id){
    if(!id) return [];
    if(s.inventory.includes(id)) return ['放下'];
    if(!inSight(id)||!nearby(id)) return [];
    const base={gun:['抓起','放下','扣动/触发'],coffee:['抓起','放下','吃/喝'],flour:['抓起','放下','放置'],tray:['抓起','放下','放置','推/拉'],mirror:['抓起','放下','放置','推/拉'],test:['抓起','放下','使用']}[id]||[];
    if(id==='coffee'&&s.inventory.includes('test')) base.push('专用检查','使用');
    if(id==='gun'&&s.pose==='趴下') return base.filter(x=>x==='放下');
    return base;
  }
  function drawShotLine(){
    const scene=$('#scene'), line=$('#shot-line');
    const dx=(s.shotTarget.x-88)/100*scene.clientWidth, dy=(s.shotTarget.y-42)/100*scene.clientHeight;
    line.style.left='88%'; line.style.top='42%'; line.style.width=`${Math.hypot(dx,dy)}px`; line.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;
  }
  function tick(n=1){
    if(s.ended)return; for(let i=0;i<n;i++){s.t++;
      if(s.t===8&&s.shotAt===null){s.shotAt=18;narrate('十秒后，一颗子弹将离开枪膛，射向你头部在那一刻所处的位置。');addFact('枪击的时间、目标定义和“子弹离开枪膛”已被固定；结果仍取决于届时现实。');}
      if(s.t===s.shotAt&&!s.shotResolved){s.shotResolved=true;s.shotTarget={x:s.x,y:s.y};drawShotLine();say('现场','门锁转动。钟鸣从走廊举起自己的枪，瞄向你此刻头部所在的坐标。','system');const covered=(s.pose==='趴下'&&s.x<53)||s.x>58;const soft=s.inventory.includes('托盘');if(covered||soft){addFact('子弹按预言离开枪膛，但桌面、墙体或托盘改变了它与头部坐标之间的路径。');say('系统','枪声准时响起，子弹撞上了遮挡物。','system');}else{s.alive=false;addFact('子弹按预言射向你此刻的头部坐标，并在那里命中了你。');say('系统','枪声准时响起。你倒了下去。','system');}}
      if(s.t===22&&!s.postShotNarrated&&s.shotResolved){s.postShotNarrated=true;narrate('两秒前，钟鸣从走廊开枪。那次射击使用的枪膛已经空了。');}
      if(s.t===34&&s.shotResolved){narrate('十二秒后，钟鸣会走近刚才的弹着点。');}
      if(s.t===40&&!s.alive){s.ended=true;say('系统','现场安静下来。','system');}
      if(s.t>=600){s.ended=true;say('系统','十分钟结束。','system');}
    } render();
  }
  function move(dx,dy){if(s.ended||!s.alive)return;s.x=Math.max(6,Math.min(92,s.x+dx));s.y=Math.max(8,Math.min(88,s.y+dy));if(s.coffeeVisited&&dist('coffee')>18)s.coffeeUnconfirmed=true;if(s.gunVisited&&dist('gun')>18)s.gunUnconfirmed=true;if(s.x<45){s.visible={...s.visible,gun:true,flour:true,tray:true,mirror:true};}else{s.visible={...s.visible,coffee:true};}if(s.pose==='趴下')s.clues.push('你在地面移动，视线高度降低。');tick(1);}
  function select(id){if(s.ended||!id)return;if(!ITEMS[id])return;if(!inSight(id)){say('系统',`你看不清${itemName(id)}。`,'system');return;}if(!nearby(id)){say('系统',`你离${itemName(id)}太远，无法操作。`,'system');return;}if(id==='coffee')s.coffeeVisited=true;if(id==='gun')s.gunVisited=true;s.selected=id;say('观察',`你把注意力放在${itemName(id)}上。`,'system');render();}
  function interact(kind){const id=s.selected;if(!s.alive||!id||!allowed(id).includes(kind))return;say('行动',`${kind}${itemName(id)}`);
    if(kind==='抓起'){if(!s.inventory.includes(id))s.inventory.push(id);say('系统',`你抓起${itemName(id)}。`,'system');}
    if(kind==='放下'){s.inventory=s.inventory.filter(x=>x!==id);say('系统',`你放下${itemName(id)}。`,'system');}
    if(kind==='放置'&&id==='flour'){s.flourRing=true;s.inventory=s.inventory.filter(x=>x!==id);addFact('枪周围有一圈面粉；它能证明地面接近是否发生，不能证明所有路径。');}
    if(kind==='放置'&&id==='mirror'){addFact('镜子被放在门边，能反射走廊。');}
    if((kind==='专用检查'||kind==='使用')&&id==='coffee'&&s.inventory.includes('test')){s.coffeeChecked=true;s.coffeePoison=s.coffeePoison??false;s.inventory=s.inventory.filter(x=>x!=='test');ITEMS.test.states.完整性='已使用';addFact(`咖啡已用专用试纸确认：${s.coffeePoison?'有毒':'无毒'}。`);say('系统','试纸接触咖啡并被消耗。','system');}
    if(kind==='吃/喝'&&id==='coffee'){if(!s.coffeeChecked&&s.coffeeUnconfirmed){s.coffeePoison=true;narrate('你离开厨房后，有人在咖啡里下了毒。');addFact('咖啡的毒性已被旁白固定。');}s.coffeeDrunk=true;if(s.coffeePoison){s.alive=false;s.ended=true;say('系统','你喝下咖啡，毒性兑现。','system');}}
    if(kind==='扣动/触发'&&id==='gun'){if(s.gunUnconfirmed&&s.flourRing&&s.gunLoaded){narrate('有人取走了枪里的子弹。');s.gunLoaded=false;addFact('枪已确定为空。');}else if(s.gunLoaded===false){addFact('扳机被扣下，但枪膛为空。');}else{addFact('枪响了；子弹离开枪膛。');}}
    tick(1);render();
  }
  function pose(p){s.pose=p;say('姿势',`你现在${p}。`,'system');if(p==='闭眼')s.visible={gun:false,coffee:false,flour:false,tray:false,mirror:false,test:false};render();}
  document.querySelectorAll('.object').forEach(el=>el.onclick=()=>select(el.dataset.item));document.querySelectorAll('[data-interaction]').forEach(el=>el.onclick=()=>interact(el.dataset.interaction));$('#reset').onclick=()=>{s=initial();logEl.innerHTML='';say('现场','钟鸣曾是你的搭档。你带走了能证明他伪造事故的存储卡；他有安全屋的备用钥匙。','system');say('旁白','三分钟前，钟鸣从楼下取得了安全屋的备用钥匙。','narrator');render();};
  document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='w')move(0,-4);if(e.key.toLowerCase()==='s')move(0,4);if(e.key.toLowerCase()==='a')move(-4,0);if(e.key.toLowerCase()==='d')move(4,0);if(e.key==='Enter')$('#posebar').classList.toggle('open');});
  document.querySelectorAll('[data-pose]').forEach(el=>el.onclick=()=>pose(el.dataset.pose));
  window.__demo={get state(){return s},select,interact,move,pose,reset:()=>$('#reset').click(),HUMAN_ACTIONS,INTERACTIONS,ITEM_STATES,ITEMS};
  $('#reset').click();setInterval(()=>tick(1),1000);
})();
