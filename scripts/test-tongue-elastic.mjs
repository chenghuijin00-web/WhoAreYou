import assert from 'node:assert/strict';
import { tongueTransform, lipTransform, tongueRebound } from '../src/core/tongueElastic.ts';

for (const pose of [
  { stretch: .38, shear: .65 }, { stretch: -.48, shear: -.65 },
  { stretch: 0, shear: .5 }, { stretch: .3, shear: 0 }
]) {
  const frames = tongueRebound(pose, .38);
  assert.deepEqual(frames[0], pose);
  assert.deepEqual(frames.at(-1), { stretch: 0, shear: 0 });
  assert.equal(frames[1].shear, pose.shear * -.32);
  assert.equal(frames[1].stretch, pose.stretch * -.32);
  assert.match(lipTransform(pose), /^skewX/);
  for (const frame of frames) {
    const values = tongueTransform(frame).slice(7, -1).split(',').map(Number);
    assert.ok(values.every(Number.isFinite));
    assert.ok(values[0] > 0 && values[3] > 0, '不可翻转舌头');
    assert.deepEqual(values.slice(4), [0, 0], '舌根锚点不位移');
  }
}
const tap = tongueRebound({ stretch: 0, shear: 0 }, .08);
assert.equal(tap[1].stretch, .08);
assert.ok(tap.every(pose => pose.shear === 0));
console.log('PASS: 二维回弹、方向反冲、衰减归零、舌根锚定、轻点限幅');
