<template>
  <div class="rag-console">
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
            <!-- <div class="enhancement-notice">
              <span class="enhancement-badge">🚀 已升级</span>
              <span>现在使用与智能问答相同的专业Prompt工程，答案质量显著提升！</span>
            </div> -->
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

          <!-- 检索结果（修改为列表显示） -->
          <div class="retrieval-results" v-if="validSources.length > 0">
            <h4>📚 检索结果 ({{ validSources.length }} 个相关文档)</h4>
            <div class="source-list">
              <div v-for="(source, index) in validSources" :key="index" 
                   class="source-item">
                <div class="source-header">
                  <div class="source-title-area">
                    <span class="source-rank">#{{ index + 1 }}</span>
                    <h5 class="source-title">{{ source.title || `文档片段 ${index + 1}` }}</h5>
                  </div>
                  <div class="source-actions">
                    <span class="source-score" :style="{ background: getScoreColor(source.score) }">
                      {{ (source.score * 100).toFixed(1) }}%
                    </span>
                    <button @click="viewSourceDetail(source, index)" class="view-detail-btn">
                      查看全部
                    </button>
                  </div>
                </div>
                
                <div class="source-content-preview">
                  <p>{{ source.content.substring(0, 200) }}{{ source.content.length > 200 ? '...' : '' }}</p>
                </div>
                
                <div class="source-footer">
                  <span class="source-type">{{ source.type }}</span>
                  <span class="source-length">{{ source.content.length }} 字符</span>
                  <span v-if="source.chunkIndex !== undefined" class="chunk-info">
                    第 {{ source.chunkIndex + 1 }} 个片段
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 最终答案 -->
          <div class="final-answer">
            <h4>💡 生成的答案</h4>
            <div class="answer-quality-notice">
              <span class="quality-badge">⭐ 专业级</span>
              <span>采用与智能问答相同的Prompt工程，确保答案质量</span>
            </div>
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
                <span>🧠 模型: DeepSeek + 专业Prompt</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 性能监控 -->
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

    <!-- 性能评估模块 -->
    <div class="evaluation-section">
      <h3>📊 系统性能评估</h3>
      <p class="eval-description">运行标准测试集，评估RAG系统的检索准确率、召回率等关键指标</p>
      
      <!-- 评估控制 -->
      <div class="eval-controls">
        <button @click="runEvaluation" 
                :disabled="isEvaluating"
                class="eval-btn">
          <span v-if="!isEvaluating">🧪 运行性能评估</span>
          <span v-else>⏳ 评估中...</span>
        </button>
        
        <button @click="rebuildRagIndex" 
                :disabled="isRebuilding"
                class="rebuild-btn">
          <span v-if="!isRebuilding">🧹 清理重建索引</span>
          <span v-else>⏳ 重建中...</span>
        </button>
        
        <div v-if="evaluationResult" class="eval-actions">
          <button @click="toggleEvaluationDetails" class="details-btn">
            {{ showEvaluationDetails ? '隐藏详情' : '查看详情' }}
          </button>
        </div>
      </div>

      <!-- 评估结果 -->
      <div v-if="evaluationResult" class="eval-results">
        <div class="eval-summary">
          <h4>📈 评估摘要</h4>
          <div class="summary-grid">
            <div class="summary-item overall">
              <span class="summary-label">综合得分</span>
              <span class="summary-value highlight">{{ evaluationResult.executive_summary.overallScore }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">召回率</span>
              <span class="summary-value">{{ evaluationResult.executive_summary.keyMetrics.recallRate }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">准确率</span>
              <span class="summary-value">{{ evaluationResult.executive_summary.keyMetrics.accuracyRate }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">混合检索提升</span>
              <span class="summary-value success">{{ evaluationResult.executive_summary.keyMetrics.hybridImprovement }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">平均响应时间</span>
              <span class="summary-value">{{ evaluationResult.executive_summary.keyMetrics.avgResponseTime }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">成功率</span>
              <span class="summary-value">{{ evaluationResult.executive_summary.keyMetrics.successRate }}</span>
            </div>
          </div>
        </div>

        <!-- 优势和改进建议 -->
        <div class="eval-insights">
          <div v-if="evaluationResult.executive_summary.strengths.length > 0" class="insights-section">
            <h5>✅ 系统优势</h5>
            <ul class="insights-list">
              <li v-for="strength in evaluationResult.executive_summary.strengths" :key="strength">
                {{ strength }}
              </li>
            </ul>
          </div>
          
          <div v-if="evaluationResult.executive_summary.improvements.length > 0" class="insights-section">
            <h5>💡 改进建议</h5>
            <ul class="insights-list">
              <li v-for="improvement in evaluationResult.executive_summary.improvements" :key="improvement">
                {{ improvement }}
              </li>
            </ul>
          </div>
        </div>

        <!-- 详细评估结果 -->
        <div v-if="showEvaluationDetails" class="eval-details">
          <h4>🔍 详细评估数据</h4>
          
          <!-- 检索性能详情 -->
          <div class="detail-section">
            <h5>检索性能</h5>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">测试查询数</span>
                <span class="detail-value">{{ evaluationResult.detailed_metrics.retrieval?.totalQueries || 0 }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">平均F1分数</span>
                <span class="detail-value">{{ ((evaluationResult.detailed_metrics.retrieval?.avgF1Score || 0) * 100).toFixed(1) }}%</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">平均检索时间</span>
                <span class="detail-value">{{ (evaluationResult.detailed_metrics.retrieval?.avgResponseTime || 0).toFixed(0) }}ms</span>
              </div>
            </div>
          </div>

          <!-- 生成质量详情 -->
          <div class="detail-section">
            <h5>生成质量</h5>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">测试问题数</span>
                <span class="detail-value">{{ evaluationResult.detailed_metrics.generation?.totalQuestions || 0 }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">平均连贯性</span>
                <span class="detail-value">{{ ((evaluationResult.detailed_metrics.generation?.avgCoherenceScore || 0) * 100).toFixed(1) }}%</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">平均完整性</span>
                <span class="detail-value">{{ ((evaluationResult.detailed_metrics.generation?.avgCompletenessScore || 0) * 100).toFixed(1) }}%</span>
              </div>
            </div>
          </div>

          <!-- 评估方法说明 -->
          <div class="methodology-section">
            <h5>📚 评估方法</h5>
            <div class="methodology-content">
              <p><strong>测试数据集规模：</strong>{{ evaluationResult.methodology?.test_dataset_size || 0 }} 个测试用例</p>
              <div class="method-list">
                <div v-for="method in evaluationResult.methodology?.evaluation_methods || []" :key="method" class="method-item">
                  • {{ method }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 文档详情查看模态框 -->
    <div v-if="showSourceModal" class="modal-overlay" @click="closeSourceModal">
      <div class="modal-container large" @click.stop>
        <div class="modal-header">
          <h3>📄 文档详情</h3>
          <button @click="closeSourceModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="source-detail">
            <div class="source-detail-header">
              <h4>{{ currentSourceDetail.title || '未命名文档' }}</h4>
              <div class="source-badges">
                <span class="rank-badge">#{{ currentSourceDetail.rank }}</span>
                <span class="score-badge" :style="{ background: getScoreColor(currentSourceDetail.score) }">
                  {{ (currentSourceDetail.score * 100).toFixed(1) }}% 匹配
                </span>
                <span class="type-badge">{{ currentSourceDetail.type }}</span>
              </div>
            </div>
            
            <div class="source-content-full">
              {{ currentSourceDetail.content }}
            </div>
            
            <div class="source-meta-info">
              <div class="meta-row">
                <span class="meta-label">内容长度：</span>
                <span class="meta-value">{{ currentSourceDetail.content.length }} 字符</span>
              </div>
              <div v-if="currentSourceDetail.chunkIndex !== undefined" class="meta-row">
                <span class="meta-label">文档片段：</span>
                <span class="meta-value">第 {{ currentSourceDetail.chunkIndex + 1 }} 个片段</span>
              </div>
              <div v-if="currentSourceDetail.fusion_details" class="meta-row">
                <span class="meta-label">融合详情：</span>
                <span class="meta-value">
                  语义: {{ (currentSourceDetail.fusion_details.semantic_rrfScore || 0).toFixed(4) }}, 
                  BM25: {{ (currentSourceDetail.fusion_details.bm25_rrfScore || 0).toFixed(4) }}, 
                  总分: {{ (currentSourceDetail.fusion_details.total_rrfScore || 0).toFixed(4) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeSourceModal" class="btn btn-secondary">
            关闭
          </button>
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

// 文档详情模态框
const showSourceModal = ref(false);
const currentSourceDetail = ref({});

// 评估相关状态
const isEvaluating = ref(false);
const evaluationResult = ref(null);
const showEvaluationDetails = ref(false);
const isRebuilding = ref(false);

// 查询配置
const useSemanticSearch = ref(true);
const useBM25 = ref(true);
const useRRF = ref(true);
const topK = ref(5);

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
    .sort((a, b) => b.score - a.score);
});

// 查看文档详情
const viewSourceDetail = (source, index) => {
  currentSourceDetail.value = {
    ...source,
    rank: index + 1
  };
  showSourceModal.value = true;
};

// 关闭文档详情模态框
const closeSourceModal = () => {
  showSourceModal.value = false;
  currentSourceDetail.value = {};
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
    
    addLog('success', '✅', `文档处理完成：生成了 ${response.chunks} 个文档块`);
    
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

// 运行性能评估
const runEvaluation = async () => {
  if (isEvaluating.value) return;
  
  isEvaluating.value = true;
  evaluationResult.value = null;
  showEvaluationDetails.value = false;
  
  try {
    addLog('info', '🧪', '开始运行性能评估...');
    
    const startTime = Date.now();
    const result = await api.runEvaluation();
    const duration = Date.now() - startTime;
    
    evaluationResult.value = result;
    
    addLog('success', '📊', `评估完成! 综合得分: ${result.executive_summary.overallScore}, 耗时: ${duration}ms`);
    
  } catch (error) {
    addLog('error', '❌', `评估失败: ${error.message}`);
    console.error('性能评估失败:', error);
  } finally {
    isEvaluating.value = false;
  }
};

// 重建RAG索引
const rebuildRagIndex = async () => {
  if (isRebuilding.value) return;
  
  if (!confirm('确定要清理并重建所有RAG索引吗？\n\n这将：\n1. 清空当前向量存储\n2. 重新处理所有笔记\n3. 解决重复索引问题\n\n此操作可能需要几分钟时间。')) {
    return;
  }
  
  isRebuilding.value = true;
  
  try {
    addLog('info', '🧹', '开始清理并重建RAG索引...');
    
    const startTime = Date.now();
    const result = await api.rebuildRagIndex();
    const duration = Date.now() - startTime;
    
    addLog('success', '✅', `索引重建完成! 处理了 ${result.statistics.success_count}/${result.statistics.total_notes} 条笔记, 耗时: ${duration}ms`);
    
    // 如果有查询结果，清空它以避免显示旧数据
    queryResult.value = null;
    
    alert(`RAG索引重建完成！\n\n📊 统计信息：\n• 总笔记数：${result.statistics.total_notes}\n• 成功处理：${result.statistics.success_count}\n• 失败数量：${result.statistics.failed_count}\n• 当前向量数：${result.statistics.current_stats.totalChunks}\n\n现在重复索引问题已解决！`);
    
  } catch (error) {
    addLog('error', '❌', `索引重建失败: ${error.message}`);
    alert('重建失败: ' + error.message);
  } finally {
    isRebuilding.value = false;
  }
};

// 切换评估详情显示
const toggleEvaluationDetails = () => {
  showEvaluationDetails.value = !showEvaluationDetails.value;
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

.enhancement-notice {
  background: linear-gradient(135deg, #48bb7815, #38a16915);
  border: 1px solid #48bb7830;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.enhancement-badge {
  background: linear-gradient(135deg, #48bb78, #38a169);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
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

/* 检索结果 - 修改为列表显示 */
.retrieval-results {
  background: #f7fafc;
  border-radius: 12px;
  padding: 1.5rem;
}

.retrieval-results h4 {
  color: #2d3748;
  margin-bottom: 1rem;
}

.source-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.source-item {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.3s;
}

.source-item:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.source-title-area {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.source-rank {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.75rem;
  min-width: 40px;
  text-align: center;
}

.source-title {
  font-weight: 600;
  color: #2d3748;
  margin: 0;
  font-size: 1rem;
}

.source-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.source-score {
  padding: 0.25rem 0.75rem;
  color: white;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.view-detail-btn {
  padding: 0.25rem 0.75rem;
  background: #edf2f7;
  color: #4a5568;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s;
}

.view-detail-btn:hover {
  background: #667eea;
  color: white;
}

.source-content-preview {
  color: #4a5568;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  line-height: 1.5;
}

.source-footer {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e2e8f0;
  font-size: 0.75rem;
  color: #718096;
}

.source-type {
  padding: 0.25rem 0.5rem;
  background: #edf2f7;
  color: #4a5568;
  border-radius: 4px;
  text-transform: uppercase;
}

.source-length,
.chunk-info {
  color: #718096;
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

.answer-quality-notice {
  background: linear-gradient(135deg, #f6ad5515, #ed893615);
  border: 1px solid #f6ad5530;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.quality-badge {
  background: linear-gradient(135deg, #f6ad55, #ed8936);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
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
  margin-bottom: 2rem;
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

/* 性能评估样式 */
.evaluation-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.5rem;
}

.evaluation-section h3 {
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.eval-description {
  color: #718096;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.eval-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 2rem;
}

.eval-btn {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.eval-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
}

.eval-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.rebuild-btn {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #f6ad55, #ed8936);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.rebuild-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(246, 173, 85, 0.3);
}

.rebuild-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.details-btn {
  padding: 0.5rem 1rem;
  background: #edf2f7;
  color: #4a5568;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s;
}

.details-btn:hover {
  background: #667eea;
  color: white;
}

.eval-results {
  background: #f7fafc;
  border-radius: 12px;
  padding: 1.5rem;
  border: 2px solid #e2e8f0;
}

.eval-summary h4 {
  color: #2d3748;
  margin-bottom: 1rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-item {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #e2e8f0;
  transition: all 0.3s;
}

.summary-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.summary-item.overall {
  border: 2px solid #667eea;
  background: linear-gradient(135deg, #667eea05, #764ba205);
}

.summary-label {
  display: block;
  color: #718096;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.summary-value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: #2d3748;
}

.summary-value.highlight {
  color: #667eea;
  font-size: 2rem;
}

.summary-value.success {
  color: #48bb78;
}

.eval-insights {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.insights-section {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.insights-section h5 {
  color: #2d3748;
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.insights-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.insights-list li {
  color: #4a5568;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  padding-left: 1rem;
  position: relative;
}

.insights-list li:before {
  content: '•';
  color: #667eea;
  font-weight: bold;
  position: absolute;
  left: 0;
}

.eval-details {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #e2e8f0;
  margin-top: 1.5rem;
}

.eval-details h4 {
  color: #2d3748;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #e2e8f0;
}

.detail-section {
  margin-bottom: 1.5rem;
}

.detail-section h5 {
  color: #4a5568;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.detail-item {
  background: #f7fafc;
  padding: 0.75rem;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  text-align: center;
}

.detail-label {
  display: block;
  color: #718096;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
}

.detail-value {
  display: block;
  color: #2d3748;
  font-size: 1.2rem;
  font-weight: 600;
}

.methodology-section {
  background: #f7fafc;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}

.methodology-section h5 {
  color: #4a5568;
  margin-bottom: 0.75rem;
}

.methodology-content p {
  color: #4a5568;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.method-item {
  color: #4a5568;
  font-size: 0.875rem;
  padding-left: 0.5rem;
}

/* 文档详情模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-container.large {
  max-width: 800px;
  max-height: 90vh;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
}

.modal-header h3 {
  color: #2d3748;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #718096;
  padding: 0.25rem;
  transition: color 0.3s;
}

.close-btn:hover {
  color: #e53e3e;
}

.modal-body {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  background: #f8f9fa;
}

/* 文档详情样式 */
.source-detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.source-detail-header {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
}

.source-detail-header h4 {
  color: #2d3748;
  margin: 0;
  font-size: 1.25rem;
}

.source-badges {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.rank-badge {
  background: #667eea;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.75rem;
}

.score-badge {
  padding: 0.25rem 0.75rem;
  color: white;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.type-badge {
  padding: 0.25rem 0.5rem;
  background: #edf2f7;
  color: #4a5568;
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.source-content-full {
  background: #f7fafc;
  padding: 1.5rem;
  border-radius: 8px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #2d3748;
  border: 1px solid #e2e8f0;
  max-height: 400px;
  overflow-y: auto;
}

.source-meta-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meta-row {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.meta-label {
  font-weight: 500;
  color: #4a5568;
  min-width: 80px;
}

.meta-value {
  color: #2d3748;
}

/* 按钮样式 */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.btn-secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-secondary:hover {
  background: #cbd5e0;
}

/* 响应式 */
@media (max-width: 768px) {
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
  
  .modal-container {
    max-width: 95%;
    max-height: 95vh;
  }
  
  .source-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .source-actions {
    align-self: flex-end;
  }
}
</style>