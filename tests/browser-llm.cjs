const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const url=process.env.FANCHAO_URL||"http://127.0.0.1:4174/";
const executablePath=process.env.FANCHAO_BROWSER||"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

(async()=>{
  const profile=process.env.FANCHAO_PROFILE;
  const context=profile
    ? await chromium.launchPersistentContext(profile,{executablePath,headless:true,viewport:{width:1100,height:780},args:["--disable-gpu","--no-first-run","--disable-crash-reporter"]})
    : await chromium.launch({executablePath,headless:true,args:["--disable-gpu","--no-first-run","--disable-crash-reporter"]}).then(async browser=>{const ctx=await browser.newContext({viewport:{width:1100,height:780}});ctx._browserForClose=browser;return ctx;});
  const page=context.pages()[0]||await context.newPage();
  await page.addInitScript(()=>{class SilentAudioContext{constructor(){this.currentTime=0;this.destination={};}createOscillator(){return{type:"sine",frequency:{value:0},connect(){},start(){},stop(){}}}createGain(){return{gain:{value:0,exponentialRampToValueAtTime(){}},connect(){}}}}Object.defineProperty(window,"AudioContext",{value:SilentAudioContext,configurable:true});});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));page.on("requestfailed",request=>errors.push(`FAILED ${request.url()} ${request.failure()?.errorText}`));page.on("response",response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  await page.goto(`${url}?llm=${Date.now()}`,{waitUntil:"domcontentloaded"});await page.locator("#start-button").click();
  await page.evaluate(()=>window.__FANCHAO__.loadModel());
  try{await page.waitForFunction(()=>["ready","fallback"].includes(window.__FANCHAO__.state.parser.modelMode),null,{timeout:300000});}catch(error){console.error(JSON.stringify({mode:await page.evaluate(()=>window.__FANCHAO__.state.parser.modelMode),errors}));throw error;}
  const mode=await page.evaluate(()=>window.__FANCHAO__.state.parser.modelMode);assert.equal(mode,"ready","browser model did not become ready");
  await page.evaluate(()=>{const s=window.__FANCHAO__.state;s.player.x=420;s.player.y=380;});
  await page.keyboard.press("Enter");await page.locator("#command-input").fill("拿");
  const before=await page.evaluate(()=>({time:window.__FANCHAO__.state.time,actions:window.__FANCHAO__.state.stats.actions}));await page.keyboard.press("Enter");
  await page.waitForSelector("#command-bar",{state:"hidden",timeout:120000});
  const result=await page.evaluate(()=>({time:window.__FANCHAO__.state.time,source:window.__FANCHAO__.state.parser.lastSource,output:window.__FANCHAO__.state.parser.lastModelOutput,timeDrift:window.__FANCHAO__.state.parser.lastTimeDrift,hands:window.__FANCHAO__.state.player.hands}));
  const actions=await page.evaluate(()=>window.__FANCHAO__.state.stats.actions);
  assert.equal(result.source,"llm");assert.match(result.output,/^scores:/);assert.equal(result.timeDrift,0);assert.ok(result.time-before.time<.2,`world resumed too long before UI assertion: ${result.time-before.time}`);assert.equal(actions,before.actions+1);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({mode,source:result.source,output:result.output,timeFrozen:true,actionExecuted:true,held:Object.values(result.hands).filter(Boolean)}));
  await context.close();if(context._browserForClose)await context._browserForClose.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
