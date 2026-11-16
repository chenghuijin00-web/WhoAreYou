# 奶蛙 v28 部署记录

- 日期：2026-11-12。
- 入口：http://115.29.239.76/PMD/。
- 当前版本：`/var/www/pmd-releases/naifrog-result-loop-20261112-v28`。
- 上一版本（保留）：`/var/www/pmd-releases/naifrog-tongue-play-v27`。
- 发布方式：校验压缩包SHA256后解压到新目录，保留旧版指纹资源，再原子切换`/var/www/becoming-home/PMD`软链接。未改官网首页、Nginx配置、数据库或服务器软件。

## 内容

- 答题页标签改为“奶族身份确认中”。
- 汇聚弹幕CSS无限循环，最多12个节点；系统减少动态模式下展示3条静态内容。
- 仍等待5秒解锁“查看结果”，点击后才离开。
- 同步之前的12题语义计分、角色抠图、紧凑结果页、每组2只关系蛙、海报、64条随机短评及“测测其他人”按钮。

## 核验

- 回归测试、计分测试、类型检查、构建、首屏体积检查通过。
- 离线浏览器检查：4种尺寸，弹幕在6/12/22秒仍播放，减少动态时不重叠。
- 公网主页、答题路由及新答题JS/CSS、结果JS均HTTP 200，文件SHA256与本地构建逐个一致。
- 新首页SHA256：`94af14c6d5120cdcf447cc477365eaf0711deb9c61c6bc88ab7397d82971aa3f`。
- 官网原首页文件SHA256前后均为`7e102cb08002ea1647811f88a079bbc6c320240b1668a3f6c522a88ceafe35cb`。
- Nginx配置检查通过；未重启服务。真实手机分享、微信内置浏览器和线上完整交互未实测。

## 必要时回滚

先确认当前软链接指向本版本，且临时链接名未被占用，再执行：

```sh
test "$(readlink -f /var/www/becoming-home/PMD)" = /var/www/pmd-releases/naifrog-result-loop-20261112-v28 &&
test ! -e /var/www/becoming-home/PMD.rollback-v28 &&
test ! -L /var/www/becoming-home/PMD.rollback-v28 &&
ln -s /var/www/pmd-releases/naifrog-tongue-play-v27 /var/www/becoming-home/PMD.rollback-v28 &&
mv -Tf /var/www/becoming-home/PMD.rollback-v28 /var/www/becoming-home/PMD
```

此回滚命令仅记录，未执行；回滚后需要重新核对公网文件和页面。
