import axios from "axios";

// 创建axios实例
const apiClient = axios.create({
  baseURL: "http://localhost:8000/api", // Node.js后端地址
  timeout: 600000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    console.log(`📡 API请求: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("❌ 请求失败:", error);
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ API响应: ${response.status}`);
    return response.data;
  },
  (error) => {
    const errorMsg = error.response?.data?.error || error.message || "网络错误";
    console.error("❌ API错误:", errorMsg);
    return Promise.reject(new Error(errorMsg));
  }
);

// API方法
export const api = {
  // 健康检查
  async healthCheck() {
    return apiClient.get("/health");
  },

  // 智能问答
  async askQuestion(question, useRag = true, currentContent = "") {
    return apiClient.post("/chat/ask", {
      question,
      use_rag: useRag,
      current_content: currentContent,
    });
  },

  // 生成摘要
  async generateSummary(content) {
    return apiClient.post("/chat/summary", { content });
  },

  // 生成笔记
  async generateNotes(content, title = "", autoSave = true) {
    return apiClient.post("/chat/generate-notes", {
      content,
      title,
      auto_save: autoSave,
    });
  },

  // 语义搜索
  async searchNotes(query) {
    return apiClient.post("/notes/search", { query });
  },

  // 获取最近笔记
  async getRecentNotes() {
    return apiClient.get("/notes/recent");
  },

  // 获取统计
  async getStats() {
    return apiClient.get("/notes/stats");
  },

  // 创建笔记
  async createNote(title, content, tags = []) {
    return apiClient.post("/notes/create", {
      title,
      content,
      tags,
    });
  },

  // 获取演示信息
  async getDemoInfo() {
    return apiClient.get("/demo-info");
  },
};

export default api;
