import { OBJECTS } from "../data/content.js?v=20260813f";
import { heldIds } from "./state.js?v=20260813f";

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function buildContext(state, raw = "") {
  const text = raw.trim().toLowerCase();
  const objects = Object.values(state.objects).filter(object => object.visible !== false && !object.held);
  const held = heldIds(state);
  const heldObjects = held.map(id => state.objects[id]).filter(Boolean);
  const nearObjects = objects.filter(object => distance(state.player, object) <= 105).sort((a, b) => distance(state.player, a) - distance(state.player, b));
  const nearNpcs = Object.values(state.npcs).filter(npc => npc.alive && distance(state.player, npc) <= 115);
  const aliases = {
    basin: ["盆", "铁盆"], flour: ["面粉"], strip: ["试纸"], camera: ["相机", "摄像头"], flare: ["信号枪", "枪"], foam: ["软弹", "软弹枪"],
    rope: ["绳", "绳子"], photo: ["照片"], frame: ["架", "背景架", "箱子"], pump: ["泵", "排水泵"], breaker: ["电闸", "闸"], frontDoor: ["前门", "卷帘门"], thinWall: ["墙", "薄墙"], redBucket: ["桶", "红桶"], chalkLine: ["线", "粉笔线"], projector: ["放映机"]
  };
  const namedId = Object.entries(aliases).find(([, words]) => words.some(word => text.includes(word)))?.[0];
  const namedNpc = Object.values(state.npcs).find(npc => text.includes(npc.name));
  return {
    state, text, objects, heldIds: held, heldObjects, nearObjects, nearIds: nearObjects.map(item => item.id), nearNpcs, nearNpcIds: nearNpcs.map(item => item.id),
    namedObject: namedId ? state.objects[namedId] : null, namedNpc,
    object: id => state.objects[id],
    freeHand: Object.values(state.player.hands).some(value => value === null),
    objectName: id => OBJECTS[id]?.name || id
  };
}
