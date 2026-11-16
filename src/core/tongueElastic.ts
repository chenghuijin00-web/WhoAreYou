export interface TonguePose { stretch: number; shear: number }

/** 舌根锚定：横向用剪切让舌尖偏移，不把整条舌头平移出嘴巴。 */
export function tongueTransform({ stretch, shear }: TonguePose): string {
  const width = 1 - stretch * .26 - Math.min(.12, Math.abs(shear) * .12);
  return `matrix(${width}, 0, ${shear}, ${1 + stretch}, 0, 0)`;
}

export function lipTransform({ stretch, shear }: TonguePose): string {
  return `skewX(${shear * 10}deg) scale(${1 - stretch * .09}, ${1 + stretch * .12})`;
}

/** 回弹与拉动共用二维形变，按原方向反向过冲并衰减，最后归零。 */
export function tongueRebound(pose: TonguePose, tapLimit: number): TonguePose[] {
  if (Math.hypot(pose.stretch, pose.shear) <= .015) {
    return [pose, { stretch: Math.min(.25, tapLimit), shear: 0 },
      { stretch: -.05, shear: 0 }, { stretch: .018, shear: 0 }, { stretch: 0, shear: 0 }];
  }
  return [1, -.32, .16, -.06, 0].map(factor => ({
    stretch: factor === 0 ? 0 : pose.stretch * factor, shear: factor === 0 ? 0 : pose.shear * factor
  }));
}
