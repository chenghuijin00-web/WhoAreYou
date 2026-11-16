export interface GazePoint { x: number; y: number }
export interface EyeBounds { left: number; top: number; width: number; height: number }

/** 将点击位置转为眼眶内的有限位移；两个眼睛各用自己的中心，不能共享错误的局部坐标。 */
export function calculateHeroGaze(target: GazePoint, eye: EyeBounds): GazePoint {
  if (![target.x, target.y, eye.left, eye.top, eye.width, eye.height].every(Number.isFinite)
    || eye.width <= 0 || eye.height <= 0) return { x: 0, y: 0 };
  const x = (target.x - eye.left - eye.width / 2) / (eye.width * 3);
  const y = (target.y - eye.top - eye.height / 2) / (eye.height * 3);
  const scale = Math.max(1, Math.hypot(x, y));
  // 椭圆约束而非分别截断X/Y，避免看向角落时瞳孔越出绿色眼眶。
  return { x: x / scale * eye.width * 0.14, y: y / scale * eye.height * 0.12 };
}

/** 拉舌头时更敏捷、更明显地追踪舌尖，最大位移仍留在眼眶内。 */
export function calculateTongueGaze(target: GazePoint, eye: EyeBounds, tension = 0): GazePoint {
  if (![target.x, target.y, eye.left, eye.top, eye.width, eye.height].every(Number.isFinite)
    || eye.width <= 0 || eye.height <= 0) return { x: 0, y: 0 };
  const effort = Number.isFinite(tension) ? Math.max(0, Math.min(1, tension)) : 0;
  const sensitivity = 1.25 - effort * .35;
  const range = .18 + effort * .01;
  const x = (target.x - eye.left - eye.width / 2) / (eye.width * sensitivity);
  const y = (target.y - eye.top - eye.height / 2) / (eye.height * sensitivity);
  const scale = Math.max(1, Math.hypot(x, y));
  return { x: x / scale * eye.width * range, y: y / scale * eye.height * range };
}
