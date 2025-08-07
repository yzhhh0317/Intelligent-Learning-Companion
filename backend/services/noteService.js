// services/noteService.js - 笔记服务层
import Note from "../models/Note.js";
import logger from "../config/logger.js";

class NoteService {
  /**
   * 创建笔记
   */
  async createNote(data) {
    try {
      const note = new Note({
        title: data.title,
        content: data.content,
        original_content: data.original_content || data.content,
        tags: data.tags || [],
        content_type: data.content_type || "text",
        source_url: data.source_url,
        key_concepts: data.key_concepts || [],
        metadata: data.metadata,
      });

      await note.save();
      logger.info(`📝 笔记创建成功: ${note.title} (ID: ${note.id})`);

      return note;
    } catch (error) {
      logger.error("创建笔记失败:", error);
      throw error;
    }
  }

  /**
   * 获取笔记
   */
  async getNote(noteId) {
    try {
      const note = await Note.findOne({ id: noteId, deleted: false });

      if (note) {
        // 增加查看次数
        note.statistics.view_count += 1;
        await note.save();
      }

      return note;
    } catch (error) {
      logger.error("获取笔记失败:", error);
      throw error;
    }
  }

  /**
   * 更新笔记
   */
  async updateNote(noteId, updates) {
    try {
      const note = await Note.findOne({ id: noteId, deleted: false });

      if (!note) {
        throw new Error("笔记不存在");
      }

      // 更新字段
      Object.assign(note, updates);
      note.updated_at = new Date();

      await note.save();
      logger.info(`📝 笔记更新成功: ${note.title} (ID: ${note.id})`);

      return note;
    } catch (error) {
      logger.error("更新笔记失败:", error);
      throw error;
    }
  }

  /**
   * 删除笔记（软删除）
   */
  async deleteNote(noteId) {
    try {
      const note = await Note.findOne({ id: noteId });

      if (!note) {
        throw new Error("笔记不存在");
      }

      await note.softDelete();
      logger.info(`🗑️ 笔记删除成功: ${note.title} (ID: ${note.id})`);

      return true;
    } catch (error) {
      logger.error("删除笔记失败:", error);
      throw error;
    }
  }

  /**
   * 获取最近笔记
   */
  async getRecentNotes(days = 7, limit = 20) {
    try {
      const notes = await Note.getRecentNotes(days)
        .limit(limit)
        .select("-original_content");

      return notes;
    } catch (error) {
      logger.error("获取最近笔记失败:", error);
      throw error;
    }
  }

  /**
   * 根据标签获取笔记
   */
  async getNotesByTags(tags, limit = 10) {
    try {
      const notes = await Note.findByTags(tags)
        .limit(limit)
        .select("-original_content");

      return notes;
    } catch (error) {
      logger.error("根据标签获取笔记失败:", error);
      throw error;
    }
  }

  /**
   * 搜索笔记（关键词搜索）
   */
  async searchNotes(keyword, limit = 10) {
    try {
      const notes = await Note.find({
        $text: { $search: keyword },
        deleted: false,
      })
        .limit(limit)
        .select("-original_content")
        .sort({ score: { $meta: "textScore" } });

      return notes;
    } catch (error) {
      logger.error("搜索笔记失败:", error);
      throw error;
    }
  }

  /**
   * 获取相关笔记
   */
  async getRelatedNotes(noteId, limit = 5) {
    try {
      const note = await Note.findOne({ id: noteId });

      if (!note) {
        return [];
      }

      // 基于标签查找相关笔记
      const relatedNotes = await Note.find({
        id: { $ne: noteId },
        tags: { $in: note.tags },
        deleted: false,
      })
        .limit(limit)
        .select("-original_content")
        .sort("-created_at");

      return relatedNotes;
    } catch (error) {
      logger.error("获取相关笔记失败:", error);
      throw error;
    }
  }

  /**
   * 批量导入笔记
   */
  async importNotes(notesData) {
    try {
      const results = {
        success: [],
        failed: [],
      };

      for (const data of notesData) {
        try {
          const note = await this.createNote(data);
          results.success.push(note.id);
        } catch (error) {
          results.failed.push({
            title: data.title,
            error: error.message,
          });
        }
      }

      logger.info(
        `📦 批量导入完成: 成功${results.success.length}条，失败${results.failed.length}条`
      );

      return results;
    } catch (error) {
      logger.error("批量导入失败:", error);
      throw error;
    }
  }

  /**
   * 导出笔记
   */
  async exportNotes(filter = {}) {
    try {
      const notes = await Note.find({
        ...filter,
        deleted: false,
      }).select("-_id -__v");

      return notes;
    } catch (error) {
      logger.error("导出笔记失败:", error);
      throw error;
    }
  }

  /**
   * 获取学习趋势
   */
  async getLearningTrends(days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const trends = await Note.aggregate([
        {
          $match: {
            created_at: { $gte: startDate },
            deleted: false,
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
            },
            count: { $sum: 1 },
            totalWords: { $sum: "$statistics.word_count" },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ]);

      return trends;
    } catch (error) {
      logger.error("获取学习趋势失败:", error);
      throw error;
    }
  }
}

export default new NoteService();
