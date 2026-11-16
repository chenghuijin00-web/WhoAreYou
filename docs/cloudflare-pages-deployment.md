# Cloudflare Pages 部署

## 已上线（2026-11-16）

- 正式入口：`https://whoareyou-naifrog.pages.dev/`。
- 本次版本：`https://9096cb2d.whoareyou-naifrog.pages.dev/`，46个文件；团队介绍新增Alexander Grey、特点“牛逼”和用户原始名片图片，CLI确认部署完成。
- 上一版本：`https://1b318b5e.whoareyou-naifrog.pages.dev/`，可在控制台按需回滚。
- 团队页`/team`、团队JS与名片原图在正式域名均HTTP 200且SHA256匹配本次构建。团队渲染回归、类型检查、构建和首屏体积预算通过，图片按团队路由加载，不增加首页图片请求；原服务器未改。
- 本次入口JS在正式域名HTTP 200，SHA256与本地构建一致，已确认包含新官网地址；链接回归、构建与首屏体积检查通过。仅替换官网跳转，不改变测试分享/海报的Cloudflare入口，原服务器未改。
- 手机误高亮原因：组件及两套主题的选项hover样式未区分触摸与鼠标，现统一限制为`(hover: hover) and (pointer: fine)`，保留实际selected和键盘focus-visible。新题无默认答案，返回已答题保留原选择；回归和触屏模拟样式检查通过。
- 上一版手机海报优化发布时正式首页、结果CSS/JS均HTTP 200，SHA256匹配当时构建。本次精简版已由CLI确认部署成功，公开域名文件复核遇到TLS连接重置，不能沿用上一版核对结果。海报生命周期与体积检查通过，真实iPhone相册保存仍待验证，原服务器未改。
- 本次发布前类型检查、16种结果渲染、Cloudflare构建和首屏体积预算通过；此前离线浏览器已验证多尺寸及105条短评的320×568首屏布局。发布后正式首页、主CSS和结果CSS均HTTP 200，SHA256与本次构建一致。原服务器未改动。
- 登录与授权由成员在浏览器完成；未在仓库保存密码或Token。
- 本次未修改域名DNS、未添加数据库/后端或付费绑定，未更新原阿里云服务器，原站点继续独立运行。
- 路径兼容回归、既有业务回归、类型检查、双目标构建、两套首屏体积预算检查通过。
- 首次发布时正式域名下`/`、`/test`、`/result`、`/team`、入口JS、主CSS、背景图及manifest均HTTP 200，SHA256与当时本地Cloudflare构建逐项一致。本次直接复制版本已由CLI确认部署成功，但公开域名文件核对遇到TLS连接重置，不能沿用首次核对作为本次证据。
- 路由检查是HTTP入口及静态资源核对，不代表已完成线上浏览器全流程或手机真机测试。

## 当前分享方式：直接复制（2026-11-16）

本次新增页面调整：仅首页移除“纯种奶蛙鉴赏”标签，结果页品牌不改；答题页使用审核通过的105句短评，每轮预先打乱分配，12题不重复，同题改选或返回保持原句，不读取答案、不参与计分。类型检查、业务回归、分享测试、路径兼容和Cloudflare构建/体积预算均通过。正式首页HTTP 200且SHA256与本次构建一致。未更新阿里云服务器。

- 结果页三个分享入口均直接复制到剪贴板，已移除原生系统分享调用，避免苹果手机系统分享不可用。
- 邀请格式为正式首页网址、换行、`测测你是什么奶族的，我测出来是....`，固定四个英文句点，不展示实际角色名称，也不附加短评、内部MBTI编码或答案。
- 优先使用异步剪贴板，缺少API或权限拒绝时尝试选区兼容复制；临时文本框使用只读、固定定位和16px字号，复制后释放并恢复原焦点及选区。兼容复制失败才打开手动复制窗口，不虚报成功。
- 复制成功显示2.6秒轻提示；防重复复制，离开页面释放提示计时器。海报正式网址保持不变。
- `test:share`、原有业务回归、类型检查、构建及首屏体积检查通过。浏览器模拟覆盖兼容复制成功/失败、提示、手动复制及多尺寸布局；未使用真实iPhone验证系统剪贴板。

## 上一版分享优化记录（已被直接复制替代）

- `src/config/site.json`的`publicEntryUrl`统一控制分享和海报的正式首页。目前固定到上述正式入口，不跟随IP、本地端口或带版本号的预览域名；以后绑定自定义域名时修改此配置并重新构建发布。
- 分享只携带角色名称、当前短评和首页链接，不传递答案或他人的结果。朋友打开后自行测试。
- 手机优先使用系统原生分享；连续点击只打开一次；用户取消时不再弹错误或手动复制窗口。
- 不支持原生分享或调用失败时，打开适配手机的分享窗口，提供复制文案和链接、只复制链接、可全选的手动复制文本，以及海报分享提示。微信直接分享到好友/朋友圈仍由浏览器和微信能力决定，未接入微信SDK。
- 通过`test:share`、原有`test:regression`、类型检查、双目标构建、两套体积预算及路径兼容测试；离线真实Vue浏览器测试覆盖320/390/844/1440宽度、复制失败提示与选区、原生分享和取消分支（API模拟，不代表手机系统分享面板实测）。
- 发布后正式域名首页、入口JS、结果JS/CSS及manifest均HTTP 200，SHA256逐项匹配本次Cloudflare构建。未更新阿里云服务器。

## 双目标构建

- 现有服务器：`npm.cmd run build` → `dist`，默认基址`/PMD/`，Vite原配置保持不变。
- Cloudflare：`npm.cmd run build:cloudflare` → `dist-cloudflare`，基址`/`，不覆盖服务器构建目录。
- 路由读取`import.meta.env.BASE_URL`；主题注册时适配内部图片地址，不修改题库原始字段及计分。
- Pages配置：`wrangler.jsonc`，项目名`whoareyou-naifrog`。后续更新先核对已授权账户与项目，避免误发其他站点。
- 不添加后端、数据库、付费绑定或域名变更。当前没有顶层404.html，采用Pages默认单页应用路由回退。

## 验证与授权

```powershell
node scripts/test-deployment-base.mjs
npm.cmd run test:share
npm.cmd run test:regression
npm.cmd run typecheck
npm.cmd run build:cloudflare
npm.cmd run test:loading:cloudflare
npm.cmd run build
npm.cmd run test:loading
npx.cmd --yes wrangler whoami
```

未授权时由用户在浏览器完成`wrangler login`。不要将密码、Token或OAuth配置复制到项目中。

确认账户与项目后，先构建，再发布：

```powershell
npm.cmd run build:cloudflare
npx.cmd --yes wrangler pages deploy dist-cloudflare --project-name whoareyou-naifrog --branch main --commit-dirty=true
```

Wrangler 4.162.0首次创建时曾自动委托到Workers而失败，未生成部署。按该工具提示，仅创建项目时使用`wrangler pages project create whoareyou-naifrog --production-branch main --force`成功。项目存在后正常执行Pages部署，不给部署命令添加`--force`。
