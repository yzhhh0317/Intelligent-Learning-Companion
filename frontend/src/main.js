import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

// 创建Vue应用实例
const app = createApp(App)

// 安装Pinia状态管理
const pinia = createPinia()
app.use(pinia)

// 全局错误处理
app.config.errorHandler = (err, vm, info) => {
  console.error('Vue错误:', err);
  console.error('错误信息:', info);
};

// 挂载应用
app.mount('#app')

console.log('🎉 智能学习伴侣前端应用启动完成')