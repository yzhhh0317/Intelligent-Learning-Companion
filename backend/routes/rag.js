// routes/rag.js - 简化的RAG路由
import express from "express";
import ragService from "../services/ragService.js";
import aiService from "../services/aiService.js";
import noteService from "../services/noteService.js";
import { asyncHandler } from "../utils/errorHandler.js";
import logger from "../config/logger.js";

const router = express.Router();

/**
 * RAG文档处理
 */
router.post(
  "/process",
  asyncHandler(async (req, res) => {
    const { content, title } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "文档内容不能为空",
      });
    }

    logger.info(`处理文档: ${title || "未命名文档"}`);

    const result = await ragService.processDocument(
      content,
      title || "未命名文档"
    );

    // 同时保存到数据库
    try {
      const note = await noteService.createNote({
        title: result.title,
        content: content,
        tags: ["RAG处理", "自动索引", result.embedding_method],
        content_type: "generated",
        metadata: {
          rag_processed: true,
          chunks: result.chunks,
          doc_id: result.docId,
          embedding_method: result.embedding_method,
        },
      });

      logger.info(`文档已保存到数据库: ${note.id}`);

      res.json({
        status: "success",
        docId: result.docId,
        chunks: result.chunks,
        title: result.title,
        note_id: note.id,
        processing_info: {
          content_length: content.length,
          chunks_created: result.chunks,
          embedding_method: result.embedding_method,
        },
      });
    } catch (saveError) {
      logger.error("保存到数据库失败:", saveError);

      // 即使数据库保存失败，RAG处理成功也应该返回成功
      res.json({
        status: "success",
        docId: result.docId,
        chunks: result.chunks,
        title: result.title,
        warning: "RAG处理成功但数据库保存失败",
        processing_info: {
          content_length: content.length,
          chunks_created: result.chunks,
          embedding_method: result.embedding_method,
        },
      });
    }
  })
);

/**
 * RAG查询
 */
router.post(
  "/query",
  asyncHandler(async (req, res) => {
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "查询问题不能为空",
      });
    }

    logger.info(`RAG查询: ${question}`);

    const startTime = Date.now();

    // 执行混合检索
    const searchResults = await ragService.hybridSearch(question, 5);

    // 构建上下文
    const contextForRag = searchResults.map((result) => ({
      id: result.id,
      title: result.metadata?.title || "未知标题",
      content: result.content,
      score: result.score,
    }));

    // 调用AI生成答案
    const response = await aiService.ragAnswer(question, contextForRag, "");
    const totalTime = Date.now() - startTime;

    logger.info(`RAG查询完成，总耗时: ${totalTime}ms`);

    res.json({
      status: "success",
      answer: response.answer,
      sources: searchResults.map((result, index) => ({
        id: result.id,
        title: result.metadata?.title || `文档片段 ${index + 1}`,
        content: result.content,
        score: result.score,
        type: result.score > 0.7 ? "semantic" : "hybrid",
        chunkIndex: result.metadata?.chunkIndex || index,
      })),
      context_info: {
        documents_used: searchResults.length,
        total_context_length: contextForRag.reduce(
          (sum, doc) => sum + doc.content.length,
          0
        ),
        has_relevant_context:
          searchResults.length > 0 && searchResults[0].score > 0.3,
      },
      totalTime: `${(totalTime / 1000).toFixed(2)}s`,
    });
  })
);

/**
 * RAG系统状态
 */
router.get("/status", (req, res) => {
  try {
    const stats = ragService.getStats();

    res.json({
      status: "operational",
      initialized: stats.initialized,
      storage_type: "memory + mongodb",
      performance: {
        total_documents: stats.totalDocuments,
        total_chunks: stats.totalChunks,
        memory_usage_mb: Math.round(stats.memoryUsage),
      },
      capabilities: [
        "Document Processing",
        "Semantic Search",
        "BM25 Keyword Search",
        "Hybrid Retrieval",
        "RRF Fusion",
        "LLM Generation",
      ],
      algorithms: {
        embedding: stats.embedding_method,
        search: "语义相似度 + BM25",
        fusion: "Reciprocal Rank Fusion",
        llm: "DeepSeek R1",
      },
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("获取RAG状态失败:", error);
    res.status(500).json({
      status: "error",
      message: "获取RAG状态失败",
      error: error.message,
    });
  }
});

/**
 * 重建RAG索引
 */
router.post(
  "/rebuild",
  asyncHandler(async (req, res) => {
    logger.info("开始清理并重建RAG索引...");

    // 清空当前索引
    ragService.clear();

    // 从数据库重新加载所有笔记
    const { default: Note } = await import("../models/Note.js");
    const allNotes = await Note.find({ deleted: false });

    logger.info(`找到 ${allNotes.length} 条笔记需要重新索引`);

    let successCount = 0;
    let failedCount = 0;

    for (const note of allNotes) {
      try {
        await ragService.processDocument(note.content, note.title, note.id);
        successCount++;
      } catch (error) {
        logger.error(`处理笔记失败: ${note.title}`, error.message);
        failedCount++;
      }
    }

    const stats = ragService.getStats();
    logger.info(`RAG索引重建完成: ${successCount}/${allNotes.length} 成功`);

    res.json({
      status: "success",
      message: "RAG索引重建完成",
      statistics: {
        total_notes: allNotes.length,
        success_count: successCount,
        failed_count: failedCount,
        current_stats: {
          totalDocuments: stats.totalDocuments,
          totalChunks: stats.totalChunks,
          embedding_method: stats.embedding_method,
        },
      },
    });
  })
);

/**
 * 清空RAG知识库
 */
router.delete("/clear", (req, res) => {
  try {
    ragService.clear();
    logger.info("RAG知识库已清空");

    res.json({
      status: "success",
      message: "RAG知识库已清空",
      cleared_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("清空RAG知识库失败:", error);
    res.status(500).json({
      status: "error",
      message: "清空知识库失败",
      error: error.message,
    });
  }
});

/**
 * 删除特定文档
 */
router.delete(
  "/document/:docId",
  asyncHandler(async (req, res) => {
    const { docId } = req.params;

    const result = ragService.deleteDocument(docId);

    if (result) {
      logger.info(`文档已删除: ${docId}`);
      res.json({
        status: "success",
        message: "文档已删除",
        doc_id: docId,
      });
    } else {
      res.status(404).json({
        status: "error",
        message: "文档不存在",
      });
    }
  })
);

export default router;
