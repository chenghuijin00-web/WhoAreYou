import { FROG_RELATION_LABELS } from './frogRelations.ts';

export interface PosterCharacter { name: string; imageUrl: string; }
export interface ResultPosterData {
  character: PosterCharacter & { meme: string; tags: string[] };
  fakeFriend: PosterCharacter;
  confidant: PosterCharacter;
  fakeFriends?: PosterCharacter[];
  confidants?: PosterCharacter[];
  entryUrl: string;
}

const FONT = '"Microsoft YaHei", "PingFang SC", sans-serif';

/** 按实际字宽换行，保留中文、标点和完整Unicode字符，不截断用户金句。 */
export function wrapPosterText(text: string, maxWidth: number, measure: (value: string) => number): string[] {
  if (maxWidth <= 0 || !Number.isFinite(maxWidth)) throw new Error('海报文字宽度无效');
  const lines: string[] = [];
  let line = '';
  for (const character of Array.from(text)) {
    if (character === '\n') { lines.push(line); line = ''; continue; }
    if (line && measure(line + character) > maxWidth) { lines.push(line); line = character; }
    else line += character;
  }
  if (line) lines.push(line);
  return lines;
}

/** 只读取站内角色图；超时、加载失败或用户关闭预览时清理图片回调和计时器。 */
function loadPosterImage(url: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const cleanup = () => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => { cleanup(); image.src = ''; reject(new DOMException('海报已取消', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); image.src = ''; reject(new Error('角色图片加载超时，请重试')); }, 8000);
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error('角色图片未加载完成，请重试')); };
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    image.src = url;
  });
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  const radius = 32;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function containImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * ratio, h = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (width - w) / 2, y + (height - h) / 2, w, h);
}

function textLines(ctx: CanvasRenderingContext2D, text: string, y: number, fontSize: number, lineHeight: number, maxWidth: number, color: string) {
  ctx.font = `${fontSize}px ${FONT}`;
  ctx.fillStyle = color;
  const lines = wrapPosterText(text, maxWidth, value => ctx.measureText(value).width);
  lines.forEach((line, index) => ctx.fillText(line, 540, y + index * lineHeight));
  return lines.length;
}

function relationshipGroup(ctx: CanvasRenderingContext2D, people: PosterCharacter[], images: HTMLImageElement[], label: string, x: number) {
  const y = 980, width = 450;
  panel(ctx, x, y, width, 340, '#ffffff');
  ctx.font = `24px ${FONT}`;
  ctx.fillStyle = '#78663a';
  wrapPosterText(label, 394, text => ctx.measureText(text).width).forEach((line, index) => ctx.fillText(line, x + width / 2, y + 40 + index * 32));
  people.forEach((person, index) => {
    const center = x + (index + 0.5) * (width / people.length);
    containImage(ctx, images[index], center - 75, y + 108, 150, 150);
    ctx.font = `bold 28px ${FONT}`;
    ctx.fillStyle = '#302f24';
    ctx.fillText(person.name, center, y + 302, 200);
  });
}

/** 在浏览器本地绘制PNG，不截图页面、不上传答案，不依赖外部广告或海报服务。 */
export async function createResultPoster(data: ResultPosterData, signal?: AbortSignal): Promise<Blob> {
  const fakeFriends = (data.fakeFriends?.length ? data.fakeFriends : [data.fakeFriend]).slice(0, 2);
  const confidants = (data.confidants?.length ? data.confidants : [data.confidant]).slice(0, 2);
  const images = await Promise.all([data.character, ...fakeFriends, ...confidants].map(person => loadPosterImage(person.imageUrl, signal)));
  if (signal?.aborted) throw new DOMException('海报已取消', 'AbortError');
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('当前浏览器无法生成图片');
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, 1080, 1600);
  panel(ctx, 48, 110, 984, 780, '#fff3c5');
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#79652f'; ctx.font = `30px ${FONT}`;
  ctx.fillText('纯种奶蛙鉴赏', 540, 65);
  containImage(ctx, images[0], 330, 155, 420, 400);
  ctx.font = `bold 70px ${FONT}`; ctx.fillStyle = '#292b21';
  ctx.fillText(data.character.name, 540, 620, 900);
  textLines(ctx, data.character.tags.join('  ·  '), 676, 27, 40, 850, '#8a7133');
  textLines(ctx, data.character.meme, 750, 32, 50, 850, '#625b42');
  relationshipGroup(ctx, fakeFriends, images.slice(1, 1 + fakeFriends.length), FROG_RELATION_LABELS.fakeFriend, 72);
  relationshipGroup(ctx, confidants, images.slice(1 + fakeFriends.length), FROG_RELATION_LABELS.confidant, 558);
  textLines(ctx, '奶蛙世界整活搭配，与现实朋友关系无关', 1415, 26, 38, 936, '#8b7a50');
  ctx.fillStyle = '#363b26'; ctx.font = `bold 38px ${FONT}`;
  ctx.fillText('你是什么东西 · WhoAreYou', 540, 1480);
  textLines(ctx, data.entryUrl, 1530, 24, 30, 936, '#847044');
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片生成失败，请重试')), 'image/png');
  });
}
