// routes/chat.js - 智能问答路由
import express from "express";
import ragService from "../services/ragService.js";
import aiService from "../services/aiService.js";
import noteService from "../services/noteService.js";
import { asyncHandler } from "../utils/errorHandler.js";
import logger from "../config/logger.js";

const router = express.Router();

/**
 * 智能问答 - RAG增强
 */
router.post(
  "/ask",
  asyncHandler(async (req, res) => {
    const { question, current_content, use_rag } = req.body;

    if (!question) {
      return res.status(400).json({
        status: "error",
        message: "问题不能为空",
      });
    }

    logger.info(`💬 收到问题: ${question} (RAG: ${use_rag})`);

    let context = [];
    let contextInfo = {
      has_context: false,
      relevant_notes: 0,
      sources_info: [],
    };

    // 如果启用RAG，检索相关文档
    if (use_rag) {
      const searchResults = await ragService.hybridSearch(question, 3);

      if (searchResults.length > 0) {
        context = searchResults.map((result) => ({
          id: result.id,
          title: result.metadata?.title || "未知标题",
          content: result.content,
          score: result.score,
        }));

        contextInfo = {
          has_context: true,
          relevant_notes: context.length,
          sources_info: context.map((c) => c.title),
        };
      }

      logger.info(`🔍 检索到 ${context.length} 条相关文档`);
    }

    // 调用AI生成答案
    const startTime = Date.now();
    const response = await aiService.ragAnswer(
      question,
      context,
      current_content
    );
    const processingTime = (Date.now() - startTime) / 1000;

    logger.info(`✅ 问答完成，耗时: ${processingTime.toFixed(2)}s`);

    res.json({
      status: "success",
      answer: response.answer,
      sources_used: context.length,
      context_info: contextInfo,
      processing_time: processingTime,
      rag_enabled: use_rag,
    });
  })
);

/**
 * 生成内容摘要
 */
router.post(
  "/summary",
  asyncHandler(async (req, res) => {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        status: "error",
        message: "内容不能为空",
      });
    }

    logger.info(`📄 生成摘要，原文长度: ${content.length}`);

    const result = await aiService.generateSummary(content);

    logger.info(
      `✅ 摘要生成完成，压缩比: ${(result.compression_ratio * 100).toFixed(1)}%`
    );

    res.json({
      status: "success",
      summary: result.summary,
      original_length: result.original_length,
      summary_length: result.summary_length,
      compression_ratio: result.compression_ratio,
    });
  })
);

/**
 * 生成结构化笔记
 */
router.post(
  "/generate-notes",
  asyncHandler(async (req, res) => {
    const { content, title, tags, auto_save = true } = req.body;

    if (!content) {
      return res.status(400).json({
        status: "error",
        message: "内容不能为空",
      });
    }

    logger.info(`📝 生成结构化笔记: ${title || "无标题"}`);

    // 生成笔记
    const result = await aiService.generateStructuredNotes(content, title);

    let savedNote = null;
    let ragProcessed = false;

    // 如果需要自动保存
    if (auto_save) {
      try {
        // 保存到数据库
        savedNote = await noteService.createNote({
          title: result.title,
          content: result.notes,
          tags: result.tags,
          original_content: content,
          content_type: "generated",
          key_concepts: result.key_concepts,
          metadata: {
            ai_generated: true,
            source_content_length: content.length,
          },
        });

        // 索引到RAG向量数据库
        try {
          await ragService.processDocument(result.notes, result.title);
          ragProcessed = true;
          logger.info(`🧠 已建立向量索引: ${savedNote.id}`);
        } catch (ragError) {
          logger.warn(`⚠️ 向量索引失败: ${ragError.message}`);
        }

        logger.info(`💾 笔记已自动保存: ${savedNote.id}`);
      } catch (saveError) {
        logger.error("保存笔记失败:", saveError);
        // 即使保存失败，仍返回生成的笔记内容
      }
    }

    res.json({
      status: "success",
      notes: result.notes,
      title: result.title,
      tags: result.tags,
      key_concepts: result.key_concepts,
      saved: !!savedNote,
      note_id: savedNote?.id,
      rag_indexed: ragProcessed,
      processing_info: {
        original_length: content.length,
        notes_length: result.notes.length,
        tags_extracted: result.tags.length,
        concepts_found: result.key_concepts.length,
      },
    });
  })
);

/**
 * 分析学习进度
 */
router.get(
  "/analyze",
  asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;

    logger.info(`📊 分析最近 ${days} 天的学习进度`);

    // 获取最近的学习笔记
    const recentNotes = await noteService.getRecentNotes(days);

    if (recentNotes.length === 0) {
      return res.json({
        status: "success",
        analysis: "暂无学习记录，开始添加学习内容吧！",
        recommendations: [
          "尝试使用「内容处理」功能生成你的第一条笔记",
          "使用「智能问答」功能提问学习相关问题",
          "定期整理和回顾你的学习笔记",
        ],
        notes_analyzed: 0,
        period_days: days,
      });
    }

    // AI分析学习进度
    const analysis = await aiService.analyzeLearningProgress(recentNotes);

    // 获取学习统计
    const learningStats = {
      total_notes: recentNotes.length,
      avg_notes_per_week: Math.round((recentNotes.length / days) * 7),
      total_content_length: recentNotes.reduce(
        (sum, note) => sum + (note.content_length || 0),
        0
      ),
      popular_tags: [
        ...new Set(recentNotes.flatMap((note) => note.tags || [])),
      ].slice(0, 5),
    };

    logger.info(`✅ 学习分析完成，分析了 ${recentNotes.length} 条笔记`);

    res.json({
      status: "success",
      analysis: analysis.summary,
      recommendations: analysis.recommendations,
      statistics: learningStats,
      notes_analyzed: recentNotes.length,
      period_days: days,
    });
  })
);

export default router;
