import { onBeforeUnmount, ref, type Ref } from 'vue';
import { tongueTransform, lipTransform, tongueRebound, type TonguePose } from '../core/tongueElastic';

/** 舌根固定，只对独立表层做拉伸；回弹结束才通知首页开始答题。 */
export function useTonguePull(surface: Ref<HTMLElement | null>, lip: Ref<HTMLElement | null>,
  enabled: () => boolean, start: () => void) {
  const settling = ref(false);
  const pulling = ref(false);
  const tension = ref(0);
  let pointer: { id: number; x: number; y: number; height: number; limit: number;
    leftLimit: number; rightLimit: number; target: HTMLElement } | undefined;
  let pose: TonguePose = { stretch: 0, shear: 0 };
  let animation: Animation | undefined;
  let lipAnimation: Animation | undefined;
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function limitFor(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    // 留出阴影及待机浮动余量，横屏和小屏也不把舌尖拉出可视区。
    return Math.max(0, Math.min(.38, (window.innerHeight - rect.bottom - 12) / Math.max(1, rect.height)));
  }

  function sideLimits(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    const height = Math.max(1, element.offsetHeight);
    return { height,
      leftLimit: Math.max(0, Math.min(.65, (rect.left - 12) / height)),
      rightLimit: Math.max(0, Math.min(.65, (window.innerWidth - rect.right - 12) / height)) };
  }

  function paint(value: TonguePose) {
    pose = value;
    if (surface.value) surface.value.style.transform = tongueTransform(value);
    if (lip.value) lip.value.style.transform = lipTransform(value);
  }

  function releasePointer() {
    const held = pointer;
    pointer = undefined;
    if (held?.target.hasPointerCapture(held.id)) held.target.releasePointerCapture(held.id);
  }

  function cancel() {
    releasePointer();
    animation?.cancel();
    lipAnimation?.cancel();
    animation = lipAnimation = undefined;
    settling.value = pulling.value = false;
    tension.value = 0;
    paint({ stretch: 0, shear: 0 });
  }

  async function settle(launch: boolean, limit: number) {
    const element = surface.value;
    if (!element || settling.value) return;
    if (reduced() || !element.animate) {
      cancel();
      if (launch && enabled()) start();
      return;
    }
    settling.value = pulling.value = true;
    // 轻点先主动伸舌；真实拖拽则从松手位置直接回弹，不瞬移到预设长度。
    tension.value = 0;
    const dragged = Math.hypot(pose.stretch, pose.shear) > .015;
    const bounds = sideLimits(element.closest('button') || element);
    // 反向过冲也要受另一侧屏幕余量约束，尤其上拉后向下回弹不能裁掉舌尖。
    const values = tongueRebound(pose, limit).map(value => ({
      stretch: Math.max(-.48, Math.min(limit, value.stretch)),
      shear: Math.max(-bounds.leftLimit, Math.min(bounds.rightLimit, value.shear))
    }));
    const frames = values.map(value => ({ transform: tongueTransform(value), easing: 'cubic-bezier(.3,0,.3,1)' }));
    const options = { duration: dragged ? 520 : 620, fill: 'forwards' as FillMode };
    const current = element.animate(frames, options);
    animation = current;
    lipAnimation = lip.value?.animate(values.map(value => ({
      transform: lipTransform(value), easing: 'cubic-bezier(.3,0,.3,1)'
    })), options);
    try {
      await current.finished;
      if (animation !== current) return;
      cancel();
      if (launch && enabled()) start();
    } catch {
      // 页面切换、失焦或指针取消会主动撤销动画，不能因此误跳答题。
    }
  }

  function down(event: PointerEvent) {
    if (!enabled() || settling.value || pointer || !event.isPrimary || event.button !== 0) return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, ...sideLimits(target),
      limit: limitFor(target), target };
    pulling.value = true;
    target.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (pointer?.id !== event.pointerId || reduced()) return;
    const distance = (event.clientY - pointer.y) / Math.max(1, pointer.height);
    // 向下伸长、向上收拢；舌根始终贴着嘴，收拢最多48%，避免穿过嘴部或翻转。
    // 两个方向都保留渐进阻力，越接近边界越难继续拉动。
    const limit = distance < 0 ? .48 : pointer.limit;
    const stretch = limit > 0 ? Math.sign(distance) * limit * (1 - Math.exp(-Math.abs(distance) / limit)) : 0;
    const horizontal = (event.clientX - pointer.x) / pointer.height;
    const sideLimit = horizontal < 0 ? pointer.leftLimit : pointer.rightLimit;
    const shear = sideLimit > 0 ? Math.sign(horizontal) * sideLimit * (1 - Math.exp(-Math.abs(horizontal) / sideLimit)) : 0;
    // 强拉只增加表情与细微颤动，不另建计时跳转；一直按住可以反复换方向。
    tension.value = Math.min(1, Math.hypot(distance / .85, horizontal / 1.1));
    paint({ stretch, shear });
  }

  function up(event: PointerEvent) {
    if (pointer?.id !== event.pointerId) return;
    move(event);
    const limit = pointer.limit;
    releasePointer();
    void settle(true, limit);
  }

  function click(event: MouseEvent) {
    // 指针操作由 pointerup 唯一提交；键盘/辅助技术的 click 仍可启动。
    if (event.detail > 0 || !enabled() || settling.value) return;
    const element = event.currentTarget;
    if (element instanceof HTMLElement) void settle(true, limitFor(element));
  }

  function lostCapture(event: PointerEvent) {
    if (pointer?.id === event.pointerId) cancel();
  }

  onBeforeUnmount(cancel);
  return { settling, pulling, tension, down, move, up, click, cancel, lostCapture };
}
