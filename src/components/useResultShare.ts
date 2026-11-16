import { onBeforeUnmount, ref } from 'vue';
import { copyTextToClipboard, type ResultSharePayload } from '../core/resultShare.ts';

/** 点击直接复制邀请，不调用手机系统分享；复制失败才展示可手动复制的入口。 */
export function useResultShare() {
  const shareDialog = ref<HTMLDialogElement | null>(null);
  const sharing = ref(false);
  const copying = ref(false);
  const shareStatus = ref('');
  const shareCopyText = ref('');
  const shareUrl = ref('');
  const shareNotice = ref('');
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  function closeShare() { shareDialog.value?.close(); }

  async function share(payload: ResultSharePayload) {
    if (sharing.value || copying.value || disposed) return;
    sharing.value = true;
    shareStatus.value = '';
    shareNotice.value = '';
    clearTimeout(noticeTimer);
    shareCopyText.value = payload.text;
    shareUrl.value = payload.url;
    try {
      await copyShare();
    } finally {
      sharing.value = false;
    }
  }

  async function copyShare(linkOnly = false) {
    if (copying.value || disposed) return;
    copying.value = true;
    try {
      const copied = await copyTextToClipboard(linkOnly ? shareUrl.value : shareCopyText.value);
      if (disposed) return;
      if (copied) {
        shareStatus.value = linkOnly ? '测试链接已复制，快发给朋友吧' : '邀请文案已复制，去粘贴给朋友吧';
        shareNotice.value = shareStatus.value;
        clearTimeout(noticeTimer);
        noticeTimer = setTimeout(() => { shareNotice.value = ''; }, 2600);
      } else {
        shareStatus.value = '未能自动复制，请长按下方文字全选复制';
        if (!shareDialog.value?.open) shareDialog.value?.showModal();
      }
    } finally {
      copying.value = false;
    }
  }

  onBeforeUnmount(() => { disposed = true; clearTimeout(noticeTimer); closeShare(); });
  return { shareDialog, sharing, copying, shareStatus, shareNotice, shareCopyText, share, copyShare, closeShare };
}
