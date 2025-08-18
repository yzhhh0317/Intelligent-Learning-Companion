<template>
  <div class="skeleton-container">
    <!-- 消息骨架屏 -->
    <div v-if="type === 'message'" class="skeleton-message">
      <div class="skeleton-avatar"></div>
      <div class="skeleton-content">
        <div class="skeleton-line skeleton-line-75"></div>
        <div class="skeleton-line skeleton-line-100"></div>
        <div class="skeleton-line skeleton-line-60"></div>
      </div>
    </div>

    <!-- 搜索结果骨架屏 -->
    <div v-else-if="type === 'search'" class="skeleton-search">
      <div v-for="i in count" :key="i" class="skeleton-search-item">
        <div class="skeleton-header">
          <div class="skeleton-line skeleton-line-40"></div>
          <div class="skeleton-badge"></div>
        </div>
        <div class="skeleton-line skeleton-line-100"></div>
        <div class="skeleton-line skeleton-line-80"></div>
        <div class="skeleton-footer">
          <div class="skeleton-tag"></div>
          <div class="skeleton-tag"></div>
        </div>
      </div>
    </div>

    <!-- 笔记列表骨架屏 -->
    <div v-else-if="type === 'notes'" class="skeleton-notes">
      <div v-for="i in count" :key="i" class="skeleton-note-item">
        <div class="skeleton-note-header">
          <div class="skeleton-line skeleton-line-60"></div>
          <div class="skeleton-actions">
            <div class="skeleton-btn"></div>
            <div class="skeleton-btn"></div>
          </div>
        </div>
        <div class="skeleton-line skeleton-line-100"></div>
        <div class="skeleton-line skeleton-line-90"></div>
        <div class="skeleton-note-footer">
          <div class="skeleton-tag"></div>
          <div class="skeleton-tag"></div>
          <div class="skeleton-time"></div>
        </div>
      </div>
    </div>

    <!-- RAG结果骨架屏 -->
    <div v-else-if="type === 'rag'" class="skeleton-rag">
      <!-- Pipeline步骤骨架屏 -->
      <div class="skeleton-pipeline">
        <div v-for="i in 4" :key="i" class="skeleton-step">
          <div class="skeleton-step-icon"></div>
          <div class="skeleton-step-text"></div>
        </div>
      </div>
      
      <!-- 检索结果骨架屏 -->
      <div class="skeleton-sources">
        <div v-for="i in 3" :key="i" class="skeleton-source">
          <div class="skeleton-source-header">
            <div class="skeleton-rank"></div>
            <div class="skeleton-line skeleton-line-50"></div>
            <div class="skeleton-score"></div>
          </div>
          <div class="skeleton-line skeleton-line-100"></div>
          <div class="skeleton-line skeleton-line-75"></div>
        </div>
      </div>
      
      <!-- 答案骨架屏 -->
      <div class="skeleton-answer">
        <div class="skeleton-line skeleton-line-100"></div>
        <div class="skeleton-line skeleton-line-95"></div>
        <div class="skeleton-line skeleton-line-80"></div>
        <div class="skeleton-line skeleton-line-70"></div>
      </div>
    </div>

    <!-- 通用内容骨架屏 -->
    <div v-else class="skeleton-content">
      <div v-for="i in count" :key="i" class="skeleton-line" :class="`skeleton-line-${[100, 85, 90, 75][i % 4]}`"></div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    default: 'content', // 'message', 'search', 'notes', 'rag', 'content'
  },
  count: {
    type: Number,
    default: 3,
  }
})
</script>

<style scoped>
/* 基础骨架屏样式 */
.skeleton-container {
  padding: 1rem;
}

/* 通用动画 */
.skeleton-line,
.skeleton-avatar,
.skeleton-badge,
.skeleton-tag,
.skeleton-btn,
.skeleton-step-icon,
.skeleton-rank,
.skeleton-score {
  background: linear-gradient(90deg, #f0f2f5 25%, #e6e8eb 50%, #f0f2f5 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 线条样式 */
.skeleton-line {
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-line-40 { width: 40%; }
.skeleton-line-50 { width: 50%; }
.skeleton-line-60 { width: 60%; }
.skeleton-line-70 { width: 70%; }
.skeleton-line-75 { width: 75%; }
.skeleton-line-80 { width: 80%; }
.skeleton-line-85 { width: 85%; }
.skeleton-line-90 { width: 90%; }
.skeleton-line-95 { width: 95%; }
.skeleton-line-100 { width: 100%; }

/* 消息骨架屏 */
.skeleton-message {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.skeleton-content {
  flex: 1;
}

/* 搜索结果骨架屏 */
.skeleton-search-item {
  background: #f8f9fa;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.skeleton-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.skeleton-badge {
  width: 60px;
  height: 20px;
  border-radius: 10px;
}

.skeleton-footer {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.skeleton-tag {
  width: 50px;
  height: 16px;
  border-radius: 8px;
}

/* 笔记列表骨架屏 */
.skeleton-note-item {
  background: #f8f9fa;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.skeleton-note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.skeleton-actions {
  display: flex;
  gap: 0.5rem;
}

.skeleton-btn {
  width: 50px;
  height: 24px;
  border-radius: 6px;
}

.skeleton-note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.75rem;
}

.skeleton-time {
  width: 80px;
  height: 14px;
  border-radius: 4px;
}

/* RAG结果骨架屏 */
.skeleton-pipeline {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #f7fafc;
  border-radius: 8px;
}

.skeleton-step {
  flex: 1;
  text-align: center;
}

.skeleton-step-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin: 0 auto 0.5rem;
}

.skeleton-step-text {
  height: 14px;
  width: 80%;
  margin: 0 auto;
}

.skeleton-sources {
  margin-bottom: 2rem;
}

.skeleton-source {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.skeleton-source-header {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

.skeleton-rank {
  width: 30px;
  height: 24px;
  border-radius: 6px;
  flex-shrink: 0;
}

.skeleton-score {
  width: 60px;
  height: 20px;
  border-radius: 10px;
  flex-shrink: 0;
}

.skeleton-answer {
  background: linear-gradient(135deg, #667eea05, #764ba205);
  border: 2px solid #667eea20;
  border-radius: 12px;
  padding: 1.5rem;
}

/* 响应式 */
@media (max-width: 768px) {
  .skeleton-pipeline {
    flex-direction: column;
  }
  
  .skeleton-header,
  .skeleton-note-header,
  .skeleton-source-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
}
</style>