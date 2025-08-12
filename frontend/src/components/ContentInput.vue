<template>
  <div class="content-input">
    <!-- <div class="page-header">
      <h2>📝 智能内容处理</h2>
      <p>粘贴学习内容，让AI帮你生成摘要和结构化笔记</p>
    </div> -->

    <!-- 输入区域 -->
    <div class="input-section">
      <div class="input-group">
        <label>学习内容标题（可选）</label>
        <input 
          v-model="title" 
          type="text" 
          placeholder="例如：React Hooks 学习总结"
          class="text-input"
        />
      </div>

      <div class="input-group">
        <label>
          学习内容
          <span v-if="content" class="word-count">
            ({{ wordCount }} 字)
          </span>
        </label>
        <textarea 
          v-model="content"
          rows="12"
          placeholder="粘贴或输入你要学习的内容..."
          class="content-textarea"
        ></textarea>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <button 
          @click="generateSummary" 
          :disabled="!content || isProcessing"
          class="btn btn-primary"
        >
          📄 生成摘要
        </button>
        <button 
          @click="generateNotes" 
          :disabled="!content || isProcessing"
          class="btn btn-success"
        >
          📝 生成结构化笔记
        </button>
        <button 
          @click="clearContent" 
          class="btn btn-secondary"
        >
          🗑️ 清空内容
        </button>
      </div>
    </div>

    <!-- 处理结果 -->
    <div v-if="result" class="result-section">
      <div class="result-header">
        <h3>{{ resultType === 'summary' ? '📄 智能摘要' : '📝 结构化笔记' }}</h3>
        <span v-if="resultType === 'summary' && compressionRatio" class="compression-info">
          压缩率: {{ (compressionRatio * 100).toFixed(1) }}%
        </span>
      </div>
      
      <div class="result-content">
        <pre v-if="!resultExpanded">{{ result.substring(0, 500) }}{{ result.length > 500 ? '...' : '' }}</pre>
        <pre v-else>{{ result }}</pre>
      </div>
      
      <div class="result-actions">
        <button v-if="result.length > 500" 
                @click="resultExpanded = !resultExpanded" 
                class="expand-btn">
          {{ resultExpanded ? '收起' : '查看全部' }}
        </button>
      </div>
      
      <div v-if="savedId" class="save-success">
        ✅ 已保存到知识库 (ID: {{ savedId }})
      </div>
    </div>

    <!-- 加载提示 -->
    <div v-if="isProcessing" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>AI正在处理中，请稍候...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import api from '../config/api';

// 状态
const title = ref('');
const content = ref('');
const result = ref('');
const resultType = ref('');
const compressionRatio = ref(null);
const savedId = ref('');
const isProcessing = ref(false);
const resultExpanded = ref(false);

// 计算属性
const wordCount = computed(() => {
  return content.value.length;
});

// 生成摘要
const generateSummary = async () => {
  if (!content.value || isProcessing.value) return;
  
  isProcessing.value = true;
  result.value = '';
  savedId.value = '';
  resultExpanded.value = false;
  
  try {
    const response = await api.generateSummary(content.value);
    result.value = response.summary;
    resultType.value = 'summary';
    compressionRatio.value = response.compression_ratio;
  } catch (error) {
    alert('生成摘要失败: ' + error.message);
  } finally {
    isProcessing.value = false;
  }
};

// 生成结构化笔记
const generateNotes = async () => {
  if (!content.value || isProcessing.value) return;
  
  isProcessing.value = true;
  result.value = '';
  savedId.value = '';
  resultExpanded.value = false;
  
  try {
    const response = await api.generateNotes(content.value, title.value);
    result.value = response.notes;
    resultType.value = 'notes';
    compressionRatio.value = null;
    
    if (response.saved) {
      savedId.value = response.note_id;
    }
  } catch (error) {
    alert('生成笔记失败: ' + error.message);
  } finally {
    isProcessing.value = false;
  }
};

// 清空内容
const clearContent = () => {
  title.value = '';
  content.value = '';
  result.value = '';
  resultType.value = '';
  compressionRatio.value = null;
  savedId.value = '';
  resultExpanded.value = false;
};
</script>

<style scoped>
.content-input {
  position: relative;
  max-width: 1400px;
  margin: 15px;
}

.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-header h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.page-header p {
  color: #666;
  font-size: 0.95rem;
}

.input-section {
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.input-group {
  margin-bottom: 1.5rem;
}

.input-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #555;
}

.word-count {
  color: #667eea;
  font-size: 0.875rem;
  font-weight: normal;
}

.text-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.text-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.content-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.3s;
}

.content-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a67d8;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.btn-success {
  background: #48bb78;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #38a169;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(72, 187, 120, 0.3);
}

.btn-secondary {
  background: #718096;
  color: white;
}

.btn-secondary:hover {
  background: #4a5568;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(113, 128, 150, 0.3);
}

.result-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e2e8f0;
}

.result-header h3 {
  color: #333;
  margin: 0;
}

.compression-info {
  background: #edf2f7;
  color: #48bb78;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.result-content {
  background: #f7fafc;
  padding: 1rem;
  border-radius: 6px;
  max-height: 400px;
  overflow-y: auto;
}

.result-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: inherit;
  margin: 0;
  color: #2d3748;
  line-height: 1.8;
}

.save-success {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #c6f6d5;
  color: #22543d;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.result-actions {
  margin-top: 1rem;
}

.expand-btn {
  padding: 0.5rem 1rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s;
}

.expand-btn:hover {
  background: #5a67d8;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
  border-radius: 8px;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e2e8f0;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-overlay p {
  color: #4a5568;
  font-size: 1rem;
}
</style>