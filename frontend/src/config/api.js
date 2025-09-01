// src/config/api.js - 前端API配置文件（核心功能）
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

class APIService {
  constructor() {
    this.baseUrl = API_BASE_URL;
    console.log("API Base URL:", this.baseUrl);
  }

  // 统一的请求方法
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === "object") {
      config.body = JSON.stringify(config.body);
    }

    try {
      console.log(`API请求: ${config.method || "GET"} ${endpoint}`);

      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log(`API响应: ${endpoint} - 成功`);
      return data;
    } catch (error) {
      console.error(`API错误: ${endpoint} -`, error.message);
      throw error;
    }
  }

  // ============ 健康检查 ============
  async healthCheck() {
    return this.request("/api/health");
  }

  // ============ 智能问答 ============
  async askQuestion(question, useRAG = true, currentContent = "") {
    return this.request("/api/chat/ask", {
      method: "POST",
      body: {
        question,
        use_rag: useRAG,
        current_content: currentContent,
      },
    });
  }

  // ============ 内容处理 ============
  async generateSummary(content) {
    return this.request("/api/chat/summary", {
      method: "POST",
      body: { content },
    });
  }

  async generateNotes(content, title = "", tags = []) {
    return this.request("/api/chat/generate-notes", {
      method: "POST",
      body: {
        content,
        title,
        tags,
        auto_save: true, // 默认自动保存
      },
    });
  }

  // ============ 知识库管理 ============
  async searchNotes(query, nResults = 5, minSimilarity = 0.6) {
    return this.request("/api/notes/search", {
      method: "POST",
      body: {
        query,
        n_results: nResults,
        min_similarity: minSimilarity,
      },
    });
  }

  async getRecentNotes(days = 7) {
    return this.request(`/api/notes/recent?days=${days}`);
  }

  async getStats() {
    return this.request("/api/notes/stats");
  }

  async createNote(noteData) {
    return this.request("/api/notes/create", {
      method: "POST",
      body: noteData,
    });
  }

  async deleteNote(noteId) {
    return this.request(`/api/notes/delete/${noteId}`, {
      method: "DELETE",
    });
  }

  async updateNote(noteId, noteData) {
    return this.request(`/api/notes/update/${noteId}`, {
      method: "PUT",
      body: noteData,
    });
  }

  // ============ RAG Pipeline ============
  async processWithRAG(content, title = "") {
    return this.request("/api/rag/process", {
      method: "POST",
      body: {
        content,
        title,
      },
    });
  }

  async queryWithRAG(question) {
    return this.request("/api/rag/query", {
      method: "POST",
      body: { question },
    });
  }

  async getRagStatus() {
    return this.request("/api/rag/status");
  }

  // ============ RAG 管理功能 ============
  async rebuildRagIndex() {
    return this.request("/api/rag/rebuild", {
      method: "POST",
    });
  }

  async clearRagIndex() {
    return this.request("/api/rag/clear", {
      method: "DELETE",
    });
  }

  // ============ 内容提取 ============
  async extractFromUrl(url) {
    return this.request("/api/content/extract-from-url", {
      method: "POST",
      body: {
        url,
        extract_text: true,
      },
    });
  }

  // ============ 核心RAG评估功能 ============

  // 检索质量评估
  async evaluateRetrieval(sampleSize = 30) {
    return this.request("/api/rag-evaluation/evaluate-retrieval", {
      method: "POST",
      body: { sample_size: sampleSize },
    });
  }

  // 生成质量评估
  async evaluateGeneration(sampleSize = 30) {
    return this.request("/api/rag-evaluation/evaluate-generation", {
      method: "POST",
      body: { sample_size: sampleSize },
    });
  }

  // 检索方法对比
  async compareRetrievalMethods(sampleSize = 80) {
    return this.request("/api/rag-evaluation/compare-methods", {
      method: "POST",
      body: { sample_size: sampleSize },
    });
  }

  // 运行详细评估（整合三个核心功能）
  async runCompleteRAGEvaluation(sampleSize = 80) {
    return this.request("/api/rag-evaluation/run-core-evaluation", {
      method: "POST",
      body: { sample_size: sampleSize },
    });
  }

  // 获取数据集信息
  async getDatasetInfo() {
    return this.request("/api/rag-evaluation/dataset-info");
  }

  // 快速评估
  async quickEvaluation() {
    return this.request("/api/rag-evaluation/quick-evaluation", {
      method: "POST",
    });
  }

  // ============ 学习分析 ============
  async analyzeLearning() {
    return this.request("/api/chat/analyze");
  }

  // ============ 演示信息 ============
  async getDemoInfo() {
    return this.request("/api/demo-info");
  }
}

// 创建并导出API服务实例
const api = new APIService();
export default api;

// 导出各个方法
export const {
  healthCheck,
  askQuestion,
  generateSummary,
  generateNotes,
  searchNotes,
  getRecentNotes,
  getStats,
  createNote,
  updateNote,
  deleteNote,
  processWithRAG,
  queryWithRAG,
  getRagStatus,
  extractFromUrl,
  analyzeLearning,
  getDemoInfo,
  rebuildRagIndex,
  clearRagIndex,
  // 核心RAG评估方法
  evaluateRetrieval,
  evaluateGeneration,
  compareRetrievalMethods,
  runCompleteRAGEvaluation,
  getDatasetInfo,
  quickEvaluation,
} = api;
