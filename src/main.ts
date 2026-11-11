import { createApp } from 'vue'
import AdminApp from './AdminApp.vue'
import App from './App.vue'
import './style.css'

// The sync server serves the same file for /admin.
const isAdmin = location.pathname.replace(/\/+$/, '') === '/admin'
createApp(isAdmin ? AdminApp : App).mount('#app')
