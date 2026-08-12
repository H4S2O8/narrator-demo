import test from "node:test";
import assert from "node:assert/strict";
import { ACTIONS } from "../src/data/actions.js";
import { ACT1, ACT2, ACT3, NARRATOR_NODES, OBJECTS, PAST, PROPHECIES, SCENE_VARIANTS, createWorldlines } from "../src/data/content.js";
import { validateEffectReferences } from "../src/engine/actions.js";

test("content has production-scale node count without duplicate IDs", () => {
  const ids = ACTIONS.map(action => action.id);
  assert.ok(ids.length >= 100, `only ${ids.length} actions`);
  assert.equal(new Set(ids).size, ids.length);
  const total = ACTIONS.length + Object.keys(PAST).length + Object.keys(PROPHECIES).length + Object.values(PROPHECIES).flatMap(p => p.paths).length + 9;
  assert.ok(total >= 150, `only ${total} meaningful nodes`);
});

test("worldlines are complete combinations and remain plural after every past operation", () => {
  const worlds = createWorldlines();
  assert.ok(worlds.length >= 20);
  for (const operation of Object.values(PAST)) {
    const kept = worlds.filter(world => operation.keep.includes(world.axes[operation.axis]));
    assert.ok(kept.length >= 20, `${operation.id} keeps ${kept.length}`);
    assert.ok(kept.length < worlds.length, `${operation.id} does not cut any world`);
  }
});

test("all prophecy paths reference nonempty flags and every prophecy has credit", () => {
  for (const prophecy of Object.values(PROPHECIES)) {
    assert.ok(prophecy.paths.length >= 3, prophecy.id);
    assert.ok(prophecy.credit.length >= 2, prophecy.id);
    for (const path of prophecy.paths) assert.ok(path.flags.length > 0, `${prophecy.id}/${path.id}`);
  }
});

test("all 27 macro routes are represented", () => {
  const routes = [];
  for (const a of Object.keys(ACT1)) for (const b of Object.keys(ACT2)) for (const c of Object.keys(ACT3)) routes.push(`${a}-${b}-${c}`);
  assert.equal(routes.length, 27);
  assert.equal(new Set(routes).size, 27);
  for (const scene of Object.values(ACT1).map(a => a.scene2)) {
    assert.deepEqual(Object.keys(SCENE_VARIANTS[scene]).sort(), Object.keys(ACT2).sort());
  }
});

test("narrator never references freeform operations", () => {
  for (const [node, ids] of Object.entries(NARRATOR_NODES)) {
    assert.ok(ids.length > 0, node);
    for (const id of ids) assert.ok(id === "SILENCE" || PAST[id] || PROPHECIES[id], `${node}: ${id}`);
  }
});

test("action effect references are valid", () => {
  assert.deepEqual(validateEffectReferences(), []);
  for (const action of ACTIONS) {
    for (const target of [action.effect.target, action.effect.item]) {
      if (!target || ["player","floor","beam","rope","photo_front","photo_back","wall_sound","double_exposure","pump_reverse","footprints"].includes(target)) continue;
      if (["yao","luhui","luoyi","chalkLine","thinWall","frontDoor","breaker","frame","pump","projector"].includes(target)) continue;
      assert.ok(OBJECTS[target], `${action.id} unknown target ${target}`);
    }
  }
});
