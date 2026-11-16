# Ahui 广告位图片

- 在线使用素材：`src/assets/ads/ahui-poster.webp`，1200×900，严格4:3，272260字节。
- 原始生成稿：`docs/ad-creative/ahui-source.png`。使用内置图片生成能力制作，再按网站要求导出4:3 WebP，不新增运行依赖。
- 必须展示的文字：`Ahui：牛逼 强 酷 有文化 屌`。实际图片逐字检查通过。
- 加载页第一个广告位展示该图片，其余三个保留“虚位等待..”；不添加跳转、收款或支付确认逻辑。
- 图片随答题页按需加载，不预加载到首页。矮屏适当缩小弹幕区域，仍保留五秒后手动查看结果的流程、弹幕循环及减弱动态支持。

## 最终生成提示词

Use case: ads-marketing. Create a finished raster advertisement poster for a playful Chinese youth personality-test website, landscape exact 4:3 aspect ratio, 1200 by 900 pixels. Pure expressive editorial typography / witty Chinese graphic-design, no human or mascot. Warm butter yellow and cream background, ink-black extra bold Chinese display type with burnt-orange accents, tactile screen-print grain, slightly tilted collage-like type blocks and small graphic star accents. Distinctive, confident, humorous, polished, not a corporate template. Exact required text and ONLY this text: "Ahui：牛逼 强 酷 有文化 屌". Make "Ahui：" clearly legible at the top, "牛逼" dominant, and the remaining four terms "强", "酷", "有文化", "屌" as bold well-spaced type blocks below and beside it. Every required term must appear exactly once and be correctly spelled; no watermark, no extra slogans, no QR code, no extra English. Text must remain readable as a small mobile 4:3 tile. Keep all letters comfortably inside a 7% safe margin; full-bleed background and clean corners. Opaque background.

## 验证

- 回归检查四个广告位，仅第一个使用图片，剩余三个仍有占位文案及无障碍标签。
- 浏览器检查320×568、390×844、844×390和1440×900布局，弹幕持续循环与减弱动态、结果按钮可见性保留。
- 图片中的名字和形容词是用户提供的娱乐创作文案，不代表已发生广告付费。
