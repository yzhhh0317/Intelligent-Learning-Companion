<template>
  <div id="app">
    <!-- 头部 -->
    <header class="app-header">
      <div class="header-content">
        <div class="logo-section">
          <span class="logo">🧠</span>
          <div>
            <h1>智能学习伴侣</h1>
            <p class="subtitle">基于RAG的个性化学习助手</p>
          </div>
        </div>
        
        <div class="status-section">
          <div class="status-indicator">
            <span :class="['status-dot', statusClass]"></span>
            <span class="status-text">{{ statusText }}</span>
          </div>
          <button @click="checkHealth" class="refresh-btn" title="刷新状态">
            🔄
          </button>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="app-main">
      <!-- API离线提示 -->
      <div v-if="!isOnline" class="warning-box">
        <span class="warning-icon">⚠️</span>
        <div>
          <h3>后端服务连接中...</h3>
          <p>请确保后端服务已启动: <code>cd backend && npm start</code></p>
        </div>
      </div>

      <!-- 标签页导航 -->
      <div class="tab-nav">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="currentTab = tab.id"
          :class="['tab-btn', { active: currentTab === tab.id }]"
        >
          {{ tab.icon }} {{ tab.name }}
        </button>
      </div>

      <!-- 标签页内容 -->
      <div class="tab-content">
        <!-- 内容处理页 -->
        <div v-show="currentTab === 'input'" class="tab-panel">
          <ContentInput />
        </div>

        <!-- 智能问答页 -->
        <div v-show="currentTab === 'chat'" class="tab-panel">
          <ChatInterface />
        </div>

        <!-- 知识库页 -->
        <div v-show="currentTab === 'knowledge'" class="tab-panel">
          <KnowledgeBase />
        </div>
      </div>
    </main>

    <!-- 页脚 -->
    <footer class="app-footer">
      <p>🚀 智能学习伴侣 - 基于RAG技术的个性化学习助手</p>
      <p>前端: Vue 3 | 后端: Node.js + Express + DeepSeek</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from './config/api';
import ContentInput from './components/ContentInput.vue';
import ChatInterface from './components/ChatInterface.vue';
import KnowledgeBase from './components/KnowledgeBase.vue';

// 状态
const currentTab = ref('input');
const isOnline = ref(false);
const apiStatus = ref('checking');

// 标签页配置
const tabs = [
  { id: 'input', name: '内容处理', icon: '📝' },
  { id: 'chat', name: '智能问答', icon: '🤖' },
  { id: 'knowledge', name: '知识库', icon: '📚' }
];

// 计算属性
const statusClass = ref('');
const statusText = ref('检查中...');

// 更新状态显示
const updateStatus = () => {
  if (apiStatus.value === 'online') {
    statusClass.value = 'online';
    statusText.value = '服务正常';
  } else if (apiStatus.value === 'offline') {
    statusClass.value = 'offline';
    statusText.value = '服务离线';
  } else {
    statusClass.value = 'checking';
    statusText.value = '检查中...';
  }
};

// 检查健康状态
const checkHealth = async () => {
  apiStatus.value = 'checking';
  updateStatus();
  
  try {
    const health = await api.healthCheck();
    if (health.status === 'healthy') {
      isOnline.value = true;
      apiStatus.value = 'online';
    } else {
      isOnline.value = false;
      apiStatus.value = 'offline';
    }
  } catch (error) {
    isOnline.value = false;
    apiStatus.value = 'offline';
    console.error('健康检查失败:', error);
  }
  
  updateStatus();
};

// 初始化
onMounted(() => {
  checkHealth();
  // 每30秒检查一次
  setInterval(checkHealth, 600000);
});
</script>

<style>
/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: #333;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.95);
}

/* 头部样式 */
.app-header {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid #e0e0e0;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  font-size: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 0.5rem;
  border-radius: 10px;
}

.logo-section h1 {
  font-size: 1.5rem;
  color: #333;
}

.subtitle {
  font-size: 0.875rem;
  color: #666;
  margin-top: 0.25rem;
}

.status-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.online {
  background: #4caf50;
}

.status-dot.offline {
  background: #f44336;
}

.status-dot.checking {
  background: #ff9800;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.refresh-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  transition: transform 0.3s;
}

.refresh-btn:hover {
  transform: rotate(180deg);
}

/* 主内容区 */
.app-main {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  width: 100%;
}

.warning-box {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 2rem;
  display: flex;
  gap: 1rem;
  align-items: start;
}

.warning-icon {
  font-size: 1.5rem;
}

.warning-box h3 {
  color: #856404;
  margin-bottom: 0.5rem;
}

.warning-box p {
  color: #856404;
  font-size: 0.875rem;
}

.warning-box code {
  background: #ffeeba;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}

/* 标签页导航 */
.tab-nav {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 10px;
}

.tab-btn {
  padding: 0.75rem 1.5rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
  transition: all 0.3s;
}

.tab-btn:hover {
  background: #e0e0e0;
}

.tab-btn.active {
  background: white;
  color: #667eea;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

/* 标签页内容 */
.tab-content {
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  min-height: 500px;
}

.tab-panel {
  padding: 2rem;
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 页脚 */
.app-footer {
  background: #f5f5f5;
  padding: 2rem;
  text-align: center;
  border-top: 1px solid #e0e0e0;
}

.app-footer p {
  color: #666;
  font-size: 0.875rem;
  margin: 0.25rem 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .app-main {
    padding: 1rem;
  }
  
  .tab-nav {
    flex-direction: column;
  }
  
  .tab-btn {
    width: 100%;
  }
}
</style>