<template>
  <main class="team-page" aria-labelledby="team-title">
    <div class="team-container">
      <nav class="team-nav" aria-label="团队页导航">
        <RouterLink class="team-back" to="/">← 返回首页</RouterLink>
      </nav>
      <header class="team-heading">
        <h1 id="team-title">团队介绍</h1>
      </header>
      <div class="team-content">
      <article class="team-member" aria-labelledby="member-name">
        <img class="member-image" :src="memberImage" alt="Alexander Grey 提供的抖音名片" width="542" height="570" decoding="async" />
        <div class="member-info">
          <p class="member-label">姓名</p>
          <h2 id="member-name">Alexander Grey</h2>
          <p class="member-trait"><span>特点</span><strong>牛逼</strong></p>
        </div>
      </article>
      <section class="team-contact" aria-labelledby="cooperation-title">
        <div class="contact-heading">
          <h2 id="cooperation-title">合作联系</h2>
          <p>添加好友请备注来意</p>
        </div>
        <img class="contact-image" :src="contactImage" alt="合作联系微信二维码，添加好友请备注来意" width="888" height="1131" decoding="async" />
      </section>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';
import memberImage from '../assets/team/alexander-grey.png';
import contactImage from '../assets/team/cooperation-wechat.png';
</script>

<style scoped>
.team-page { min-height: 100vh; min-height: 100svh; box-sizing: border-box; padding: 24px 20px max(32px, env(safe-area-inset-bottom)); background: #f7f3e8; color: #343126; font-family: 'Microsoft YaHei', 'PingFang SC', system-ui, sans-serif; }
.team-container { max-width: 860px; margin: 0 auto; }
.team-nav { display: flex; }
.team-back { display: inline-flex; align-items: center; min-height: 44px; padding: 0 14px; border: 1px solid #e5d9b7; border-radius: 999px; color: #766139; background: #fffcf4; font-size: 14px; text-decoration: none; }
.team-back:focus-visible { outline: 2px solid #9e8036; outline-offset: 3px; }
.team-heading { margin: 22px 0 24px; text-align: center; }
.team-heading h1 { margin: 0; font-size: clamp(24px, 5vw, 32px); letter-spacing: .06em; }
.team-content { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; align-items: start; }
.team-member, .team-contact { box-sizing: border-box; width: 100%; max-width: 400px; margin: 0 auto; padding: 12px; border: 1px solid #e6d6a5; border-radius: 26px; background: #fffaf0; box-shadow: 0 12px 32px #65582e0d; }
.contact-heading { padding: 12px 8px 18px; text-align: center; }
.contact-heading h2 { margin: 0 0 8px; font-size: 23px; line-height: 1.4; }
.contact-heading p { margin: 0; font-size: 14px; color: #826d38; line-height: 1.6; }
.contact-image { display: block; width: 100%; height: auto; border-radius: 17px; -webkit-touch-callout: default; user-select: auto; -webkit-user-select: auto; }
/* 保留整张名片与二维码，不裁切、不叠加文字，方便手机查看原图。 */
.member-image { display: block; width: 100%; height: auto; border-radius: 17px; -webkit-touch-callout: default; user-select: auto; -webkit-user-select: auto; }
.member-info { padding: 22px 12px 16px; text-align: center; }
.member-label { margin: 0 0 6px; color: #8a7542; font-size: 12px; letter-spacing: .16em; }
.member-info h2 { margin: 0; font-size: clamp(22px, 5.5vw, 28px); line-height: 1.4; overflow-wrap: anywhere; }
.member-trait { display: inline-flex; align-items: center; gap: 12px; margin: 16px 0 0; padding: 7px 17px; border-radius: 999px; background: #f9edbc; }
.member-trait span { font-size: 12px; color: #826d38; }
.member-trait strong { font-size: 15px; font-weight: 600; color: #554521; }
@media (max-width: 480px) { .team-page { padding-top: 16px; } .team-heading { margin: 18px 0 20px; } }
@media (max-width: 640px) { .team-content { grid-template-columns: 1fr; gap: 24px; } }
</style>
