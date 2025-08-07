<template>
  <div class="chat-interface">
    <div class="page-header">
      <h2>🤖 智能问答</h2>
      <p>基于你的个人知识库，提供个性化学习建议</p>
    </div>

    <!-- RAG说明 -->
    <div class="rag-info">
      <div class="info-icon">🧠</div>
      <div>
        <h4>RAG增强问答</h4>
        <p>系统会自动检索你的个人知识库，结合历史学习内容提供个性化答案</p>
      </div>
    </div>

    <!-- 聊天设置 -->
    <div class="chat-settings">
      <label class="checkbox-label">
        <input type="checkbox" v-model="useRAG" />
        <span>使用RAG增强</span>
      </label>
      <button @click="clearHistory" class="clear-btn">
        🗑️ 清空对话
      </button>
    </div>

    <!-- 对话区域 -->
    <div class="chat-container">
      <!-- 欢迎消息 -->
      <div v-if="messages.length === 0" class="welcome-message">
        <div class="welcome-icon">🤖</div>
        <h3>开始智能对话</h3>
        <p>问我任何学习相关的问题，我会基于你的知识库提供个性化建议</p>
        
        <div class="example-questions">
          <p>试试这些问题：</p>
          <div class="example-buttons">
            <button 
              v-for="example in exampleQuestions" 
              :key="example"
              @click="askExample(example)"
              class="example-btn"
            >
              {{ example }}
            </button>
          </div>
        </div>
      </div>

      <!-- 对话消息 -->
      <div class="messages" ref="messagesContainer">
        <div v-for="(msg, index) in messages" :key="index" class="message-row">
          <!-- 用户消息 -->
          <div v-if="msg.type === 'user'" class="message user-message">
            <div class="message-content">{{ msg.content }}</div>
            <div class="message-time">{{ formatTime(msg.time) }}</div>
          </div>
          
          <!-- AI消息 -->
          <div v-else class="message ai-message">
            <div class="message-content">{{ msg.content }}</div>
            <div v-if="msg.context" class="message-context">
              🧠 基于 {{ msg.context.relevant_notes }} 条历史笔记生成
              <span v-if="msg.processingTime">
                ({{ msg.processingTime.toFixed(2) }}s)
              </span>
            </div>
            <div class="message-time">{{ formatTime(msg.time) }}</div>
          </div>
        </div>
        
        <!-- 加载中 -->
        <div v-if="isLoading" class="message ai-message loading">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>思考中...</span>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <input 
        v-model="currentQuestion"
        @keyup.enter="sendQuestion"
        type="text"
        placeholder="问我任何学习相关的问题..."
        class="question-input"
        :disabled="isLoading"
      />
      <button 
        @click="sendQuestion"
        :disabled="!currentQuestion.trim() || isLoading"
        class="send-btn"
      >
        {{ isLoading ? '🤔' : '🚀' }} 发送
      </button>
    </div>

    <div class="input-hint">
      💡 试试问：React和Vue的区别、什么是RAG技术等
      <span v-if="useRAG" class="rag-status">🧠 RAG增强已开启</span>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import api from '../config/api';

// 状态
const messages = ref([]);
const currentQuestion = ref('');
const useRAG = ref(true);
const isLoading = ref(false);

// 示例问题
const exampleQuestions = [
  'React Hooks和Vue Composition API有什么区别？',
  '什么是RAG技术？',
  '如何优化前端性能？'
];

// 发送问题
const sendQuestion = async () => {
  if (!currentQuestion.value.trim() || isLoading.value) return;
  
  const question = currentQuestion.value.trim();
  
  // 添加用户消息
  messages.value.push({
    type: 'user',
    content: question,
    time: new Date()
  });
  
  currentQuestion.value = '';
  isLoading.value = true;
  
  try {
    const response = await api.askQuestion(question, useRAG.value);
    
    // 添加AI回复
    messages.value.push({
      type: 'ai',
      content: response.answer,
      context: response.context_info,
      processingTime: response.processing_time,
      time: new Date()
    });
    
    // 滚动到底部
    await nextTick();
    scrollToBottom();
    
  } catch (error) {
    messages.value.push({
      type: 'ai',
      content: '抱歉，处理您的问题时出现了错误：' + error.message,
      time: new Date()
    });
  } finally {
    isLoading.value = false;
  }
};

// 使用示例问题
const askExample = (question) => {
  currentQuestion.value = question;
  sendQuestion();
};

// 清空历史
const clearHistory = () => {
  if (confirm('确定要清空所有对话历史吗？')) {
    messages.value = [];
  }
};

// 滚动到底部
const scrollToBottom = () => {
  const container = document.querySelector('.messages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
};

// 格式化时间
const formatTime = (date) => {
  return new Date(date).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};
</script>

<style scoped>
.chat-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 600px;
}

.page-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.page-header h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.page-header p {
  color: #666;
  font-size: 0.95rem;
}

.rag-info {
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border: 1px solid #667eea30;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.info-icon {
  font-size: 1.5rem;
}

.rag-info h4 {
  color: #667eea;
  margin-bottom: 0.25rem;
}

.rag-info p {
  color: #4a5568;
  font-size: 0.875rem;
}

.chat-settings {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.clear-btn {
  background: none;
  border: none;
  color: #718096;
  cursor: pointer;
  font-size: 0.875rem;
  transition: color 0.3s;
}

.clear-btn:hover {
  color: #e53e3e;
}

.chat-container {
  flex: 1;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.welcome-message {
  text-align: center;
  padding: 3rem 1rem;
}

.welcome-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.welcome-message h3 {
  color: #333;
  margin-bottom: 0.5rem;
}

.welcome-message p {
  color: #666;
  margin-bottom: 2rem;
}

.example-questions p {
  color: #718096;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.example-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.example-btn {
  padding: 0.5rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  font-size: 0.875rem;
  color: #4a5568;
  cursor: pointer;
  transition: all 0.3s;
}

.example-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
}

.message-row {
  margin-bottom: 1.5rem;
}

.message {
  padding: 1rem;
  border-radius: 8px;
  max-width: 70%;
}

.user-message {
  background: #667eea;
  color: white;
  margin-left: auto;
}

.ai-message {
  background: white;
  color: #333;
  border: 1px solid #e2e8f0;
}

.message-content {
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-context {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e2e8f0;
  font-size: 0.875rem;
  color: #667eea;
}

.message-time {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.7;
}

.loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.typing-indicator {
  display: flex;
  gap: 0.25rem;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #667eea;
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
  }
  30% {
    transform: translateY(-10px);
  }
}

.input-area {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.question-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.question-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.send-btn {
  padding: 0.75rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.send-btn:hover:not(:disabled) {
  background: #5a67d8;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-hint {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: #718096;
  display: flex;
  justify-content: space-between;
}

.rag-status {
  color: #667eea;
  font-weight: 500;
}
</style>