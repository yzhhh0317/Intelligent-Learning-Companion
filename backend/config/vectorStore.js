// config/vectorStore.js - 向量存储初始化
import ragService from "../services/ragService.js";
import logger from "./logger.js";

export async function initVectorStore() {
  try {
    const initialized = await ragService.initialize();

    if (initialized) {
      logger.info("✅ 向量存储初始化成功");
    } else {
      logger.warn("⚠️ 使用备用向量存储方案");
    }

    return initialized;
  } catch (error) {
    logger.error("向量存储初始化失败:", error);
    throw error;
  }
}
