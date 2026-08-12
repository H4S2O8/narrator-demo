import test from "node:test";
import assert from "node:assert/strict";
import { ACT1, ACT2, ACT3, SCENE_VARIANTS, createWorldlines } from "../src/data/content.js";
import { createState, hydrateScene, commitPast, commitRoute, finaliseLoop } from "../src/engine/state.js";

const meta=()=>({version:1,loop:1,anchors:[],missingItems:[],strategyMemory:{},priorRoutes:[],reality:{}});

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
