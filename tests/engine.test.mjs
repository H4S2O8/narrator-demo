import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS } from "../src/data/actions.js";
import { PAST, PROPHECIES } from "../src/data/content.js";
import { createState, hydrateScene, commitPast, startProphecy, occupyProphecy, fulfillProphecy } from "../src/engine/state.js";
import { buildContext } from "../src/engine/context.js";
import { executeAction } from "../src/engine/actions.js";
import { stepSimulation } from "../src/engine/simulation.js";

const meta = { version:1,loop:1,anchors:[],missingItems:[],strategyMemory:{},priorRoutes:[],reality:{} };
const state = () => { const s=createState(structuredClone(meta)); hydrateScene(s,"studio"); s.started=true;s.paused=false; return s; };
const get = id => ACTIONS.find(action => action.id === id);

test("input pause freezes world time, flood, NPCs and prophecy", () => {
  const s=state(); startProphecy(s,"P_RED_LINE");
  const before={time:s.time,water:s.environment.water,x:s.npcs.yao.x}; s.paused=true;
  stepSimulation(s,5,new Set(["KeyD"]),()=>{});
  assert.deepEqual({time:s.time,water:s.environment.water,x:s.npcs.yao.x},before);
  assert.ok(s.activeProphecy);
});

test("taking removes item from map and dropping restores it at player position", () => {
  const s=state(); s.player.x=s.objects.basin.x;s.player.y=s.objects.basin.y;
  let c=buildContext(s,"拿起铁盆"); executeAction(s,get("take_basin"),c);
  assert.equal(s.objects.basin.held,true);assert.equal(s.objects.basin.visible,false);assert.ok(Object.values(s.player.hands).includes("basin"));
  s.player.x=410;s.player.y=310;c=buildContext(s,"放下铁盆");executeAction(s,get("drop_basin"),c);
  assert.equal(s.objects.basin.held,false);assert.equal(s.objects.basin.visible,true);assert.equal(s.objects.basin.x,410);assert.equal(s.objects.basin.y,310);
});

test("two hands reject a third portable object", () => {
  const s=state();
  for(const id of ["basin","flour","strip"]) { s.player.x=s.objects[id].x;s.player.y=s.objects[id].y; const a=get(`take_${id}`); const c=buildContext(s,`拿${id}`); if(a.available(c)) executeAction(s,a,c); }
  assert.equal(Object.values(s.player.hands).filter(Boolean).length,2);
  assert.equal(s.objects.strip.held,false);
});

test("past commit cuts worlds and cannot resurrect them", () => {
  const s=state();const initial=s.worlds.length;
  let r=commitPast(s,"H_FLARE_EMPTY");assert.ok(r.ok);assert.ok(s.worlds.length<initial);assert.ok(s.worlds.every(w=>w.axes.flare!=="loaded"));
  r=commitPast(s,"H_LUHUI_UNLOADED");assert.ok(r.ok);assert.ok(s.worlds.every(w=>w.axes.flare==="luhui_unloaded"));
  r=commitPast(s,"H_YAO_UNLOADED");assert.equal(r.ok,false);assert.ok(s.worlds.every(w=>w.axes.flare==="luhui_unloaded"));
});

test("occupied prophecy fulfills through the player path", () => {
  const s=state();startProphecy(s,"P_RED_LINE");s.flags.basin_red_water=true;
  assert.ok(occupyProphecy(s,"P_RED_LINE","basin"));
  s.time=s.activeProphecy.dueAt;const r=fulfillProphecy(s);assert.ok(r.ok);assert.equal(r.path.id,"basin");assert.equal(r.occupied,true);
});

test("world simulation continues offscreen processes", () => {
  const s=state();const water=s.environment.water;const x=s.npcs.yao.x;
  stepSimulation(s,2,new Set(),()=>{});
  assert.ok(s.environment.water>water);assert.notEqual(s.npcs.yao.x,x);
});

test("signal shot damages its actual target and empty past prevents damage", () => {
  const s=state();s.player.x=s.objects.flare.x;s.player.y=s.objects.flare.y;executeAction(s,get("take_flare"),buildContext(s,"拿枪"));
  s.player.aimingAt="luhui";const health=s.npcs.luhui.health;executeAction(s,get("fire_flare"),buildContext(s,"开枪"));assert.ok(s.npcs.luhui.health<health);
  const e=state();commitPast(e,"H_FLARE_EMPTY");e.player.x=e.objects.flare.x;e.player.y=e.objects.flare.y;executeAction(e,get("take_flare"),buildContext(e,"拿枪"));e.player.aimingAt="luhui";const eh=e.npcs.luhui.health;executeAction(e,get("fire_flare"),buildContext(e,"开枪"));assert.equal(e.npcs.luhui.health,eh);
});

test("all prophecy definitions can fulfill using at least one authored path", () => {
  for(const p of Object.values(PROPHECIES)) {
    const s=state();startProphecy(s,p.id);for(const flag of p.paths[0].flags)s.flags[flag]=true;s.time=s.activeProphecy.dueAt;const r=fulfillProphecy(s);assert.ok(r.ok,p.id);
  }
});

test("final embodied hold requires continuous real game time and pauses honestly",()=>{
  const s=state();s.act=3;s.routes={act1:"cinema",act2:"alone",act3:null};s.flags.rope_body_anchor=true;s.finalHold={startedAt:s.time,required:6.5,active:true,interrupted:false};s.flags.eyes_closed_final=true;
  stepSimulation(s,3,new Set(["KeyH"]),()=>{});assert.ok(s.flags.final_hold_progress>.4&&s.flags.final_hold_progress<.6);const progress=s.flags.final_hold_progress;
  s.paused=true;stepSimulation(s,4,new Set(["KeyH"]),()=>{});assert.equal(s.flags.final_hold_progress,progress);
  s.paused=false;stepSimulation(s,.1,new Set(),()=>{});assert.equal(s.finalHold.interrupted,true);assert.equal(s.flags.eyes_closed_final,false);
});

test("boundary ending cannot resolve before the full embodied hold",()=>{
  const s=state();s.act=3;s.routes={act1:"cinema",act2:"alone",act3:null};s.flags.rope_body_anchor=true;
  s.branchProgress={...s.branchProgress,boundary:3.9,sacrifice:1,escape:1};
  s.finalHold={startedAt:s.time,required:6.5,active:true,interrupted:false};s.flags.eyes_closed_final=true;
  stepSimulation(s,3,new Set(["KeyH"]),()=>{});
  assert.equal(s.ending,null);assert.equal(s.routes.act3,null);assert.ok(s.flags.final_hold_progress<1);
  stepSimulation(s,3.6,new Set(["KeyH"]),()=>{});
  assert.equal(s.ending,"boundary");assert.equal(s.routes.act3,"boundary");assert.equal(s.flags.final_hold_progress,1);
});
