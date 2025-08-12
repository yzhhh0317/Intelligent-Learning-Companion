// routes/notes.js - 笔记管理路由
import express from "express";
import Note from "../models/Note.js";
import simpleRAG from "../services/simpleRAG.js";
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

    const results = await ragService.semanticSearch(
      query,
      n_results,
      min_similarity
    );

    res.json({
      status: "success",
      results,
      total_found: results.length,
    });
  } catch (error) {
    logger.error("搜索失败:", error);
    res.status(500).json({
      status: "error",
      message: "搜索失败",
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

    // 索引到向量数据库
    await ragService.indexNote(note);

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

    // 从向量数据库删除
    await ragService.deleteIndex(id);

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

    // 更新笔记
    note.title = title;
    note.content = content;
    note.tags = tags || [];
    note.updated_at = new Date();

    await note.save();

    // 重新索引到向量数据库（如果启用了RAG）
    try {
      const simpleRAG = (await import("../services/simpleRAG.js")).default;
      await simpleRAG.processDocument(content, title);
    } catch (ragError) {
      logger.warn("重新索引向量失败:", ragError.message);
    }

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
