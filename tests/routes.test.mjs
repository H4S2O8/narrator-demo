import test from "node:test";
import assert from "node:assert/strict";
import { ACT1, ACT2, ACT3, SCENE_VARIANTS, createWorldlines } from "../src/data/content.js";
import { createState, hydrateScene, commitPast, commitRoute, finaliseLoop } from "../src/engine/state.js";
import { ACTIONS } from "../src/data/actions.js";
import { buildContext } from "../src/engine/context.js";
import { executeAction } from "../src/engine/actions.js";
import { stepSimulation, ACT_MIN_SECONDS } from "../src/engine/simulation.js";
import { BrowserLLM } from "../src/ai/browser-llm.js";

const meta=()=>({version:1,loop:1,anchors:[],missingItems:[],strategyMemory:{},priorRoutes:[],reality:{}});
const get=id=>ACTIONS.find(action=>action.id===id);
function perform(s,id,at=null){
  if(at){const target=s.objects[at]||s.npcs[at];assert.ok(target,`${id}: missing ${at}`);s.player.x=target.x;s.player.y=target.y;}
  const action=get(id),context=buildContext(s,action.phrases[0]);assert.ok(action.available(context),`${id} unavailable in ${s.sceneId}`);return executeAction(s,action,context);
}
function advance(s,seconds,keys=[]){stepSimulation(s,seconds,new Set(keys),()=>{});}

function reachAct1(s,choice){
  if(choice==="breach"){perform(s,"pull_front_door","frontDoor");advance(s,ACT_MIN_SECONDS.act1+1);}
  if(choice==="seal"){perform(s,"seal_front_door","frontDoor");perform(s,"repair_pump","pump");advance(s,2.6);advance(s,ACT_MIN_SECONDS.act1-1);}
  if(choice==="cinema"){perform(s,"ram_thin_wall","thinWall");perform(s,"ram_thin_wall","thinWall");advance(s,ACT_MIN_SECONDS.act1+1);}
  assert.equal(s.routes.act1,choice);assert.equal(s.act,2);
}

function reachAct2(s,choice){
  if(choice==="yao"){
    perform(s,"talk_yao_stay","yao");perform(s,"take_camera","camera");perform(s,"camera_watch_yao");perform(s,"take_camera","camera");perform(s,"talk_yao_take_photo","yao");
  } else if(choice==="luhui"){
    perform(s,"talk_luhui_watch","luhui");perform(s,"talk_luhui_pump","luhui");perform(s,"take_camera","camera");perform(s,"camera_watch_luhui");
  } else {
    perform(s,"take_camera","camera");perform(s,"camera_watch_flare","flare");perform(s,"take_camera","camera");perform(s,"camera_timer_self");
  }
  advance(s,ACT_MIN_SECONDS.act2+1);assert.equal(s.routes.act2,choice);assert.equal(s.act,3);
}

function reachAct3(s,choice){
  if(choice==="sacrifice")perform(s,"send_yao_rescue");
  else if(choice==="escape")perform(s,"lead_everyone_exit");
  else {perform(s,"head_under_frame","frame");perform(s,"brace_frame_head");assert.equal(s.ending,null);advance(s,ACT_MIN_SECONDS.act3-6);perform(s,"hold_final_boundary");advance(s,6.6,["KeyH"]);}
  if(choice!=="boundary")advance(s,ACT_MIN_SECONDS.act3+1);
  assert.equal(s.routes.act3,choice,`${s.routes.act1}-${s.routes.act2}-${choice}`);assert.equal(s.ending,choice,`${s.routes.act1}-${s.routes.act2}-${choice}`);
}

test("all 27 macro routes create the correct distinct third-act scene and plural history",()=>{
  const results=[];
  for(const a of Object.keys(ACT1))for(const b of Object.keys(ACT2))for(const c of Object.keys(ACT3)){
    const s=createState(meta());hydrateScene(s,"studio");
    assert.ok(commitRoute(s,"act1",a));hydrateScene(s,ACT1[a].scene2);
    assert.ok(commitRoute(s,"act2",b));const variant=SCENE_VARIANTS[ACT1[a].scene2][b];hydrateScene(s,variant.id);
    assert.ok(commitRoute(s,"act3",c));s.ending=c;
    assert.equal(s.sceneId,variant.id);assert.ok(s.worlds.length>=20);
    results.push({key:`${a}-${b}-${c}`,scene:s.sceneId,water:s.environment.water,power:s.environment.power});
  }
  assert.equal(results.length,27);assert.equal(new Set(results.map(r=>r.key)).size,27);assert.equal(new Set(results.map(r=>r.scene)).size,9);
});

test("all 27 macro routes are reachable through authored player actions",()=>{
  for(const a of Object.keys(ACT1))for(const b of Object.keys(ACT2))for(const c of Object.keys(ACT3)){
    const s=createState(meta());hydrateScene(s,"studio");s.started=true;s.paused=false;s.act=1;
    reachAct1(s,a);reachAct2(s,b);reachAct3(s,c);
    assert.equal(`${s.routes.act1}-${s.routes.act2}-${s.routes.act3}`,`${a}-${b}-${c}`);
  }
});

test("specific unload commitment removes Luhui pump-repair histories and creates delayed cost",()=>{
  const s=createState(meta());hydrateScene(s,"studio");
  const beforePump=s.worlds.filter(w=>w.axes.pump==="luhui_repaired").length;
  assert.ok(beforePump>0);
  const r=commitPast(s,"H_LUHUI_UNLOADED");assert.ok(r.ok);
  assert.equal(s.worlds.filter(w=>w.axes.pump==="luhui_repaired").length,0);
  assert.equal(s.flags.luhui_cannot_have_repaired_pump,true);
  assert.ok(s.worlds.length>=20);
});

test("cross-loop concrete anchors reduce but never erase the next world's candidate set",()=>{
  const s=createState(meta());hydrateScene(s,"studio");commitPast(s,"H_LUHUI_UNLOADED");commitPast(s,"H_YAO_KEY");
  s.routes={act1:"breach",act2:"alone",act3:"boundary"};
  const next=finaliseLoop(s);
  const worlds=createWorldlines(next.anchors);
  assert.ok(worlds.length>=20,worlds.length);assert.ok(worlds.length<s.initialWorldCount);
  assert.equal(next.priorRoutes.length,1);assert.equal(next.reality.unpaidCost,true);
});

test("cross-loop actions change missing objects, people, knowledge and scene memory",()=>{
  const s=createState(meta());hydrateScene(s,"studio");s.started=true;s.paused=false;s.act=1;
  perform(s,"take_photo","photo");s.environment.water=.2;perform(s,"float_photo");
  commitPast(s,"H_LUHUI_UNLOADED");s.npcs.luhui.alive=false;s.npcs.yao.trust=2;s.npcs.yao.knowledge=["H_YAO_PHOTO"];
  s.routes={act1:"cinema",act2:"yao",act3:"escape"};
  const next=finaliseLoop(s);const replay=createState(next);hydrateScene(replay,"studio");
  assert.ok(next.missingItems.includes("photo"));assert.equal(replay.objects.photo,undefined);
  assert.equal(replay.npcs.luhui.alive,false);assert.equal(replay.npcs.yao.trust,2);assert.ok(replay.npcs.yao.knowledge.includes("H_YAO_PHOTO"));
  assert.equal(replay.objects.thinWall.state.damage,1);assert.ok(replay.worlds.length>=20);
});

test("third loop removes vague past commitments from narrator choices",async()=>{
  const s=createState({...meta(),loop:3});hydrateScene(s,"studio");
  const llm=new BrowserLLM();llm.generator=null;
  const choice=await llm.chooseNarrator(s,"leave_counter_unseen");
  assert.notEqual(choice,"H_KEY_MOVED");
});

test("a precise authored command never waits for the browser model",async()=>{
  const s=createState(meta());hydrateScene(s,"studio");s.player.x=s.objects.photo.x;s.player.y=s.objects.photo.y;
  const llm=new BrowserLLM();llm.generator={};llm.chooseIndex=async()=>{throw new Error("model should not run")};
  const parsed=await llm.parseAction(buildContext(s,"拿起photo"));
  assert.equal(parsed.action.id,"take_photo");assert.equal(parsed.source,"authored_phrase");
});

test("the narrator does not repeat an already fulfilled future in one telling",async()=>{
  const s=createState(meta());hydrateScene(s,"studio");s.propheciesFulfilled.push({id:"P_RED_LINE",path:"seep",at:12});
  const llm=new BrowserLLM();const choice=await llm.chooseNarrator(s,"tutorial_prophecy");
  assert.equal(choice,"SILENCE");
});

test("nine third-act variants have distinct physical layouts and hazard flags",()=>{
  const signatures=[];
  for(const group of Object.values(SCENE_VARIANTS))for(const variant of Object.values(group)){
    const s=createState(meta());hydrateScene(s,variant.id);
    signatures.push(JSON.stringify({scene:s.sceneId,spawn:s.scene.spawn,objects:Object.fromEntries(Object.entries(s.objects).map(([id,o])=>[id,[o.x,o.y]])),flags:s.scene.initialFlags}));
  }
  assert.equal(signatures.length,9);assert.equal(new Set(signatures).size,9);
});

test("each third-act scene exposes and executes its own authored interaction only",()=>{
  const cases=[
    ["roof_yao","roof_yao_turn_from_glass","yao","yao_reflection_witness"],
    ["roof_luhui","roof_luhui_cross_gap",null,"roof_gap_crossed",{rope_with_luhui:true}],
    ["roof_alone","roof_alone_order_floats",null,"float_order_fixed",{rope_on_player:true}],
    ["darkroom_yao","darkroom_yao_split_view","yao","screen_delay_known"],
    ["darkroom_luhui","darkroom_luhui_swap_controls","luhui","controls_swapped"],
    ["darkroom_alone","darkroom_alone_insulate_head","frame","head_insulated",{},"crawl"],
    ["cinema_yao","cinema_yao_align_shadow","yao","shadow_identity_checked"],
    ["cinema_luhui","cinema_luhui_echo_alibi","luhui","echo_alibi"],
    ["cinema_alone","cinema_alone_register_frames","projector","frame_rate_fixed"]
  ];
  for(const [scene,id,target,flag,extra={},pose="stand"] of cases){
    const s=createState(meta());hydrateScene(s,scene);s.started=true;s.paused=false;s.act=3;s.player.pose=pose;Object.assign(s.flags,extra);
    if(target){const entity=s.objects[target]||s.npcs[target];s.player.x=entity.x;s.player.y=entity.y;}
    const action=get(id),context=buildContext(s,action.phrases[0]);assert.ok(action.available(context),`${id} in ${scene}`);
    assert.ok(executeAction(s,action,context).ok,id);assert.equal(s.flags[flag],true,id);
    const other=createState(meta());const otherScene=scene==="roof_yao"?"cinema_alone":"roof_yao";hydrateScene(other,otherScene);other.act=3;other.player.pose=pose;Object.assign(other.flags,extra);
    if(target){const entity=other.objects[target]||other.npcs[target];if(entity){other.player.x=entity.x;other.player.y=entity.y;}}
    assert.equal(action.available(buildContext(other,action.phrases[0])),false,`${id} leaked into ${otherScene}`);
  }
});
