// config/vectorStore.js - 向量存储初始化
import simpleRAG from "../services/simpleRAG.js";
import logger from "./logger.js";

export async function initVectorStore() {
  try {
    logger.info("🧠 初始化向量存储系统...");

    // 使用简化的RAG服务
    await simpleRAG.initialize();

    const stats = simpleRAG.getStats();

    if (stats.initialized) {
      logger.info("✅ 向量存储初始化成功");
      logger.info(`📊 向量存储统计:`);
      logger.info(`   • 文档数量: ${stats.totalDocuments}`);
      logger.info(`   • 向量块数: ${stats.totalChunks}`);
      logger.info(`   • 内存使用: ${Math.round(stats.memoryUsage)}MB`);
      logger.info(`   • 存储类型: 内存 + MongoDB持久化`);
      return true;
    } else {
      logger.warn("⚠️ 向量存储初始化异常，但服务可用");
      return false;
    }
  } catch (error) {
    logger.error("❌ 向量存储初始化失败:", error);
    logger.warn("⚠️ 将使用降级模式继续运行");

    // 不抛出错误，允许系统继续运行
    return false;
  }
}
