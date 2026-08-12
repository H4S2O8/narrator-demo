import { ACTIONS } from "../src/data/actions.js";
import { ACT1, ACT2, ACT3, PAST, PROPHECIES, SCENE_VARIANTS, createWorldlines } from "../src/data/content.js";

const report = { worldlines:createWorldlines().length, actions:ACTIONS.length, past:Object.keys(PAST).length, prophecies:Object.keys(PROPHECIES).length, prophecyPaths:Object.values(PROPHECIES).flatMap(p=>p.paths).length, sceneVariants:Object.values(SCENE_VARIANTS).flatMap(v=>Object.values(v)).length, routes:[] };
for(const act1 of Object.keys(ACT1)) for(const act2 of Object.keys(ACT2)) for(const act3 of Object.keys(ACT3)) report.routes.push({key:`${act1}-${act2}-${act3}`,scene:SCENE_VARIANTS[ACT1[act1].scene2][act2].id});
console.log(JSON.stringify(report,null,2));
