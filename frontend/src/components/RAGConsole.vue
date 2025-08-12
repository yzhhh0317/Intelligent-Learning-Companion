<template>
  <div class="rag-console">
    <!-- 页面标题 -->
    <!-- <div class="console-header">
      <h2>🚀 RAG Pipeline 控制台</h2>
      <p>展示完整的检索增强生成技术栈</p>
    </div> -->

    <!-- 技术栈展示 -->
    <!-- <div class="tech-stack-showcase">
      <div class="tech-card" v-for="tech in techStack" :key="tech.name">
        <div class="tech-icon">{{ tech.icon }}</div>
        <div class="tech-name">{{ tech.name }}</div>
        <div class="tech-desc">{{ tech.desc }}</div>
      </div>
    </div> -->

    <!-- Pipeline流程图 -->
    <div class="pipeline-flow">
      <h3>📊 RAG Pipeline 架构</h3>
      <div class="flow-container">
        <div class="flow-step" v-for="(step, index) in pipelineSteps" :key="index"
             :class="{ 'active': currentStep === index, 'completed': completedSteps.includes(index) }">
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-icon">{{ step.icon }}</div>
          <div class="step-name">{{ step.name }}</div>
          <div class="step-tech">{{ step.tech }}</div>
          <div v-if="index < pipelineSteps.length - 1" class="step-arrow">→</div>
        </div>
      </div>
    </div>

    <!-- 文档处理区（上方） -->
    <div class="function-card">
      <h3>📄 文档处理</h3>
      
      <div class="doc-process-container">
        <!-- 文件上传 -->
        <div class="upload-area" 
             @drop="handleDrop" 
             @dragover.prevent 
             @dragenter.prevent
             :class="{ 'dragging': isDragging }">
          <input type="file" 
                 ref="fileInput" 
                 @change="handleFileSelect" 
                 accept=".txt,.md,.pdf,.json"
                 style="display: none">
          <div class="upload-content" @click="$refs.fileInput.click()">
            <div class="upload-icon">📤</div>
            <p>拖拽文件到这里或点击上传</p>
            <p class="file-types">支持: TXT, MD, PDF, JSON</p>
          </div>
        </div>

        <!-- 文本输入 -->
        <div class="text-input-area">
          <input v-model="docTitle" 
                 type="text" 
                 placeholder="文档标题"
                 class="doc-title-input">
          <textarea v-model="docContent" 
                    placeholder="或直接粘贴文档内容..."
                    rows="6"
                    class="doc-content-input"></textarea>
          <button @click="processDocument" 
                  :disabled="!canProcess || isProcessing"
                  class="process-btn">
            <span v-if="!isProcessing">🔗 使用LangChain处理文档</span>
            <span v-else>⏳ 处理中...</span>
          </button>
        </div>

        <!-- 处理日志 -->
        <div v-if="processLogs.length > 0" class="process-logs">
          <h4>处理日志</h4>
          <div class="log-container">
            <div v-for="(log, index) in processLogs" :key="index" 
                 class="log-item" :class="log.type">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-icon">{{ log.icon }}</span>
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- RAG查询区（下方） -->
    <div class="function-card">
      <h3>🔍 RAG查询测试</h3>
      
      <!-- 查询输入 -->
      <div class="query-section">
        <div class="query-input-container">
          <textarea v-model="queryText" 
                    placeholder="输入查询问题..."
                    rows="3"
                    class="query-input"></textarea>
          
          <!-- 查询配置 -->
          <div class="query-config">
            <label class="config-item">
              <input type="checkbox" v-model="useSemanticSearch">
              <span>语义搜索</span>
            </label>
            <label class="config-item">
              <input type="checkbox" v-model="useBM25">
              <span>BM25搜索</span>
            </label>
            <label class="config-item">
              <input type="checkbox" v-model="useRRF">
              <span>RRF融合</span>
            </label>
            <label class="config-item">
              <input type="number" v-model="topK" min="1" max="10">
              <span>Top-K</span>
            </label>
          </div>

          <button @click="executeRAGQuery" 
                  :disabled="!queryText || isQuerying"
                  class="query-btn">
            <span v-if="!isQuerying">🚀 执行RAG查询</span>
            <span v-else>🔄 查询中...</span>
          </button>
        </div>

        <!-- 查询结果 -->
        <div v-if="queryResult" class="query-result">
          <!-- Pipeline执行详情（横向显示） -->
          <div class="pipeline-details">
            <h4>⚡ Pipeline执行流程</h4>
            <div class="execution-steps-horizontal">
              <div v-for="(step, index) in queryResult.pipeline.steps" :key="step.name" 
                   class="exec-step-h">
                <div class="exec-step-number">{{ index + 1 }}</div>
                <div class="exec-name">{{ step.name }}</div>
                <div class="exec-time">{{ step.time }}</div>
                <div class="exec-tech">{{ step.tech }}</div>
                <div v-if="index < queryResult.pipeline.steps.length - 1" class="exec-arrow">→</div>
              </div>
            </div>
          </div>

          <!-- 检索结果（过滤0%匹配度，网格显示） -->
          <div class="retrieval-results" v-if="validSources.length > 0">
            <h4>📚 检索结果 ({{ validSources.length }} 个相关文档)</h4>
            <div class="source-grid">
              <div v-for="(source, index) in validSources" :key="index" 
                   class="source-card">
                <div class="source-header">
                  <span class="source-rank">#{{ index + 1 }}</span>
                  <span class="source-score" :style="{ background: getScoreColor(source.score) }">
                    {{ (source.score * 100).toFixed(1) }}%
                  </span>
                </div>
                <div class="source-title">{{ source.title || `文档片段 ${index + 1}` }}</div>
                <div class="source-content-preview">
                  <p v-if="!source.expanded">{{ source.content.substring(0, 100) }}...</p>
                  <p v-else>{{ source.content }}</p>
                </div>
                <div class="source-footer">
                  <button @click="toggleExpand(source)" class="expand-btn">
                    {{ source.expanded ? '收起' : '查看全部' }}
                  </button>
                  <span class="source-type">{{ source.type }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 最终答案 -->
          <div class="final-answer">
            <h4>💡 生成的答案</h4>
            <div class="answer-content">
              <div v-if="!answerExpanded" class="answer-preview">
                {{ queryResult.answer.substring(0, 300) }}
                <span v-if="queryResult.answer.length > 300">...</span>
              </div>
              <div v-else class="answer-full">
                {{ queryResult.answer }}
              </div>
            </div>
            <div class="answer-actions">
              <button v-if="queryResult.answer.length > 300" 
                      @click="answerExpanded = !answerExpanded" 
                      class="expand-btn">
                {{ answerExpanded ? '收起' : '查看完整答案' }}
              </button>
              <div class="answer-stats">
                <span>🕐 总耗时: {{ queryResult.totalTime }}</span>
                <span>📊 使用文档: {{ validSources.length }}</span>
                <span>🧠 模型: DeepSeek</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 简化的统计（去掉和知识库重复的部分） -->
    <div class="performance-monitor">
      <h3>⚡ 性能监控</h3>
      <div class="perf-metrics">
        <div class="metric">
          <span class="metric-label">Embedding生成</span>
          <div class="metric-bar">
            <div class="metric-fill" :style="{ width: '75%' }"></div>
          </div>
          <span class="metric-value">~300ms</span>
        </div>
        <div class="metric">
          <span class="metric-label">向量检索</span>
          <div class="metric-bar">
            <div class="metric-fill" :style="{ width: '45%' }"></div>
          </div>
          <span class="metric-value">~150ms</span>
        </div>
        <div class="metric">
          <span class="metric-label">LLM生成</span>
          <div class="metric-bar">
            <div class="metric-fill" :style="{ width: '90%' }"></div>
          </div>
          <span class="metric-value">~2000ms</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import api from '../config/api';

// 状态管理
const docTitle = ref('');
const docContent = ref('');
const queryText = ref('');
const isDragging = ref(false);
const isProcessing = ref(false);
const isQuerying = ref(false);
const currentStep = ref(-1);
const completedSteps = ref([]);
const processLogs = ref([]);
const queryResult = ref(null);
const answerExpanded = ref(false);

// 查询配置
const useSemanticSearch = ref(true);
const useBM25 = ref(true);
const useRRF = ref(true);
const topK = ref(5);

// 技术栈配置
const techStack = [
  { icon: '🔗', name: 'LangChain', desc: '文档处理框架' },
  { icon: '🤗', name: 'HuggingFace', desc: 'Embedding生成' },
  { icon: '🗄️', name: 'MongoDB', desc: '文档存储' },
  { icon: '🔍', name: 'Hybrid Search', desc: '混合检索' },
  { icon: '🎯', name: 'RRF', desc: '结果融合' },
  { icon: '🧠', name: 'DeepSeek', desc: 'LLM生成' }
];

// Pipeline步骤
const pipelineSteps = [
  { icon: '📄', name: '文档输入', tech: 'File/Text' },
  { icon: '✂️', name: '智能分块', tech: 'LangChain' },
  { icon: '🔢', name: '向量化', tech: 'HuggingFace' },
  { icon: '💾', name: '存储', tech: 'MongoDB + Vector' },
  { icon: '🔍', name: '混合检索', tech: 'Semantic + BM25' },
  { icon: '🎯', name: 'RRF融合', tech: 'Reciprocal Rank' },
  { icon: '🧠', name: 'LLM生成', tech: 'DeepSeek' }
];

// 计算属性
const canProcess = computed(() => {
  return docContent.value.trim().length > 0;
});

// 过滤出有效的检索结果（匹配度大于0）
const validSources = computed(() => {
  if (!queryResult.value || !queryResult.value.sources) return [];
  
  return queryResult.value.sources
    .filter(source => source.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(source => ({
      ...source,
      expanded: false  // 添加展开状态
    }));
});

// 切换文档展开状态
const toggleExpand = (source) => {
  source.expanded = !source.expanded;
};

// 文件处理
const handleDrop = (e) => {
  e.preventDefault();
  isDragging.value = false;
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
};

const handleFileSelect = (e) => {
  const files = e.target.files;
  if (files.length > 0) {
    handleFile(files[0]);
  }
};

const handleFile = async (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    docContent.value = e.target.result;
    docTitle.value = file.name;
    addLog('success', '📁', `文件 "${file.name}" 已加载`);
  };
  reader.readAsText(file);
};

// 文档处理
const processDocument = async () => {
  if (!canProcess.value || isProcessing.value) return;
  
  isProcessing.value = true;
  processLogs.value = [];
  completedSteps.value = [];
  
  try {
    // 模拟Pipeline执行
    await simulatePipelineExecution();
    
    // 调用后端API
    const response = await api.processWithRAG(docContent.value, docTitle.value);
    
    addLog('success', '✅', `文档处理完成！生成了 ${response.chunks} 个文档块`);
    
  } catch (error) {
    addLog('error', '❌', `处理失败: ${error.message}`);
  } finally {
    isProcessing.value = false;
    currentStep.value = -1;
  }
};

// 模拟Pipeline执行
const simulatePipelineExecution = async () => {
  const steps = [
    { msg: '正在读取文档...', time: 300 },
    { msg: '使用LangChain进行智能文本分块...', time: 500 },
    { msg: '调用HuggingFace生成文本向量...', time: 800 },
    { msg: '存储到MongoDB数据库...', time: 400 },
    { msg: '创建向量索引...', time: 300 },
    { msg: '优化检索策略...', time: 200 }
  ];
  
  for (let i = 0; i < steps.length; i++) {
    currentStep.value = i;
    addLog('info', '⚙️', steps[i].msg);
    await new Promise(resolve => setTimeout(resolve, steps[i].time));
    completedSteps.value.push(i);
  }
};

// 执行RAG查询
const executeRAGQuery = async () => {
  if (!queryText.value || isQuerying.value) return;
  
  isQuerying.value = true;
  queryResult.value = null;
  answerExpanded.value = false;
  
  try {
    addLog('info', '🔍', '开始执行RAG查询...');
    
    // 调用后端API
    const response = await api.queryWithRAG(queryText.value);
    
    queryResult.value = response;
    
    addLog('success', '✅', 'RAG查询完成！');
    
  } catch (error) {
    addLog('error', '❌', `查询失败: ${error.message}`);
  } finally {
    isQuerying.value = false;
  }
};

// 添加日志
const addLog = (type, icon, message) => {
  processLogs.value.push({
    type,
    icon,
    message,
    time: new Date().toLocaleTimeString()
  });
  
  // 保持最新的10条日志
  if (processLogs.value.length > 10) {
    processLogs.value.shift();
  }
};

// 获取分数颜色
const getScoreColor = (score) => {
  if (score > 0.8) return 'linear-gradient(135deg, #48bb78, #38a169)';
  if (score > 0.6) return 'linear-gradient(135deg, #4299e1, #3182ce)';
  if (score > 0.4) return 'linear-gradient(135deg, #ed8936, #dd6b20)';
  return 'linear-gradient(135deg, #fc8181, #f56565)';
};
</script>

<style scoped>
.rag-console {
  padding: 0;
  max-width: 1400px;
  margin: 0 auto;
}

/* 头部样式 */
.console-header {
  text-align: center;
  margin-bottom: 2rem;
}

.console-header h2 {
  color: #1a202c;
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.console-header p {
  color: #718096;
}

/* 技术栈展示 */
.tech-stack-showcase {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.tech-card {
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
}

.tech-card:hover {
  transform: translateY(-4px);
  border-color: #667eea;
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.2);
}

.tech-icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.tech-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.25rem;
}

.tech-desc {
  font-size: 0.875rem;
  color: #718096;
}

/* Pipeline流程图 */
.pipeline-flow {
  background: linear-gradient(135deg, #667eea05, #764ba205);
  border: 2px solid #667eea20;
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  margin-top: 2rem;
}

.pipeline-flow h3 {
  color: #2d3748;
  margin-bottom: 1.5rem;
}

.flow-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  overflow-x: auto;
  padding: 1rem 0;
}

.flow-step {
  flex: 1;
  min-width: 120px;
  text-align: center;
  position: relative;
  padding: 1rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  margin: 0 0.5rem;
  transition: all 0.3s;
}

.flow-step.active {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea10, #764ba210);
  transform: scale(1.05);
}

.flow-step.completed {
  border-color: #48bb78;
  background: #c6f6d510;
}

.step-number {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #667eea;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
}

.step-icon {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.step-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.step-tech {
  font-size: 0.75rem;
  color: #718096;
}

.step-arrow {
  position: absolute;
  right: -1.5rem;
  top: 50%;
  transform: translateY(-50%);
  color: #667eea;
  font-size: 1.5rem;
}

/* 功能卡片 */
.function-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.function-card h3 {
  color: #2d3748;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e2e8f0;
}

/* 文档处理容器 */
.doc-process-container {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 2rem;
}

@media (max-width: 1024px) {
  .doc-process-container {
    grid-template-columns: 1fr;
  }
}

/* 文件上传区 */
.upload-area {
  border: 2px dashed #cbd5e0;
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  transition: all 0.3s;
  cursor: pointer;
  height: fit-content;
}

.upload-area:hover,
.upload-area.dragging {
  border-color: #667eea;
  background: #f7fafc;
}

.upload-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.file-types {
  font-size: 0.875rem;
  color: #718096;
  margin-top: 0.5rem;
}

/* 文本输入区 */
.text-input-area {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.doc-title-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
}

.doc-content-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: inherit;
  resize: vertical;
  flex: 1;
}

/* 按钮样式 */
.process-btn,
.query-btn {
  padding: 1rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.process-btn:hover:not(:disabled),
.query-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
}

.process-btn:disabled,
.query-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 处理日志 */
.process-logs {
  grid-column: 1 / -1;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}

.process-logs h4 {
  color: #4a5568;
  margin-bottom: 1rem;
}

.log-container {
  max-height: 200px;
  overflow-y: auto;
  background: #f7fafc;
  border-radius: 8px;
  padding: 0.75rem;
}

.log-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  margin-bottom: 0.5rem;
  background: white;
  border-radius: 6px;
  font-size: 0.875rem;
}

.log-item.success {
  border-left: 3px solid #48bb78;
}

.log-item.error {
  border-left: 3px solid #f56565;
}

.log-item.info {
  border-left: 3px solid #4299e1;
}

.log-time {
  color: #718096;
  font-size: 0.75rem;
}

.log-icon {
  font-size: 1rem;
}

.log-message {
  flex: 1;
  color: #2d3748;
}

/* 查询区域 */
.query-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.query-input-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.query-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-family: inherit;
  resize: vertical;
}

.query-config {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.config-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

.config-item input[type="number"] {
  width: 50px;
  padding: 0.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

/* 查询结果 */
.query-result {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* Pipeline执行详情 - 横向显示 */
.pipeline-details {
  background: #f7fafc;
  border-radius: 12px;
  padding: 1.5rem;
}

.pipeline-details h4 {
  color: #2d3748;
  margin-bottom: 1rem;
}

.execution-steps-horizontal {
  display: flex;
  justify-content: space-between;
  align-items: center;
  overflow-x: auto;
  padding: 1rem 0;
  gap: 1rem;
}

.exec-step-h {
  flex: 1;
  min-width: 120px;
  text-align: center;
  position: relative;
  padding: 1rem;
  background: white;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  transition: all 0.3s;
}

.exec-step-h:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2);
}

.exec-step-number {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: #48bb78;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
}

.exec-name {
  font-weight: 600;
  color: #2d3748;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}

.exec-time {
  color: #48bb78;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.exec-tech {
  color: #667eea;
  font-size: 0.75rem;
}

.exec-arrow {
  position: absolute;
  right: -1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #cbd5e0;
  font-size: 1.25rem;
}

/* 检索结果 - 网格显示 */
.retrieval-results {
  background: #f7fafc;
  border-radius: 12px;
  padding: 1.5rem;
}

.retrieval-results h4 {
  color: #2d3748;
  margin-bottom: 1rem;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

@media (min-width: 1200px) {
  .source-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.source-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  transition: all 0.3s;
}

.source-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.source-rank {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.75rem;
}

.source-score {
  padding: 0.25rem 0.75rem;
  color: white;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.source-title {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.source-content-preview {
  color: #4a5568;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  line-height: 1.5;
  flex: 1;
}

.source-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.75rem;
  border-top: 1px solid #e2e8f0;
}

.expand-btn {
  padding: 0.25rem 0.75rem;
  background: #edf2f7;
  color: #4a5568;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s;
}

.expand-btn:hover {
  background: #667eea;
  color: white;
}

.source-type {
  padding: 0.25rem 0.5rem;
  background: #edf2f7;
  color: #4a5568;
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
}

/* 最终答案 */
.final-answer {
  background: linear-gradient(135deg, #667eea05, #764ba205);
  border: 2px solid #667eea20;
  border-radius: 12px;
  padding: 1.5rem;
}

.final-answer h4 {
  color: #2d3748;
  margin-bottom: 1rem;
}

.answer-content {
  color: #2d3748;
  line-height: 1.8;
  margin-bottom: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
}

.answer-preview,
.answer-full {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.answer-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.answer-stats {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  color: #718096;
  font-size: 0.875rem;
}

/* 性能监控 */
.performance-monitor {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
}

.performance-monitor h3 {
  color: #2d3748;
  margin-bottom: 1.5rem;
}

.perf-metrics {
  display: grid;
  gap: 1.5rem;
}

.metric {
  display: grid;
  grid-template-columns: 150px 1fr 80px;
  align-items: center;
  gap: 1rem;
}

.metric-label {
  color: #4a5568;
  font-size: 0.875rem;
}

.metric-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.metric-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  transition: width 1s ease;
}

.metric-value {
  color: #2d3748;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: right;
}

/* 响应式 */
@media (max-width: 768px) {
  .tech-stack-showcase {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .flow-container,
  .execution-steps-horizontal {
    flex-direction: column;
  }
  
  .flow-step,
  .exec-step-h {
    margin: 0.5rem 0;
  }
  
  .step-arrow,
  .exec-arrow {
    display: none;
  }
  
  .source-grid {
    grid-template-columns: 1fr;
  }
}
</style>