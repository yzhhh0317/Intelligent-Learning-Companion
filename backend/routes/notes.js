// routes/notes.js - 笔记管理路由
import express from "express";
import ragService from "../services/ragService.js";
import { asyncHandler } from "../utils/errorHandler.js";
import logger from "../config/logger.js";

const router = express.Router();

/**
 * 语义搜索
 */
router.post(
  "/search",
  asyncHandler(async (req, res) => {
    const { query, n_results = 5, min_similarity = 0.6 } = req.body;

    if (!query) {
      return res.status(400).json({
        status: "error",
        message: "搜索查询不能为空",
      });
    }

    // 使用RAG服务执行混合搜索
    const results = await ragService.hybridSearch(query, n_results);

    // 过滤结果并格式化
    const filteredResults = results
      .filter((result) => result.score >= min_similarity)
      .map((result) => ({
        id: result.id,
        content: result.content,
        preview:
          result.content.substring(0, 300) +
          (result.content.length > 300 ? "..." : ""),
        metadata: {
          id: result.metadata?.id || result.id,
          title: result.metadata?.title || "未知标题",
          tags: result.metadata?.tags || "",
          created_at: result.metadata?.created_at || new Date().toISOString(),
          content_length: result.content.length,
          chunkIndex: result.metadata?.chunkIndex || 0,
          embeddingMethod: result.metadata?.embeddingMethod || "unknown",
        },
        similarity: result.score,
        match_type: result.match_type || "semantic",
        fusion_details: result.fusion_details,
      }));

    res.json({
      status: "success",
      results: filteredResults,
      total_found: filteredResults.length,
    });
  })
);

/**
 * 获取最近笔记
 */
router.get(
  "/recent",
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 7;

    const { default: Note } = await import("../models/Note.js");
    const notes = await Note.getRecentNotes(days);

    res.json({
      status: "success",
      notes,
    });
  })
);

/**
 * 获取统计信息
 */
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const { default: Note } = await import("../models/Note.js");
    const dbStats = await Note.getStatistics();
    const ragStats = ragService.getStats();

    const combinedStats = {
      ...dbStats,
      rag_info: {
        total_documents: ragStats.totalDocuments,
        total_vectors: ragStats.totalChunks,
        memory_usage_mb: Math.round(ragStats.memoryUsage),
        initialized: ragStats.initialized,
        embedding_method: ragStats.embedding_method,
        vector_dimension: ragStats.vector_dimension,
      },
    };

    res.json(combinedStats);
  })
);

/**
 * 创建笔记
 */
router.post(
  "/create",
  asyncHandler(async (req, res) => {
    const { title, content, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        status: "error",
        message: "标题和内容不能为空",
      });
    }

    const { default: Note } = await import("../models/Note.js");
    const note = new Note({
      title,
      content,
      tags: tags || [],
    });

    await note.save();

    // 建立向量索引
    try {
      await ragService.processDocument(content, title);
      logger.info(`向量索引创建成功: ${note.id}`);
    } catch (ragError) {
      logger.warn(`向量索引失败: ${ragError.message}`);
    }

    res.json({
      status: "success",
      note,
    });
  })
);

/**
 * 删除笔记
 */
router.delete(
  "/delete/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { default: Note } = await import("../models/Note.js");
    const note = await Note.findOne({ id });

    if (!note) {
      return res.status(404).json({
        status: "error",
        message: "笔记不存在",
      });
    }

    // 软删除
    await note.softDelete();

    // 从RAG删除索引
    try {
      await ragService.deleteDocument(id);
      logger.info(`向量索引删除成功: ${id}`);
    } catch (ragError) {
      logger.warn(`向量索引删除失败: ${ragError.message}`);
    }

    res.json({
      status: "success",
      message: "笔记已删除",
    });
  })
);

// routes/notes.js - 简化的笔记更新路由（将RAG处理分离）

/**
 * 更新笔记
 */
router.put(
  "/update/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { title, content, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        status: "error",
        message: "标题和内容不能为空",
      });
    }

    const { default: Note } = await import("../models/Note.js");
    const note = await Note.findOne({ id, deleted: false });

    if (!note) {
      return res.status(404).json({
        status: "error",
        message: "笔记不存在",
      });
    }

    try {
      // 1. 只更新笔记基本信息，不涉及RAG
      note.title = title;
      note.content = content;
      note.tags = tags || [];
      note.updated_at = new Date();

      // 保存笔记到数据库
      const savedNote = await note.save();

      logger.info(`笔记更新成功: ${savedNote.title} (ID: ${savedNote.id})`);

      // 2. 立即返回成功响应（不等待RAG处理）
      const responseData = {
        status: "success",
        message: "笔记更新成功",
        note: {
          id: savedNote.id,
          title: savedNote.title,
          content: savedNote.content,
          preview: savedNote.preview,
          tags: savedNote.tags,
          updated_at: savedNote.updated_at,
          embedding_indexed: savedNote.embedding_indexed,
        },
      };

      res.json(responseData);

      // 3. 异步处理RAG向量更新（不阻塞响应）
      setImmediate(async () => {
        try {
          logger.info(`开始异步更新向量索引: ${id}`);

          // 删除旧向量索引
          await ragService.deleteDocument(id);

          // 重新创建向量索引
          const processResult = await ragService.processDocument(
            content,
            title
          );

          if (processResult.success) {
            // 更新embedding状态
            await Note.updateOne(
              { id: id },
              {
                embedding_indexed: true,
                "metadata.rag_processed": true,
                "metadata.embedding_method": processResult.embedding_method,
              }
            );

            logger.info(`向量索引异步更新成功: ${id}`);
          }
        } catch (ragError) {
          logger.error(`异步向量索引更新失败: ${ragError.message}`);

          // 标记为需要重新索引
          try {
            await Note.updateOne(
              { id: id },
              {
                embedding_indexed: false,
                "metadata.rag_sync_required": true,
              }
            );
          } catch (metaError) {
            logger.warn(`更新RAG元数据失败: ${metaError.message}`);
          }
        }
      });
    } catch (error) {
      logger.error("笔记更新失败:", error);

      res.status(500).json({
        status: "error",
        message: "笔记更新失败",
        error: error.message,
      });
    }
  })
);

export default router;
