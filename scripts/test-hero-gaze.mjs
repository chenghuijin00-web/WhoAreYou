import assert from 'node:assert/strict';
import { calculateHeroGaze, calculateTongueGaze } from '../src/core/heroGaze.ts';
const eye = { left: 100, top: 200, width: 100, height: 150 };
assert.deepEqual(calculateHeroGaze({ x: 150, y: 275 }, eye), { x: 0, y: 0 });
assert.ok(calculateHeroGaze({ x: 0, y: 275 }, eye).x < 0);
assert.ok(calculateHeroGaze({ x: 600, y: 275 }, eye).x > 0);
assert.ok(calculateHeroGaze({ x: 150, y: 0 }, eye).y < 0);
assert.ok(calculateHeroGaze({ x: 150, y: 900 }, eye).y > 0);
for (const target of [{ x: -1e9, y: -1e9 }, { x: 1e9, y: 1e9 }, { x: -1e9, y: 1e9 }]) {
  const gaze = calculateHeroGaze(target, eye);
  assert.ok(Math.hypot(gaze.x / 14, gaze.y / 18) <= 1.00000001);
}
assert.deepEqual(calculateHeroGaze({ x: NaN, y: 1 }, eye), { x: 0, y: 0 });
assert.deepEqual(calculateHeroGaze({ x: 1, y: 1 }, { ...eye, width: 0 }), { x: 0, y: 0 });
const leftEye = calculateHeroGaze({ x: 400, y: 275 }, eye);
const rightEye = calculateHeroGaze({ x: 400, y: 275 }, { ...eye, left: 600 });
assert.ok(leftEye.x > 0 && rightEye.x < 0);
// 同一页面滚动后眼睛与点击一起平移，局部注视方向不应改变。
assert.deepEqual(calculateHeroGaze({ x: 400, y: -225 }, { ...eye, top: -300 }), leftEye);
console.log('PASS: 双眼各自坐标、四方向、椭圆限位、无效尺寸、视口滚动坐标一致');
const tip = { x: 400, y: 600 };
const tongueLeft = calculateTongueGaze(tip, eye);
const tongueRight = calculateTongueGaze(tip, { ...eye, left: 600 });
assert.ok(tongueLeft.x > 0 && tongueRight.x < 0 && tongueLeft.y > 0 && tongueRight.y > 0);
assert.ok(tongueLeft.y > calculateHeroGaze(tip, eye).y, '舌头注视幅度应大于普通点击');
assert.ok(calculateTongueGaze({ ...tip, y: 450 }, eye).y < tongueLeft.y, '舌尖上移应带动视线');
for (const target of [{ x: -1e9, y: -1e9 }, { x: 1e9, y: 1e9 }, tip]) {
  const gaze = calculateTongueGaze(target, eye);
  assert.ok(Math.hypot(gaze.x / 18, gaze.y / 27) <= 1.00000001);
}
assert.deepEqual(calculateTongueGaze({ x: NaN, y: 1 }, eye), { x: 0, y: 0 });
assert.deepEqual(calculateTongueGaze(tip, { ...eye, height: 0 }), { x: 0, y: 0 });
console.log('PASS: 拉舌注视更明显、双眼向内向下、上移联动、椭圆限位与无效输入');
for (const tension of [0, .75, 1, 10, -10, NaN]) {
  const gaze = calculateTongueGaze(tip, eye, tension);
  assert.ok(Math.hypot(gaze.x / 19, gaze.y / 28.5) <= 1.00000001);
}
assert.ok(calculateTongueGaze(tip, eye, 1).y > tongueLeft.y);
console.log('PASS: 强拉表情更明显，张力异常值与高强度视线限幅');
