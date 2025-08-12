<template>
  <div id="app" class="app-container">
    <!-- 侧边栏 -->
    <aside class="sidebar" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <!-- 侧边栏头部 -->
      <div class="sidebar-header">
        <div class="logo-section" v-if="!sidebarCollapsed">
          <span class="logo">🧠</span>
          <div class="app-info">
            <h2>智能学习伴侣</h2>
            <p class="subtitle">RAG增强学习助手</p>
          </div>
        </div>
        <span class="logo-only" v-else>🧠</span>
        
        <!-- 折叠按钮 -->
        <button @click="toggleSidebar" class="collapse-btn" :title="sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'">
          <span v-if="sidebarCollapsed">→</span>
          <span v-else>←</span>
        </button>
      </div>

      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <div 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="currentTab = tab.id"
          :class="['nav-item', { active: currentTab === tab.id }]"
          :title="sidebarCollapsed ? tab.name : ''"
        >
          <span class="nav-icon">{{ tab.icon }}</span>
          <span v-if="!sidebarCollapsed" class="nav-text">{{ tab.name }}</span>
          <div v-if="currentTab === tab.id" class="active-indicator"></div>
        </div>
      </nav>

      <!-- 状态指示器 -->
      <div class="sidebar-status" v-if="!sidebarCollapsed">
        <div class="status-item">
          <span :class="['status-dot', statusClass]"></span>
          <span class="status-text">{{ statusText }}</span>
        </div>
        <button @click="checkHealth" class="status-refresh" title="刷新状态">
          🔄
        </button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content" :class="{ 'main-expanded': sidebarCollapsed }">
      <!-- API离线提示 -->
      <div v-if="!isOnline" class="warning-banner">
        <span class="warning-icon">⚠️</span>
        <div>
          <strong>后端服务连接中...</strong>
          <p>请确保后端服务已启动</p>
        </div>
      </div>

      <!-- 内容区域 -->
      <div class="content-area">
        <!-- 内容处理页 -->
        <div v-show="currentTab === 'input'" class="tab-panel">
          <div class="page-header">
            <h1>📝 内容处理</h1>
            <p>智能处理学习内容，生成摘要和结构化笔记</p>
          </div>
          <ContentInput />
        </div>

        <!-- 智能问答页 -->
        <div v-show="currentTab === 'chat'" class="tab-panel">
          <div class="page-header">
            <h1>🤖 智能问答</h1>
            <p>基于个人知识库的智能问答系统</p>
          </div>
          <ChatInterface />
        </div>

        <!-- 知识库页 -->
        <div v-show="currentTab === 'knowledge'" class="tab-panel">
          <div class="page-header">
            <h1>📚 知识库</h1>
            <p>管理和搜索你的学习笔记</p>
          </div>
          <KnowledgeBase />
        </div>

        <!-- RAG控制台页 -->
        <div v-show="currentTab === 'rag'" class="tab-panel">
          <div class="page-header">
            <h1>🚀 RAG控制台</h1>
            <p>检索增强生成技术演示平台</p>
          </div>
          <RAGConsole />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from './config/api';
import ContentInput from './components/ContentInput.vue';
import ChatInterface from './components/ChatInterface.vue';
import KnowledgeBase from './components/KnowledgeBase.vue';
import RAGConsole from './components/RAGConsole.vue';

// 状态管理
const currentTab = ref('input');
const sidebarCollapsed = ref(false);
const isOnline = ref(false);
const apiStatus = ref('checking');

// 标签页配置
const tabs = [
  { id: 'input', name: '内容处理', icon: '📝' },
  { id: 'chat', name: '智能问答', icon: '🤖' },
  { id: 'knowledge', name: '知识库', icon: '📚' },
  { id: 'rag', name: 'RAG控制台', icon: '🚀' }
];

// 状态显示
const statusClass = ref('checking');
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

// 切换侧边栏
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value;
  // 保存用户偏好
  localStorage.setItem('sidebarCollapsed', sidebarCollapsed.value);
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
  // 恢复用户偏好
  const savedCollapsed = localStorage.getItem('sidebarCollapsed');
  if (savedCollapsed === 'true') {
    sidebarCollapsed.value = true;
  }
  
  // 恢复上次的标签页
  const savedTab = localStorage.getItem('currentTab');
  if (savedTab && tabs.some(tab => tab.id === savedTab)) {
    currentTab.value = savedTab;
  }
  
  checkHealth();
  // 每30秒检查一次
  setInterval(checkHealth, 30000);
});

// 监听标签页变化，保存用户偏好
import { watch } from 'vue';
watch(currentTab, (newTab) => {
  localStorage.setItem('currentTab', newTab);
});
</script>

<style scoped>
/* 全局重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 应用容器 */
.app-container {
  display: flex;
  height: 100vh;
  background: #f5f7fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 侧边栏样式 */
.sidebar {
  width: 250px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
  transition: width 0.3s ease;
  position: relative;
  z-index: 100;
}

.sidebar-collapsed {
  width: 70px;
}

/* 侧边栏头部 */
.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-section {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo, .logo-only {
  font-size: 2rem;
  background: rgba(255, 255, 255, 0.2);
  padding: 0.5rem;
  border-radius: 12px;
  backdrop-filter: blur(10px);
}

.app-info h2 {
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.subtitle {
  font-size: 0.85rem;
  opacity: 0.8;
}

.collapse-btn {
  position: absolute;
  top: 50%;
  right: -15px;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: white;
  border: none;
  color: #667eea;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  z-index: 101;
}

.collapse-btn:hover {
  background: #f0f0f0;
  transform: translateY(-50%) scale(1.1);
}

/* 导航菜单 */
.sidebar-nav {
  flex: 1;
  padding: 1rem 0;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 1rem 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  margin: 0 0.5rem;
  border-radius: 12px;
}

.sidebar-collapsed .nav-item {
  justify-content: center;
  padding: 1rem;
  margin: 0.5rem;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.nav-item.active {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.nav-icon {
  font-size: 1.5rem;
  min-width: 1.5rem;
}

.nav-text {
  margin-left: 1rem;
  font-weight: 500;
  font-size: 1rem;
}

.active-indicator {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 60%;
  background: white;
  border-radius: 2px 0 0 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

/* 状态指示器 */
.sidebar-status {
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-item {
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

.status-text {
  font-size: 0.85rem;
  opacity: 0.9;
}

.status-refresh {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem;
  border-radius: 4px;
  transition: background 0.3s ease;
}

.status-refresh:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: rotate(180deg);
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-left: 0;
  transition: margin-left 0.3s ease;
}

.main-expanded {
  margin-left: 0;
}

/* 警告横幅 */
.warning-banner {
  background: linear-gradient(135deg, #fff3cd, #ffeaa7);
  border: 1px solid #ffc107;
  color: #856404;
  padding: 1rem;
  margin: 1rem;
  border-radius: 8px;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.warning-icon {
  font-size: 1.5rem;
}

/* 内容区域 */
.content-area {
  flex: 1;
  overflow: auto;
  padding: 0;
}

.tab-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

/* 页面头部 */
.page-header {
  background: white;
  padding: 2rem;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.page-header h1 {
  font-size: 2rem;
  color: #1f2937;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.page-header p {
  color: #6b7280;
  font-size: 1.1rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  
  .sidebar.show {
    transform: translateX(0);
  }
  
  .main-content {
    margin-left: 0;
    width: 100%;
  }
  
  .collapse-btn {
    display: none;
  }
}

@media (max-width: 480px) {
  .page-header {
    padding: 1rem;
  }
  
  .page-header h1 {
    font-size: 1.5rem;
  }
}
</style>