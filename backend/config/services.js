// config/services.js - 统一服务初始化
import logger from "./logger.js";

export async function initServices() {
  try {
    logger.info("🧠 初始化核心服务...");

    // 初始化RAG服务
    const { default: ragService } = await import("../services/ragService.js");
    await ragService.initialize();

    const ragStats = ragService.getStats();
    logger.info("✅ RAG服务初始化成功");
    logger.info(`📊 向量化方法: ${ragStats.embedding_method}`);
    logger.info(`🔢 向量维度: ${ragStats.vector_dimension}`);
    logger.info(
      `📦 已加载 ${ragStats.totalDocuments} 个文档，${ragStats.totalChunks} 个向量块`
    );

    // 初始化AI服务
    const { default: aiService } = await import("../services/aiService.js");
    logger.info("✅ AI服务加载成功");

    // 初始化评估服务
    const { default: evaluationService } = await import(
      "../services/evaluationService.js"
    );
    logger.info("✅ 评估服务加载成功");

    logger.info("🎉 所有核心服务初始化完成");

    return {
      ragService,
      aiService,
      evaluationService,
    };
  } catch (error) {
    logger.error("❌ 服务初始化失败:", error);
    throw error;
  }
}
