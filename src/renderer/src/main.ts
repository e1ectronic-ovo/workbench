import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles.css'
import './styles/mac.css'
import './styles/whale-theme.css'
import './styles/eva-theme.css'
import { useSettingsStore } from './stores/settings'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
// 尽早应用外观 token
useSettingsStore(pinia)
app.mount('#app')
