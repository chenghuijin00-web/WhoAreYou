import type { PreferenceScore } from '../protocol/types.ts';

/** 仅替换结果页的内部字母标签，保留原始计分、默认赠送和选择次数证据。 */
export function presentInterpretation(text: string, preferences: PreferenceScore[] = []): string {
  return preferences.reduce((display, axis) => {
    const label = axis.letter === axis.left ? axis.left_label : axis.right_label;
    return display.replaceAll(`${axis.left}/${axis.right}：`, `${axis.left_label}/${axis.right_label}：`)
      .replaceAll(`${axis.letter} 侧`, `${label}一侧`);
  }, text);
}

/** 展示中文偏好，不把娱乐赠送的角色说成可靠的心理判断。 */
export function presentAxisNote(axis: PreferenceScore, entertainment: boolean): string {
  const label = axis.letter === axis.left ? axis.left_label : axis.right_label;
  if (axis.resolution === 'fallback') return '本组回答未提供明确方向，未测出倾向，角色含默认赠送的设定。';
  if (axis.resolution === 'tie_break') return `两侧平分，参考本组首个提供方向的回答，采用${label}一侧。`;
  if (axis.close) return entertainment ? `略偏${label}，另一面的你也在。` : '两侧接近，暂无明显偏向；换个情境可能会不同。';
  return `本次更偏向${label}，不代表你只能使用这一侧。`;
}

/** 分享只使用收集表中的取名，不输出内部人格编码。 */
export function presentShareText(name: string, fallback: boolean, unclear: boolean, meme = ''): string {
  if (unclear) return '我这次的偏好还不明显，暂不定型。来你是什么东西看看你的日常偏好！仅供娱乐。';
  return `我这次${fallback ? '领到' : '更接近'}「${name}」。${fallback ? '部分偏好未测出倾向，角色含默认赠送设定。' : ''}这是娱乐皮肤，不是人格定论。来你是什么东西测一测！${meme ? `\n${meme}` : ''}`;
}
