import site from '../config/site.json' with { type: 'json' };

/** 分享与海报共用正式首页，不携带当前结果、临时域名或答题数据。 */
export function getShareEntryUrl(configured = site.publicEntryUrl): string {
  const url = new URL(configured);
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('分享入口必须使用无账号信息的 HTTPS 地址');
  }
  url.search = '';
  url.hash = '';
  return url.href;
}

export interface ResultSharePayload {
  title: string;
  text: string;
  url: string;
}

/** 邀请保留悬念，不带出角色名称、内部编码、短评或答题数据。 */
export function createInviteText(url = getShareEntryUrl()): string {
  return `${url}\n测测你是什么奶族的，我测出来是....`;
}

/** 旧版iOS或内置浏览器兜底：必须在可选中的真实文本框上复制，随后恢复焦点与选区。 */
function legacyCopy(text: string): boolean {
  const active = document.activeElement as HTMLElement | null;
  const selection = window.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;user-select:text;-webkit-user-select:text;';
  // 弹窗打开时必须放在弹窗内，避免模态焦点限制导致复制选区失败。
  (document.querySelector('dialog[open]') ?? document.body).appendChild(textarea);
  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    active?.focus({ preventScroll: true });
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
  }
}

/** 优先在原始点击手势内调用剪贴板；权限拒绝或缺少API时尝试兼容复制，不伪报成功。 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Safari/内置浏览器可能禁用异步剪贴板，继续尝试选区复制。
    }
  }
  return legacyCopy(text);
}
