/// <reference types="vite/client" />
// 只由懒加载结果页引用，不增加首页图片请求；文件名沿用内部编码以避免改名错配。
const images = import.meta.glob<string>('./optimized/personas/*.webp', {
  eager: true, import: 'default', query: '?url'
});

export function getPersonaImage(code: string): string | undefined {
  return images[`./optimized/personas/${code.toLowerCase()}.webp`];
}
