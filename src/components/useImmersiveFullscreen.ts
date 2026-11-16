import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export function useImmersiveFullscreen(root: Ref<HTMLElement | null>, onLeave: () => void) {
  const immersive = ref(false);
  const fullscreenUnavailable = ref(false);
  let ownedElement: HTMLElement | null = null;
  let entering = false;
  let exiting = false;

  async function releaseFullscreen(element: HTMLElement) {
    if (exiting || document.fullscreenElement !== element) return;
    exiting = true;
    try {
      await document.exitFullscreen();
    } catch {
      // 浏览器可能已在退出；如果仍在全屏，保留纯享状态供用户再次退出。
      if (document.fullscreenElement === element && root.value === element && element.isConnected) {
        immersive.value = true;
      }
    } finally {
      exiting = false;
    }
  }

  async function enterImmersive() {
    const element = root.value;
    if (!element || entering || exiting) return;
    immersive.value = true;
    fullscreenUnavailable.value = false;
    if (window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true) return;
    if (!document.fullscreenEnabled || !element.requestFullscreen || document.fullscreenElement) {
      fullscreenUnavailable.value = true;
      return;
    }

    entering = true;
    try {
      // 必须在点击事件内发起，等待渲染或其他异步操作可能丢失用户授权。
      await element.requestFullscreen({ navigationUI: 'hide' });
      // 请求未完成时用户可能已经关闭纯享模式或离开首页。
      if (!immersive.value || root.value !== element) await releaseFullscreen(element);
    } catch {
      if (immersive.value && root.value === element) fullscreenUnavailable.value = true;
    } finally {
      entering = false;
    }
  }

  function leaveImmersive() {
    if (!immersive.value) return;
    immersive.value = false;
    onLeave();
    const element = root.value;
    if (element) void releaseFullscreen(element);
  }

  function onFullscreenChange() {
    const element = root.value;
    if (element && document.fullscreenElement === element) {
      ownedElement = element;
      if (!immersive.value) void releaseFullscreen(element);
    } else if (ownedElement) {
      ownedElement = null;
      // 浏览器或系统退出全屏时，首页也恢复原来的内容和答题入口。
      leaveImmersive();
    }
  }

  onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange));
  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', onFullscreenChange);
    const element = root.value;
    immersive.value = false;
    if (element) void releaseFullscreen(element);
  });

  return { immersive, fullscreenUnavailable, enterImmersive, leaveImmersive };
}
