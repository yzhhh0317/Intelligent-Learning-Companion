// routes/ragEvaluation.js - 简化的RAG评估路由
import express from "express";
import evaluationService from "../services/evaluationService.js";
import { asyncHandler } from "../utils/errorHandler.js";
import logger from "../config/logger.js";

const router = express.Router();

/**
 * 快速评估
 */
router.post(
  "/quick-evaluation",
  asyncHandler(async (req, res) => {
    logger.info("开始快速评估...");

    const startTime = Date.now();
    const result = await evaluationService.quickEvaluation();
    const executionTime = Date.now() - startTime;

    logger.info(`快速评估完成，耗时: ${executionTime}ms`);

    res.json({
      status: "success",
      quick_report: result,
      execution_time: executionTime,
    });
  })
);

/**
 * 详细评估
 */
router.post(
  "/run-core-evaluation",
  asyncHandler(async (req, res) => {
    const { sample_size = 80 } = req.body;

    logger.info(`开始详细RAG评估，样本数: ${sample_size}`);

    const startTime = Date.now();
    const result = await evaluationService.detailedEvaluation(sample_size);
    const executionTime = Date.now() - startTime;

    logger.info(`详细评估完成，耗时: ${executionTime}ms`);

    res.json({
      status: "success",
      report: result,
      execution_time: executionTime,
    });
  })
);

/**
 * 检索方法对比
 */
router.post(
  "/compare-methods",
  asyncHandler(async (req, res) => {
    const { sample_size = 80 } = req.body;

    logger.info(`开始检索方法对比，样本数: ${sample_size}`);

    const startTime = Date.now();
    const result = await evaluationService.compareRetrievalMethods(sample_size);
    const executionTime = Date.now() - startTime;

    logger.info(`方法对比完成，耗时: ${executionTime}ms`);

    res.json({
      status: "success",
      comparison: result,
      execution_time: executionTime,
    });
  })
);

/**
 * 检索质量评估
 */
router.post(
  "/evaluate-retrieval",
  asyncHandler(async (req, res) => {
    const { sample_size = 30 } = req.body;

    const startTime = Date.now();
    const metrics = await evaluationService.evaluateRetrieval(sample_size);
    const executionTime = Date.now() - startTime;

    res.json({
      status: "success",
      metrics,
      execution_time: executionTime,
      sample_size,
    });
  })
);

/**
 * 生成质量评估
 */
router.post(
  "/evaluate-generation",
  asyncHandler(async (req, res) => {
    const { sample_size = 30 } = req.body;

    const startTime = Date.now();
    const metrics = await evaluationService.evaluateGeneration(sample_size);
    const executionTime = Date.now() - startTime;

    res.json({
      status: "success",
      metrics,
      execution_time: executionTime,
      sample_size,
    });
  })
);

/**
 * 获取评估数据集信息
 */
router.get("/dataset-info", (req, res) => {
  try {
    const datasetStats = evaluationService.getDatasetStats();

    res.json({
      status: "success",
      dataset: {
        total_questions: datasetStats.totalQuestions,
        categories: datasetStats.categories,
        difficulties: datasetStats.difficulties,
        description: "基于3GPP标准的通信技术问答数据集",
      },
    });
  } catch (error) {
    logger.error("获取数据集信息失败:", error);
    res.status(500).json({
      status: "error",
      message: "获取数据集信息失败",
      error: error.message,
    });
  }
});

export default router;
