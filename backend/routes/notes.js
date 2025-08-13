// routes/notes.js - 笔记管理路由
import express from "express";
import Note from "../models/Note.js";
import logger from "../config/logger.js";

const router = express.Router();

// 语义搜索
router.post("/search", async (req, res) => {
  try {
    const { query, n_results = 5, min_similarity = 0.6 } = req.body;

    if (!query) {
      return res.status(400).json({
        status: "error",
        message: "搜索查询不能为空",
      });
    }

    // 🔧 修正：使用enhancedRAG而不是ragService
    const { default: enhancedRAG } = await import("../services/enhancedRAG.js");
    const results = await enhancedRAG.hybridSearch(query, n_results);

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
  } catch (error) {
    logger.error("搜索失败:", error);
    res.status(500).json({
      status: "error",
      message: "搜索失败",
      error: error.message,
    });
  }
});

// 获取最近笔记
router.get("/recent", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const notes = await Note.getRecentNotes(days);

    res.json({
      status: "success",
      notes,
    });
  } catch (error) {
    logger.error("获取最近笔记失败:", error);
    res.status(500).json({
      status: "error",
      message: "获取笔记失败",
    });
  }
});

// 获取统计信息
router.get("/stats", async (req, res) => {
  try {
    const stats = await Note.getStatistics();
    res.json(stats);
  } catch (error) {
    logger.error("获取统计失败:", error);
    res.status(500).json({
      status: "error",
      message: "获取统计失败",
    });
  }
});

// 创建笔记
router.post("/create", async (req, res) => {
  try {
    const { title, content, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        status: "error",
        message: "标题和内容不能为空",
      });
    }

    const note = new Note({
      title,
      content,
      tags: tags || [],
    });

    await note.save();

    // 🔧 修正：使用enhancedRAG建立索引
    try {
      const { default: enhancedRAG } = await import(
        "../services/enhancedRAG.js"
      );
      await enhancedRAG.processDocument(content, title, note.id);
      logger.info(`🧠 向量索引创建成功: ${note.id}`);
    } catch (ragError) {
      logger.warn(`⚠️ 向量索引失败: ${ragError.message}`);
    }

    res.json({
      status: "success",
      note,
    });
  } catch (error) {
    logger.error("创建笔记失败:", error);
    res.status(500).json({
      status: "error",
      message: "创建笔记失败",
    });
  }
});

// 删除笔记
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const note = await Note.findOne({ id });
    if (!note) {
      return res.status(404).json({
        status: "error",
        message: "笔记不存在",
      });
    }

    // 软删除
    await note.softDelete();

    // 🔧 修正：从enhancedRAG删除索引
    try {
      const { default: enhancedRAG } = await import(
        "../services/enhancedRAG.js"
      );
      await enhancedRAG.deleteDocument(id);
      logger.info(`🗑️ 向量索引删除成功: ${id}`);
    } catch (ragError) {
      logger.warn(`⚠️ 向量索引删除失败: ${ragError.message}`);
    }

    res.json({
      status: "success",
      message: "笔记已删除",
    });
  } catch (error) {
    logger.error("删除笔记失败:", error);
    res.status(500).json({
      status: "error",
      message: "删除笔记失败",
    });
  }
});

// 更新笔记
router.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        status: "error",
        message: "标题和内容不能为空",
      });
    }

    const note = await Note.findOne({ id, deleted: false });
    if (!note) {
      return res.status(404).json({
        status: "error",
        message: "笔记不存在",
      });
    }

    // 🔧 修正：重新索引向量数据，使用现有笔记ID避免重复
    try {
      const { default: enhancedRAG } = await import(
        "../services/enhancedRAG.js"
      );

      // 先删除旧的向量索引
      await enhancedRAG.deleteDocument(id);
      logger.info(`🗑️ 已删除旧的向量索引: ${id}`);

      // 重新创建向量索引，传递现有笔记ID
      const processResult = await enhancedRAG.processDocument(
        content,
        title,
        id
      );
      logger.info(
        `🔄 重新创建向量索引成功: ${id} (${processResult.embedding_method})`
      );
    } catch (ragError) {
      logger.warn(`⚠️ 向量索引更新失败: ${ragError.message}`);
      // 不抛出错误，允许笔记更新继续进行
    }

    // 更新笔记
    note.title = title;
    note.content = content;
    note.tags = tags || [];
    note.updated_at = new Date();

    await note.save();
    logger.info(`📝 笔记更新成功: ${note.title} (ID: ${note.id})`);

    res.json({
      status: "success",
      message: "笔记更新成功",
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        preview: note.preview,
        tags: note.tags,
        updated_at: note.updated_at,
      },
    });
  } catch (error) {
    logger.error("更新笔记失败:", error);
    res.status(500).json({
      status: "error",
      message: "更新笔记失败",
    });
  }
});

export default router;
