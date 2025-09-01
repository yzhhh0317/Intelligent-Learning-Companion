<template>
  <div class="rag-console">
    <!-- Pipeline流程图 -->
    <div class="pipeline-flow">
      <h3>RAG Pipeline 架构</h3>
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

    <!-- 文档处理区 -->
    <div class="function-card">
      <h3>文档处理</h3>
      
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
            <div class="upload-icon">FILE</div>
            <p>拖拽3GPP标准、IEEE论文到这里或点击上传</p>
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
            <span v-if="!isProcessing">使用混合分块方式处理文档</span>
            <span v-else>处理中...</span>
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

    <!-- RAG查询区 -->
    <div class="function-card">
      <h3>RAG查询测试</h3>
      
      <!-- 查询输入 -->
      <div class="query-section">
        <div class="query-input-container">
          <textarea v-model="queryText" 
                    placeholder="输入通信技术问题，如：5G波束成形、LDPC编码、信道估计..."
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
            <span v-if="!isQuerying">执行RAG查询</span>
            <span v-else>查询中...</span>
          </button>
        </div>

        <!-- 加载时显示骨架屏 -->
        <div v-if="isQuerying" class="query-result">
          <SkeletonLoader type="rag" />
        </div>

        <!-- 查询结果 -->
        <div v-else-if="queryResult" class="query-result">
          <!-- Pipeline执行详情 -->
          <div class="pipeline-details">
            <h4>Pipeline执行流程</h4>
            <div class="execution-steps-horizontal" v-if="queryResult.pipeline && queryResult.pipeline.steps">
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

          <!-- 检索结果 -->
          <div class="retrieval-results" v-if="validSources.length > 0">
            <h4>检索结果 ({{ validSources.length }} 个相关文档)</h4>
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
            <h4>生成的答案</h4>
            <div class="answer-quality-notice">
              <span class="quality-badge">专业级</span>
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
                <span>总耗时: {{ queryResult.totalTime }}</span>
                <span>使用文档: {{ validSources.length }}</span>
                <span>模型: DeepSeek + 专业Prompt</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 性能监控
    <div class="performance-monitor">
      <h3>性能监控</h3>
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
    </div> -->

    <!-- 核心性能评估模块 -->
    <div class="evaluation-section">
      <h3>RAG核心性能评估</h3>
      <p class="eval-description">运行标准测试集，评估RAG系统的检索准确率、生成质量等关键指标</p>
      
      <!-- 数据集信息 -->
      <div v-if="datasetInfo" class="dataset-info">
        <h4>评估数据集信息</h4>
        <p>{{ datasetInfo.description }}</p>
        <div class="dataset-stats">
          <div class="stat-item">
            <span class="stat-label">总问题数</span>
            <span class="stat-value">{{ datasetInfo.total_questions }}</span>
          </div>
          <div class="stat-item" v-for="(count, category) in datasetInfo.categories" :key="category">
            <span class="stat-label">{{ getCategoryName(category) }}</span>
            <span class="stat-value">{{ count }}</span>
          </div>
        </div>
      </div>
      
      <!-- 评估控制 -->
      <div class="eval-controls">
        <button @click="runQuickEvaluation" 
                :disabled="isRunningQuickEval"
                class="eval-btn quick">
          <span v-if="!isRunningQuickEval">快速评估(10样本)</span>
          <span v-else>快速评估中...</span>
        </button>

        <button @click="runDetailedEvaluation" 
                :disabled="isRunningDetailedEval"
                class="eval-btn detailed">
          <span v-if="!isRunningDetailedEval">详细评估(80样本)</span>
          <span v-else>详细评估中...</span>
        </button>
        
        <button @click="runMethodComparison" 
                :disabled="isRunningMethodComparison"
                class="eval-btn comparison">
          <span v-if="!isRunningMethodComparison">检索方法对比</span>
          <span v-else>对比评估中...</span>
        </button>
        
        <button @click="rebuildRagIndex" 
                :disabled="isRebuilding"
                class="rebuild-btn">
          <span v-if="!isRebuilding">清理重建索引</span>
          <span v-else>重建中...</span>
        </button>
      </div>

      <!-- 快速评估结果显示 -->
      <div v-if="quickEvaluationResult" class="quick-eval-results">
        <h4>快速评估结果</h4>
        <div class="quick-metrics">
          <div class="metric-card">
            <div class="metric-title">检索性能</div>
            <div class="metric-value">{{ (quickEvaluationResult.retrieval.precision_at_5 * 100).toFixed(1) }}%</div>
            <div class="metric-label">精确率@5</div>
          </div>
          <div class="metric-card">
            <div class="metric-title">生成质量</div>
            <div class="metric-value">{{ (quickEvaluationResult.generation.concept_coverage * 100).toFixed(1) }}%</div>
            <div class="metric-label">概念覆盖率</div>
          </div>
          <div class="metric-card highlight">
            <div class="metric-title">综合得分</div>
            <div class="metric-value">{{ quickEvaluationResult.overall_score.toFixed(1) }}%</div>
            <div class="metric-label">总评分</div>
          </div>
        </div>
      </div>

      <!-- 详细评估结果显示 -->
      <div v-if="detailedEvaluationResult" class="detailed-eval-results">
        <h4>详细评估结果</h4>

        <!-- 添加样本信息显示 -->
        <div class="sample-info">
          <p><strong>样本配置：</strong></p>
          <p>• 检索评估：{{ detailedEvaluationResult.dataset_info.sample_size }} 个样本</p>
          <p>• 生成评估：{{ detailedEvaluationResult.dataset_info.sample_size }} 个样本</p>
          <p>• 方法对比：{{ detailedEvaluationResult.dataset_info.comparison_sample_size }} 个样本</p>
          <p class="highlight">✓ 所有评估使用配对样本，结果可直接对比</p>
        </div>
        
        <!-- 评估摘要 -->
        <div class="eval-summary-cards">
          <div class="summary-card">
            <div class="card-header">检索评估</div>
            <div class="card-metrics">
              <div class="card-metric">
                <span class="metric-label">精确率@5</span>
                <span class="metric-value">{{ evaluationMetrics?.retrieval.precision_at_5 }}%</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">召回率</span>
                <span class="metric-value">{{ evaluationMetrics?.retrieval.recall }}%</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">平均倒数排名</span>
                <span class="metric-value">{{ evaluationMetrics?.retrieval.mrr }}</span>
              </div>
            </div>
          </div>
          
          <div class="summary-card">
            <div class="card-header">生成评估</div>
            <div class="card-metrics">
              <div class="card-metric">
                <span class="metric-label">概念覆盖</span>
                <span class="metric-value">{{ evaluationMetrics?.generation.concept_coverage }}%</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">关键词准确</span>
                <span class="metric-value">{{ evaluationMetrics?.generation.keyword_accuracy }}%</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">答案相关性</span>
                <span class="metric-value">{{ evaluationMetrics?.generation.answer_relevance }}%</span>
              </div>
            </div>
          </div>
          
          <div class="summary-card highlight">
            <div class="card-header">综合结果</div>
            <div class="card-metrics">
              <div class="card-metric">
                <span class="metric-label">综合得分</span>
                <span class="metric-value large">{{ evaluationMetrics?.overall.score }}%</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">样本数量</span>
                <span class="metric-value">{{ evaluationMetrics?.overall.sample_size }}</span>
              </div>
              <div class="card-metric">
                <span class="metric-label">评估耗时</span>
                <span class="metric-value">{{ evaluationMetrics?.overall.evaluation_time }}s</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 关键发现和改进建议 -->
        <div v-if="detailedEvaluationResult.summary.key_findings && detailedEvaluationResult.summary.key_findings.length > 0" class="key-findings">
          <h5>关键发现</h5>
          <ul>
            <li v-for="finding in detailedEvaluationResult.summary.key_findings" :key="finding">
              {{ finding }}
            </li>
          </ul>
        </div>
        
        <div v-if="improvementData" class="improvement-highlights">
          <h5>混合检索性能提升</h5>
          <div class="improvement-stats">
            <div class="improvement-item">
              <span class="improvement-label">相比纯语义检索</span>
              <span class="improvement-value success">+{{ improvementData.vs_semantic }}%</span>
            </div>
            <div class="improvement-item">
              <span class="improvement-label">相比纯BM25检索</span>
              <span class="improvement-value success">+{{ improvementData.vs_bm25 }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 方法对比结果显示 -->
      <div v-if="methodComparisonResult" class="method-comparison-results">
        <h4>检索方法对比结果</h4>
        <div class="comparison-metrics">
          <div class="method-card" v-for="(method, key) in methodComparisonResult.results" :key="key">
            <div class="method-name">{{ getMethodDisplayName(key) }}</div>
            <div class="method-stats">
              <div class="method-stat">
                <span class="stat-label">精确率</span>
                <span class="stat-value">{{ (method.precision * 100).toFixed(1) }}%</span>
              </div>
              <div class="method-stat">
                <span class="stat-label">召回率</span>
                <span class="stat-value">{{ (method.recall * 100).toFixed(1) }}%</span>
              </div>
              <div class="method-stat">
                <span class="stat-label">平均耗时</span>
                <span class="stat-value">{{ method.time.toFixed(0) }}ms</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="comparison-insights">
          <h5>性能对比分析</h5>
          <div class="insight-grid">
            <div class="insight-item">
              <span class="insight-label">vs 语义检索</span>
              <span class="insight-value positive">+{{ methodComparisonResult.improvements.precision_vs_semantic.toFixed(1) }}%</span>
            </div>
            <div class="insight-item">
              <span class="insight-label">vs BM25检索</span>
              <span class="insight-value positive">+{{ methodComparisonResult.improvements.precision_vs_bm25.toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 文档详情查看模态框 -->
    <div v-if="showSourceModal" class="modal-overlay" @click="closeSourceModal">
      <div class="modal-container large" @click.stop>
        <div class="modal-header">
          <h3>文档详情</h3>
          <button @click="closeSourceModal" class="close-btn">×</button>
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
import { ref, computed, onMounted } from 'vue';
import api from '../config/api';
import SkeletonLoader from './SkeletonLoader.vue';

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

// 核心评估相关状态
const detailedEvaluationResult = ref(null);
const quickEvaluationResult = ref(null);
const methodComparisonResult = ref(null);
const datasetInfo = ref(null);
const isRunningDetailedEval = ref(false);
const isRunningQuickEval = ref(false);
const isRunningMethodComparison = ref(false);
const isRebuilding = ref(false);

// 查询配置
const useSemanticSearch = ref(true);
const useBM25 = ref(true);
const useRRF = ref(true);
const topK = ref(5);

// Pipeline步骤
const pipelineSteps = [
  { icon: '📄', name: '文档输入', tech: 'File/Text' },
  { icon: '✂️', name: '混合分块', tech: 'Heading + 窗口' },
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

// 在evaluationResult的显示计算属性中添加
const evaluationMetrics = computed(() => {
  if (!detailedEvaluationResult.value) return null;
  
  const report = detailedEvaluationResult.value;
  return {
    retrieval: {
      precision_at_5: (report.retrieval_metrics.precision_at_5 * 100).toFixed(1),
      recall: (report.retrieval_metrics.recall * 100).toFixed(1),
      mrr: report.retrieval_metrics.mrr.toFixed(3),
      avg_response_time: report.retrieval_metrics.avg_response_time.toFixed(0)
    },
    generation: {
      concept_coverage: (report.generation_metrics.concept_coverage * 100).toFixed(1),
      keyword_accuracy: (report.generation_metrics.keyword_accuracy * 100).toFixed(1),
      answer_relevance: (report.generation_metrics.answer_relevance * 100).toFixed(1),
      avg_response_time: report.generation_metrics.avg_response_time.toFixed(0)
    },
    overall: {
      score: report.summary.overall_score.toFixed(1),
      sample_size: report.dataset_info.sample_size,
      evaluation_time: (report.evaluation_time / 1000).toFixed(2)
    }
  };
});

// 获取改进提升数据
const improvementData = computed(() => {
  if (!detailedEvaluationResult.value?.comparison_results) return null;
  
  const improvements = detailedEvaluationResult.value.comparison_results.improvements;
  return {
    vs_semantic: improvements.precision_vs_semantic.toFixed(1),
    vs_bm25: improvements.precision_vs_bm25.toFixed(1)
  };
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
    addLog('success', 'SUCCESS', `文件 "${file.name}" 已加载`);
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
    
    addLog('success', 'SUCCESS', `文档处理完成：生成了 ${response.chunks} 个文档块`);
    
  } catch (error) {
    addLog('error', 'ERROR', `处理失败: ${error.message}`);
  } finally {
    isProcessing.value = false;
    currentStep.value = -1;
  }
};

// 模拟Pipeline执行
const simulatePipelineExecution = async () => {
  const steps = [
    { msg: '正在读取文档...', time: 300 },
    { msg: '使用混合分块方式进行文本分块...', time: 500 },
    { msg: '调用HuggingFace生成文本向量...', time: 800 },
    { msg: '存储到MongoDB数据库...', time: 400 },
    { msg: '创建向量索引...', time: 300 },
    { msg: '优化检索策略...', time: 200 }
  ];
  
  for (let i = 0; i < steps.length; i++) {
    currentStep.value = i;
    addLog('info', 'INFO', steps[i].msg);
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
    addLog('info', 'INFO', '开始执行RAG查询...');
    
    // 调用后端API
    const response = await api.queryWithRAG(queryText.value);
    
    queryResult.value = response;
    
    addLog('success', 'SUCCESS', 'RAG查询完成');
    
  } catch (error) {
    addLog('error', 'ERROR', `查询失败: ${error.message}`);
  } finally {
    isQuerying.value = false;
  }
};

// 运行快速评估
const runQuickEvaluation = async () => {
  if (isRunningQuickEval.value) return;
  
  isRunningQuickEval.value = true;
  quickEvaluationResult.value = null;
  
  try {
    addLog('info', 'INFO', '开始快速评估...');
    
    const startTime = Date.now();
    const response = await api.quickEvaluation();
    const duration = Date.now() - startTime;
    
    quickEvaluationResult.value = response.quick_report;
    
    const report = response.quick_report;
    const overallScore = report.overall_score.toFixed(1);
    
    addLog('success', 'SUCCESS', `快速评估完成! 综合得分: ${overallScore}%, 耗时: ${duration}ms`);
    
  } catch (error) {
    addLog('error', 'ERROR', `快速评估失败: ${error.message}`);
    console.error('快速评估失败:', error);
  } finally {
    isRunningQuickEval.value = false;
  }
};

// 运行详细评估
const runDetailedEvaluation = async () => {
  if (isRunningDetailedEval.value) return;
  
  isRunningDetailedEval.value = true;
  detailedEvaluationResult.value = null;
  
  try {
    addLog('info', 'INFO', '开始运行详细RAG评估...');
    
    const startTime = Date.now();
    const response = await api.runCompleteRAGEvaluation(80);
    const duration = Date.now() - startTime;
    
    detailedEvaluationResult.value = response.report;
    
    // 生成评估摘要日志
    const report = response.report;
    const retrievalP5 = (report.retrieval_metrics.precision_at_5 * 100).toFixed(1);
    const generationCoverage = (report.generation_metrics.concept_coverage * 100).toFixed(1);
    const overallScore = report.summary.overall_score.toFixed(1);
    
    addLog('success', 'SUCCESS', `详细评估完成! 检索P@5: ${retrievalP5}%, 概念覆盖: ${generationCoverage}%, 综合得分: ${overallScore}%, 耗时: ${duration}ms`);
    
  } catch (error) {
    addLog('error', 'ERROR', `详细评估失败: ${error.message}`);
    console.error('详细评估失败:', error);
  } finally {
    isRunningDetailedEval.value = false;
  }
};

// 运行检索方法对比
const runMethodComparison = async () => {
  if (isRunningMethodComparison.value) return;
  
  isRunningMethodComparison.value = true;
  methodComparisonResult.value = null;
  
  try {
    addLog('info', 'INFO', '开始检索方法对比...');
    
    const startTime = Date.now();
    const response = await api.compareRetrievalMethods(20);
    const duration = Date.now() - startTime;
    
    methodComparisonResult.value = response.comparison;
    
    const improvements = response.comparison.improvements;
    
    addLog('success', 'SUCCESS', `方法对比完成! 混合检索vs语义: +${improvements.precision_vs_semantic.toFixed(1)}%, vs BM25: +${improvements.precision_vs_bm25.toFixed(1)}%, 耗时: ${duration}ms`);
    
  } catch (error) {
    addLog('error', 'ERROR', `方法对比失败: ${error.message}`);
    console.error('方法对比失败:', error);
  } finally {
    isRunningMethodComparison.value = false;
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
    addLog('info', 'INFO', '开始清理并重建RAG索引...');
    
    const startTime = Date.now();
    const result = await api.rebuildRagIndex();
    const duration = Date.now() - startTime;
    
    addLog('success', 'SUCCESS', `索引重建完成! 处理了 ${result.statistics.success_count}/${result.statistics.total_notes} 条笔记, 耗时: ${duration}ms`);
    
    // 如果有查询结果，清空它以避免显示旧数据
    queryResult.value = null;
    
    alert(`RAG索引重建完成！\n\n统计信息：\n• 总笔记数：${result.statistics.total_notes}\n• 成功处理：${result.statistics.success_count}\n• 失败数量：${result.statistics.failed_count}\n• 当前向量数：${result.statistics.current_stats.totalChunks}\n\n现在重复索引问题已解决！`);
    
  } catch (error) {
    addLog('error', 'ERROR', `索引重建失败: ${error.message}`);
    alert('重建失败: ' + error.message);
  } finally {
    isRebuilding.value = false;
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

// 获取分类显示名称
const getCategoryName = (category) => {
  const categoryNames = {
    architecture: '总体架构',
    RRC: '无限资源控制',
    QoS: '服务质量',
    functional_split: '功能分离',
    protocol_procedure: '协议流程'
  };
  return categoryNames[category] || category;
};

// 获取方法显示名称
const getMethodDisplayName = (key) => {
  const methodNames = {
    hybrid_rag: '混合检索(RRF)',
    semantic_simulation: '纯语义检索',
    bm25_simulation: '纯BM25检索'
  };
  return methodNames[key] || key;
};

// 加载数据集信息
const loadDatasetInfo = async () => {
  try {
    const response = await api.getDatasetInfo();
    datasetInfo.value = response.dataset;
    addLog('info', 'INFO', '数据集信息加载成功');
  } catch (error) {
    addLog('error', 'ERROR', `数据集信息加载失败: ${error.message}`);
  }
};

// 在组件挂载时加载数据集信息
onMounted(() => {
  loadDatasetInfo();
});
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
  font-size: 1rem;
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

.dataset-info {
  background: #f7fafc;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  border: 1px solid #e2e8f0;
}

.dataset-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.stat-item {
  text-align: center;
  padding: 0.5rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  color: #718096;
  margin-bottom: 0.25rem;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
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

.quick-eval-results {
  background: linear-gradient(135deg, #48bb7810, #38a16910);
  border: 2px solid #48bb7830;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.quick-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.metric-card {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #e2e8f0;
  transition: all 0.3s;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.metric-card.highlight {
  border: 2px solid #48bb78;
  background: linear-gradient(135deg, #48bb7805, #38a16905);
}

.metric-title {
  font-size: 0.875rem;
  color: #718096;
  margin-bottom: 0.5rem;
}

.metric-value.large {
  font-size: 2.25rem;
  color: #48bb78;
}

.metric-label {
  font-size: 1rem;
  color: #4a5568;
}

.detailed-eval-results {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.eval-summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}

.summary-card.highlight {
  border: 2px solid #667eea;
  background: linear-gradient(135deg, #667eea05, #764ba205);
}

.card-header {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.card-metrics {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.card-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.key-findings {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  margin-bottom: 1rem;
}

.key-findings h5 {
  color: #2d3748;
  margin-bottom: 0.75rem;
}

.key-findings ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.key-findings li {
  color: #4a5568;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  padding-left: 1rem;
  position: relative;
}

.key-findings li:before {
  content: 'â€¢';
  color: #667eea;
  font-weight: bold;
  position: absolute;
  left: 0;
}

.improvement-highlights {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}

.improvement-highlights h5 {
  color: #2d3748;
  margin-bottom: 0.75rem;
}

.improvement-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.improvement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f7fafc;
  border-radius: 6px;
}

.improvement-value.success {
  color: #48bb78;
  font-weight: 600;
  font-size: 1.1rem;
}

.method-comparison-results {
  background: linear-gradient(135deg, #ed893610, #dd6b2010);
  border: 2px solid #ed893630;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.comparison-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.method-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
}

.method-name {
  font-weight: 600;
  color: #2d3748;
  margin-bottom: 1rem;
  text-align: center;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.method-stats {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.method-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.comparison-insights {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  margin-top: 1rem;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.insight-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #f7fafc;
  border-radius: 6px;
}

.insight-value.positive {
  color: #48bb78;
  font-weight: 600;
  font-size: 1.1rem;
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