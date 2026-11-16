import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './nursery.css'
import './yellow.css'
import './homeFullscreen.css'
import App from './App.vue'
import router from './router'
import { themeManager } from './xbti/themeManager'

// 当前仅发布奶蛙四维题库；旧主题配置保留但不注册。
const themeModules = import.meta.glob(['./instance/naifrogTest.ts'], { eager: true })

for (const path in themeModules) {
  const module = themeModules[path]
  for (const key in module) {
    const testConfig = module[key]
    if (testConfig && testConfig.id && testConfig.name && testConfig.questions) {
      // 构建基址兼容原服务器/PMD/与Cloudflare根目录，不改动题库及其计分配置。
      const imageUrl = testConfig.imageUrl?.startsWith('/PMD/')
        ? `${import.meta.env.BASE_URL}${testConfig.imageUrl.slice('/PMD/'.length)}`
        : testConfig.imageUrl
      themeManager.registerTheme({ ...testConfig, imageUrl })
    }
  }
}

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
