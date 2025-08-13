// routes/health.js - 健康检查路由
import express from "express";
import mongoose from "mongoose";
import logger from "../config/logger.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    const mongoStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";

    // 获取RAG服务状态 - 🔧 修正：使用enhancedRAG
    let vectorStats;
    try {
      const { default: enhancedRAG } = await import(
        "../services/enhancedRAG.js"
      );
      vectorStats = enhancedRAG.getStats();
    } catch (ragError) {
      logger.warn("获取RAG状态失败:", ragError);
      vectorStats = {
        totalDocuments: 0,
        totalChunks: 0,
        initialized: false,
        memoryUsage: 0,
        embedding_method: "unknown",
        vector_dimension: 0,
      };
    }

    const healthStatus = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        vectorStore: vectorStats.initialized ? "operational" : "initializing",
        deepseek: process.env.DEEPSEEK_API_KEY
          ? "configured"
          : "not configured",
        huggingface: process.env.HUGGINGFACE_API_KEY
          ? "configured"
          : "not configured",
        ragService: vectorStats.initialized ? "ready" : "starting",
      },
      statistics: {
        documents: vectorStats.totalDocuments,
        vectors: vectorStats.totalChunks,
        memory_usage_mb: Math.round(vectorStats.memoryUsage),
        embedding_method: vectorStats.embedding_method,
        vector_dimension: vectorStats.vector_dimension,
      },
      version: "1.0.0",
      environment: process.env.NODE_ENV || "development",
    };

    // 检查关键服务状态
    let overallStatus = "healthy";
    if (mongoStatus !== "connected") {
      overallStatus = "degraded";
    }
    if (!process.env.DEEPSEEK_API_KEY) {
      overallStatus = overallStatus === "healthy" ? "degraded" : "unhealthy";
    }

    healthStatus.status = overallStatus;

    const statusCode =
      overallStatus === "healthy"
        ? 200
        : overallStatus === "degraded"
        ? 200
        : 503;

    logger.info(`🩺 健康检查: ${overallStatus.toUpperCase()}`);

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    logger.error("健康检查失败:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        mongodb: "unknown",
        vectorStore: "unknown",
        deepseek: "unknown",
        ragService: "error",
      },
    });
  }
});

export default router;
