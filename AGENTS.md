# 奶蛙项目专属协作规则

本文件只适用于 WhoAreYou 奶蛙项目（当前目录 `D:/PMD`），不适用于其他项目。
遵循用户的通用代码质量、自动审查、验证与凭据保护要求。

## `/push`：推送 GitHub 并部署 Cloudflare

用户在本项目对话中发送 `/push`，即明确授权执行本次项目改动的检查、Git提交、推送及Cloudflare生产部署；不需要再次询问普通提交与发布确认。
此约定不是后台监听任务，不会因编辑文件、普通问答或其他项目中的`/push`自动执行。

### 固定范围

- GitHub：`https://github.com/chenghuijin00-web/WhoAreYou.git`，目标分支`main`。
- 当前目标远端名为`whoareyou`；`origin`指向原开源项目`sigpanic/PMD`，禁止向其推送。
- 在新的克隆目录中按完整URL识别目标远端，不能只凭远端名推断；没有匹配远端、当前不是main或存在未解决冲突时，先说明并请求处理。
- Cloudflare Pages项目：`whoareyou-naifrog`，生产分支`main`。
- 正式入口：`https://whoareyou-naifrog.pages.dev/`；构建目录`dist-cloudflare`。
- 不更新阿里云服务器，不修改DNS、付费资源、GitHub仓库权限或原开源项目历史。

### 执行顺序

1. 检查实际改动、分支、目标远端、远端main及工作区；核实GitHub写入权限与Cloudflare登录状态。不得输出或提交凭据。缺少授权时由用户完成登录，不索要明文Token。
2. 审查待提交文件，排除密钥、环境私密配置、node_modules、构建产物及本机临时文件；不夹带范围不明的改动。保留原MIT声明，不擅自改写历史。
3. 运行下列检查，任何失败都先修复或说明阻塞，不能继续发布：

   ```powershell
   npm.cmd run typecheck
   npm.cmd run test:regression
   npm.cmd run test:team
   npm.cmd run test:share
   npm.cmd run test:usage
   npm.cmd run test:deployment-base
   npm.cmd run build:cloudflare
   npm.cmd run test:loading:cloudflare
   ```

   题库/计分变更额外运行`test:personality`；角色交互变更额外运行`test:hero`；布局变更进行相应多尺寸浏览器检查。检查实际差异并修复发现的问题。
4. 提交本次已审查的项目变更；工作区无改动时不制造空提交。向上述目标仓库main普通推送，禁止强推。若远端有未合入改动或发生冲突，停止说明，不自动覆盖、重置或变基。
5. 核对GitHub远端main与本地提交哈希一致；只有推送成功才部署该版本。构建后代码若再次变化，重新核验并构建，不能发布与已推送版本不一致的产物。
6. 使用Cloudflare部署指引，确认账户后发布：

   ```powershell
   npm.cmd exec --offline -- wrangler whoami
   npm.cmd exec --offline -- wrangler pages deploy dist-cloudflare --project-name whoareyou-naifrog --branch main
   ```

   不使用本项目`npm run deploy`，它是旧GitHub Pages发布流程，不是Cloudflare。CLI未缓存时可以使用正常的`npx wrangler`，不能跳过账户核验。
   若本次发布要启用使用统计，先确认专用 D1 已绑定、迁移已完成、管理员令牌已配置，详见 `docs/usage-analytics.md`。不要把凭据打印到终端或提交到 Git。
7. 核对部署成功记录；读取正式入口及变更资源，比较HTTP状态和本地构建哈希。检查结果不能冒充真机测试。
8. 简短报告提交号、GitHub推送结果、Cloudflare正式链接、实际验证及未验证项。若推送成功但部署失败，明确区分，不自动回滚GitHub或声称两者均完成。

### 网络故障

有限重试；可以在单次命令中使用已经核实可用的系统代理，但不永久更改系统或Git代理。不要因网络失败重新创建仓库、改写历史或重复制造提交。无法恢复时保留本地提交并说明下一步。
