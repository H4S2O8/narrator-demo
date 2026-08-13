const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const url = process.env.FANCHAO_URL || "http://127.0.0.1:4174/";
const chrome = process.env.FANCHAO_BROWSER || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const artifacts = "D:\\narrator-demo-publish\\.test-artifacts";
fs.mkdirSync(artifacts, { recursive: true });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const gameState = page => page.evaluate(() => {
  const s = window.__FANCHAO__.state;
  return {
    time:s.time,paused:s.paused,inputOpen:s.inputOpen,act:s.act,scene:s.sceneId,
    routes:{...s.routes},ending:s.ending,loop:s.meta.loop,
    photo:Boolean(s.objects.photo),photoLost:Boolean(s.objects.photo?.state?.lost),
    wallDamage:s.objects.thinWall?.state?.damage || 0,
    water:s.environment.water,worlds:s.worlds.length,
    hands:{...s.player.hands},position:{x:s.player.x,y:s.player.y}
  };
});

async function command(page, text) {
  await page.keyboard.press("Enter");
  await page.waitForSelector("#command-bar:not(.hidden)");
  const before = await gameState(page);
  assert.equal(before.paused, true, `input did not pause for ${text}`);
  await sleep(650);
  const frozen = await gameState(page);
  assert.ok(Math.abs(frozen.time-before.time)<.03, `world advanced during input for ${text}`);
  await page.locator("#command-input").fill(text);
  const diagnostic=await page.evaluate(async raw=>{const context=window.__FANCHAO__.buildContext(raw);const module=await import(`/src/data/actions.js?audit=${Date.now()}`);return {legal:module.legalActions(context).map(a=>a.id),near:context.nearIds,hands:context.heldIds,position:{x:context.state.player.x,y:context.state.player.y},model:context.state.parser.modelMode};},text);
  console.log("command",text,JSON.stringify(diagnostic));
  await page.keyboard.press("Enter");
  try { await page.waitForSelector("#command-bar", { state:"hidden", timeout:10000 }); }
  catch(error){const dump=await page.evaluate(()=>({state:{paused:window.__FANCHAO__.state.paused,inputOpen:window.__FANCHAO__.state.inputOpen,model:window.__FANCHAO__.state.parser.modelMode},disabled:document.querySelector("#submit-command").disabled,log:[...document.querySelectorAll("#transcript .line")].slice(-5).map(x=>x.textContent)}));throw new Error(`${error.message}\n${JSON.stringify(dump)}`);}
}

async function move(page, code, milliseconds) {
  await page.keyboard.down(code);await sleep(milliseconds);await page.keyboard.up(code);
}

async function moveNear(page, id, range=58) {
  for(let attempts=0;attempts<120;attempts+=1){
    const delta=await page.evaluate(targetId=>{const s=window.__FANCHAO__.state,t=s.objects[targetId]||s.npcs[targetId];return t?{dx:t.x-s.player.x,dy:t.y-s.player.y}:null;},id);
    assert.ok(delta,`missing movement target ${id}`);
    if(Math.hypot(delta.dx,delta.dy)<=range)return;
    const code=Math.abs(delta.dx)>Math.abs(delta.dy)?(delta.dx>0?"KeyD":"KeyA"):(delta.dy>0?"KeyS":"KeyW");
    await move(page,code,120);
  }
  throw new Error(`could not reach ${id}`);
}

(async()=>{
  const browser = await chromium.launch({executablePath:chrome,headless:true,args:["--disable-gpu","--no-first-run","--disable-crash-reporter"]});
  const context = await browser.newContext({viewport:{width:1365,height:900}});
  const page = await context.newPage();
  const errors=[];page.on("pageerror",error=>errors.push(error.message));page.on("console",msg=>{if(msg.type()==="error")errors.push(msg.text());});page.on("response",response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  await page.addInitScript(()=>{
    const real=window.setTimeout;window.setTimeout=(fn,delay,...args)=>real(fn,delay===60000?3600000:delay,...args);
    class SilentAudioContext { constructor(){this.currentTime=0;this.destination={};}createOscillator(){return{type:"sine",frequency:{value:0},connect(){},start(){},stop(){}}}createGain(){return{gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}}} }
    Object.defineProperty(window,"AudioContext",{value:SilentAudioContext,configurable:true});
  });
  await page.goto(`${url}?audit=${Date.now()}`,{waitUntil:"domcontentloaded"});
  await page.addStyleTag({content:"*,*::before,*::after{animation-duration:.001s!important;transition-duration:.001s!important}"});
  await page.evaluate(()=>localStorage.removeItem("fanchao-meta"));await page.reload({waitUntil:"domcontentloaded"});
  await page.locator("#start-button").click();
  assert.equal(await page.evaluate(()=>window.__FANCHAO__.build),"20260813f");

  await sleep(1200);let before=await gameState(page);await page.keyboard.press("KeyP");await sleep(1200);let frozen=await gameState(page);
  assert.equal(frozen.paused,true);assert.ok(Math.abs(frozen.time-before.time)<.08,"manual pause advanced world");await page.keyboard.press("KeyP");

  await moveNear(page,"photo");await command(page,"拿起photo");
  while((await gameState(page)).water<.09)await sleep(1000);
  await command(page,"让照片漂走");
  let s=await gameState(page);assert.equal(s.photoLost,true);console.log("checkpoint: photo physically lost",s.time.toFixed(1));

  await moveNear(page,"thinWall");await command(page,"撞开墙");await command(page,"撞开墙");
  while((s=await gameState(page)).act<2)await sleep(1000);
  assert.equal(s.routes.act1,"cinema");console.log("checkpoint: cinema branch",s.time.toFixed(1));

  await moveNear(page,"camera");await command(page,"拿起camera");await command(page,"记录我自己");await moveNear(page,"camera");await command(page,"拿起camera");await command(page,"记录我自己");
  while((s=await gameState(page)).act<3)await sleep(1000);
  assert.equal(s.routes.act2,"alone");assert.equal(s.scene,"cinema_alone");console.log("checkpoint: embodied-history branch",s.time.toFixed(1));

  await command(page,"一起离开");
  while(!(s=await gameState(page)).ending)await sleep(1000);
  assert.equal(s.ending,"escape");assert.equal(`${s.routes.act1}-${s.routes.act2}-${s.routes.act3}`,"cinema-alone-escape");
  assert.ok(s.time>=540);console.log("checkpoint: ending",s.time.toFixed(1));
  await page.screenshot({path:`${artifacts}\\desktop-ending.png`,fullPage:true});

  await page.locator("#next-loop").click();await page.waitForSelector("#start-button");
  const replay=await gameState(page);
  assert.equal(replay.loop,2);assert.equal(replay.photo,false);assert.ok(replay.wallDamage>=1);assert.ok(replay.worlds>=20);
  console.log("checkpoint: cross-loop consequences",JSON.stringify(replay));

  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${artifacts}\\mobile-replay.png`,fullPage:true});
  const overflow=await page.evaluate(()=>({x:document.documentElement.scrollWidth-document.documentElement.clientWidth,body:document.body.scrollWidth-document.body.clientWidth}));
  assert.ok(overflow.x<=1&&overflow.body<=1,JSON.stringify(overflow));
  assert.deepEqual(errors,[]);
  console.log("browser playthrough passed");
  await browser.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
