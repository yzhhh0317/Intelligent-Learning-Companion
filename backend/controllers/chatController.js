// controllers/chatController.js - 智能问答控制器
import aiService from "../services/aiService.js";
import ragService from "../services/ragService.js";
import noteService from "../services/noteService.js";
import logger from "../config/logger.js";

class ChatController {
  /**
   * 智能问答 - RAG增强
   */
  async askQuestion(req, res) {
    try {
      const { question, current_content, use_rag } = req.body;

      if (!question) {
        return res.status(400).json({
          status: "error",
          message: "问题不能为空",
        });
      }

      logger.info(`💬 收到问题: ${question} (RAG: ${use_rag})`);

      let context = [];

      // 如果启用RAG，检索相关文档
      if (use_rag) {
        context = await ragService.retrieveContext(question, 3);
        logger.info(`🔍 检索到 ${context.length} 条相关文档`);
      }

      // 调用AI生成答案
      const response = await aiService.ragAnswer(
        question,
        context,
        current_content
      );

      logger.info(`✅ 问答完成，耗时: ${response.processing_time}s`);

      res.json(response);
    } catch (error) {
      logger.error("问答处理失败:", error);
      res.status(500).json({
        status: "error",
        message: "问答处理失败",
        error: error.message,
      });
    }
  }

  /**
   * 生成内容摘要
   */
  async generateSummary(req, res) {
    try {
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
        `✅ 摘要生成完成，压缩比: ${(result.compression_ratio * 100).toFixed(
          1
        )}%`
      );

      res.json({
        status: "success",
        summary: result.summary,
        original_length: result.original_length,
        summary_length: result.summary_length,
        compression_ratio: result.compression_ratio,
      });
    } catch (error) {
      logger.error("摘要生成失败:", error);
      res.status(500).json({
        status: "error",
        message: "摘要生成失败",
        error: error.message,
      });
    }
  }

  /**
   * 生成结构化笔记
   */
  async generateNotes(req, res) {
    try {
      const { content, title, tags, auto_save } = req.body;

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

      // 如果需要自动保存
      if (auto_save) {
        savedNote = await noteService.createNote({
          title: result.title,
          content: result.notes,
          tags: result.tags,
          original_content: content,
          content_type: "generated",
        });

        // 索引到向量数据库
        await ragService.indexNote(savedNote);

        logger.info(`💾 笔记已自动保存: ${savedNote.id}`);
      }

      res.json({
        status: "success",
        notes: result.notes,
        title: result.title,
        tags: result.tags,
        key_concepts: result.key_concepts,
        saved: !!savedNote,
        note_id: savedNote?.id,
      });
    } catch (error) {
      logger.error("笔记生成失败:", error);
      res.status(500).json({
        status: "error",
        message: "笔记生成失败",
        error: error.message,
      });
    }
  }

  /**
   * 分析学习进度
   */
  async analyzeLearning(req, res) {
    try {
      // 获取最近的学习笔记
      const recentNotes = await noteService.getRecentNotes(30);

      // AI分析学习进度
      const analysis = await aiService.analyzeLearningProgress(recentNotes);

      res.json({
        status: "success",
        analysis: analysis.summary,
        recommendations: analysis.recommendations,
        notes_analyzed: recentNotes.length,
      });
    } catch (error) {
      logger.error("学习分析失败:", error);
      res.status(500).json({
        status: "error",
        message: "学习分析失败",
        error: error.message,
      });
    }
  }
}

export default new ChatController();
