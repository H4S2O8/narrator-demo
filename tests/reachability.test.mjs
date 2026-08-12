import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS } from "../src/data/actions.js";
import { createState, hydrateScene } from "../src/engine/state.js";
import { buildContext } from "../src/engine/context.js";

const meta={version:1,loop:1,anchors:[],missingItems:[],strategyMemory:{},priorRoutes:[],reality:{}};

function candidateStates() {
  const sceneIds=["studio","roof","darkroom","cinema","roof_yao","roof_luhui","roof_alone","darkroom_yao","darkroom_luhui","darkroom_alone","cinema_yao","cinema_luhui","cinema_alone"];
  const states=[];
  for(const sceneId of sceneIds){
    const base=createState(structuredClone(meta));hydrateScene(base,sceneId);base.started=true;base.act=sceneId.includes("_")?3:sceneId==="studio"?1:2;
    base.environment.water=.5;base.environment.power=true;base.environment.pump=true;
    Object.assign(base.flags,{pump_repaired:true,rope_on_player:true,head_under_frame:true,body_supporting_frame:true,body_holds_breaker:true,rope_body_anchor:true,near_red_rope:true,basin_under_leak:true,basin_water:true,basin_red_water:true,strip_hidden:true,strip_visible:true,strip_photo:true,frame_counterweighted:true,frame_on_shelf:true,yao_witness_chain:true,luhui_mutual_alibi:true,embodied_chain:true});
    base.traces.push({type:"flour_ring",x:200,y:200,disturbed:false});
    for(const object of Object.values(base.objects)){object.state.water=object.id==="basin"?"red":object.state.water;states.push(positioned(base,object.x,object.y));}
    for(const npc of Object.values(base.npcs))states.push(positioned(base,npc.x,npc.y));
    states.push(positioned(base,480,300));
  }
  const expanded=[];
  for(const source of states){
    expanded.push(source);
    for(const id of Object.keys(source.objects)){
      const s=structuredClone(source);s.player.hands.left=id;s.objects[id].held=true;s.objects[id].visible=false;expanded.push(s);
      if(id==="flare")for(const aimingAt of ["yao","luhui","player"]){const aimed=structuredClone(s);aimed.player.aimingAt=aimingAt;expanded.push(aimed);}
      for(const id2 of Object.keys(source.objects).filter(x=>x!==id).slice(0,3)){const d=structuredClone(s);d.player.hands.right=id2;d.objects[id2].held=true;d.objects[id2].visible=false;expanded.push(d);}
    }
    for(const pose of ["stand","crouch","crawl"]){const s=structuredClone(source);s.player.pose=pose;expanded.push(s);}
    for(const aimingAt of ["yao","luhui","player"]){const s=structuredClone(source);s.player.aimingAt=aimingAt;expanded.push(s);}
    {const s=structuredClone(source);s.environment.power=false;expanded.push(s);}
    for(const routes of [{act1:"breach",act2:"yao",act3:null},{act1:"seal",act2:"luhui",act3:null},{act1:"cinema",act2:"alone",act3:null}]){const s=structuredClone(source);s.routes=routes;s.act=routes.act2?3:2;expanded.push(s);}
  }
  return expanded;
}

function positioned(source,x,y){const s=structuredClone(source);s.player.x=x;s.player.y=y;return s;}

test("every authored action has at least one satisfiable state",()=>{
  const states=candidateStates();
  const unreachable=[];
  for(const action of ACTIONS){
    const reachable=states.some(state=>{try{return action.available(buildContext(state,action.phrases[0]))}catch{return false}});
    if(!reachable)unreachable.push(action.id);
  }
  assert.deepEqual(unreachable,[]);
});
