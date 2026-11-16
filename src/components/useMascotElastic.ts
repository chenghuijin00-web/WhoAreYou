import { computed, onBeforeUnmount, ref } from 'vue';

const reboundDuration = 660;

export function useMascotElastic(canMove: () => boolean, isImmersive: () => boolean) {
  const pose = ref({ shear: 0, scale: 1 });
  const pressing = ref(false);
  const rebounding = ref(false);
  let grip: { id: number; x: number; y: number; size: number; element: HTMLElement; started: number } | undefined;
  let pulse: ReturnType<typeof setTimeout> | undefined;
  const tapScale = () => isImmersive() ? .88 : .92;
  // 锚点设在图层底边。矩阵不移动底边上的任何点，脸图、眼睛和嘴使用同一个形变。
  const elasticStyle = computed(() => ({
    transform: `matrix(1, 0, ${pose.value.shear}, ${pose.value.scale}, 0, 0)`,
    '--jelly-shear': pose.value.shear,
    '--jelly-stretch': pose.value.scale - 1,
    '--jelly-duration': `${reboundDuration}ms`,
  }));

  function reset() {
    const previous = grip;
    grip = undefined;
    if (previous?.element.hasPointerCapture(previous.id)) previous.element.releasePointerCapture(previous.id);
    clearTimeout(pulse);
    pressing.value = false;
    rebounding.value = false;
    pose.value = { shear: 0, scale: 1 };
  }

  function rebound() {
    if (!canMove()) { reset(); return; }
    pressing.value = false;
    rebounding.value = true;
    pulse = setTimeout(reset, reboundDuration + 40);
  }

  /** 抓取时记录固定尺寸，避免连续拖动时用变形后的尺寸反复计算。 */
  function grab(event: PointerEvent) {
    if (!canMove() || grip || !event.isPrimary || event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return;
    reset();
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    grip = { id: event.pointerId, x: event.clientX, y: event.clientY, size: Math.max(1, element.offsetHeight), element, started: performance.now() };
    pressing.value = true;
    pose.value = { shear: 0, scale: tapScale() };
  }

  /** 有限弹性阻尼：允许横拉与上下拉伸，防止头部被拖出过远。 */
  function drag(event: PointerEvent) {
    if (!grip || grip.id !== event.pointerId) return;
    const x = (event.clientX - grip.x) / grip.size;
    const y = (event.clientY - grip.y) / grip.size;
    const stretch = Math.tanh(y * (y < 0 ? 5 : 3));
    // 普通首页留有标题和答题入口，控制摆幅；纯享模式保留原来的大幅形变。
    const immersive = isImmersive();
    const verticalLimit = stretch < 0 ? (immersive ? .27 : .12) : (immersive ? .13 : .09);
    pose.value = { shear: -(immersive ? .29 : .17) * Math.tanh(x * 3), scale: tapScale() - verticalLimit * stretch };
  }

  function release(event: PointerEvent) {
    if (grip?.id !== event.pointerId) return;
    const held = grip;
    if (event.type !== 'pointerup') { reset(); return; }
    // 极快的轻点也保留一帧以上的压缩，松手不会与按下合并成同一次绘制。
    grip = undefined;
    if (held.element.hasPointerCapture(held.id)) held.element.releasePointerCapture(held.id);
    const remaining = 65 - (performance.now() - held.started);
    if (remaining > 0) pulse = setTimeout(rebound, remaining);
    else rebound();
  }

  /** 键盘激活和辅助技术触发同样可以让角色轻弹；指针已由按下/松开处理。 */
  function keyboardBounce(event: MouseEvent) {
    if (event.detail !== 0 || !canMove() || grip) return;
    reset();
    pressing.value = true;
    pose.value = { shear: 0, scale: tapScale() };
    pulse = setTimeout(rebound, 80);
  }

  onBeforeUnmount(reset);
  return { elasticStyle, pressing, rebounding, grab, drag, release, keyboardBounce, reset };
}
