// services/aiService.js - DeepSeek AI服务
import axios from "axios";
import logger from "../config/logger.js";

class AIService {
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.apiUrl = process.env.DEEPSEEK_API_URL;
    this.model = process.env.DEEPSEEK_MODEL || "deepseek-r1";

    if (!this.apiKey) {
      logger.warn("⚠️ DeepSeek API Key未配置");
    }
  }

  /**
   * 调用DeepSeek API
   * @param {Array} messages - 对话消息
   * @param {Object} options - 额外选项
   */
  async callDeepSeek(messages, options = {}) {
    try {
      const payload = {
        model: this.model,
        messages,
        stream: false,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        ...options,
      };

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 600000, // 30秒超时
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error(
        "DeepSeek API调用失败:",
        error.response?.data || error.message
      );
      throw new Error("AI服务暂时不可用");
    }
  }

  /**
   * RAG增强问答 - 核心功能
   * @param {String} question - 用户问题
   * @param {Array} context - 检索到的相关文档
   * @param {String} currentContent - 当前学习内容
   */
  async ragAnswer(question, context = [], currentContent = "") {
    const systemPrompt = `你是一个专业的学习助手，基于提供的知识库内容和当前学习材料来回答问题。
    
规则：
1. 优先使用提供的上下文信息回答
2. 如果上下文不足，可以基于你的知识补充
3. 回答要准确、专业、易懂
4. 适当使用例子和类比帮助理解
5. 标注信息来源（来自知识库/当前内容/通用知识）`;

    const contextText =
      context.length > 0
        ? `\n相关知识库内容：\n${context
            .map((doc, i) => `[文档${i + 1}] ${doc.title}\n${doc.content}`)
            .join("\n\n")}`
        : "";

    const currentText = currentContent
      ? `\n当前学习内容：\n${currentContent.substring(0, 2000)}`
      : "";

    const userPrompt = `${contextText}${currentText}\n\n问题：${question}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const startTime = Date.now();
    const answer = await this.callDeepSeek(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });
    const processingTime = (Date.now() - startTime) / 1000;

    return {
      answer,
      sources_used: context.length,
      context_info: {
        has_context: context.length > 0,
        relevant_notes: context.length,
        sources_info: context.map((doc) => doc.title),
      },
      processing_time: processingTime,
    };
  }

  /**
   * 生成内容摘要
   * @param {String} content - 原始内容
   */
  async generateSummary(content) {
    const systemPrompt = `你是一个专业的内容总结专家。请为学习内容生成高质量的摘要。

要求：
1. 提取核心观点和关键信息
2. 保持逻辑结构清晰
3. 使用简洁专业的语言
4. 摘要长度约为原文的20-30%
5. 突出重要概念和结论`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `请为以下内容生成摘要：\n\n${content}` },
    ];

    const summary = await this.callDeepSeek(messages, {
      temperature: 0.5,
      maxTokens: 1000,
    });

    return {
      summary,
      original_length: content.length,
      summary_length: summary.length,
      compression_ratio: summary.length / content.length,
    };
  }

  /**
   * 生成结构化学习笔记
   * @param {String} content - 学习内容
   * @param {String} title - 标题
   */
  async generateStructuredNotes(content, title = "") {
    const systemPrompt = `你是一个学习笔记专家，擅长将内容转换为结构化的学习笔记。

笔记格式要求：
1. 使用Markdown格式
2. 包含以下部分：
   - 核心概念（定义和解释）
   - 关键要点（重要知识点列表）
   - 实例分析（如果有的话）
   - 总结归纳
   - 相关标签（自动提取3-5个）
3. 使用清晰的层级结构
4. 重要内容用**粗体**标注`;

    const userPrompt = title
      ? `标题：${title}\n\n内容：${content}`
      : `内容：${content}`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `请为以下内容生成结构化学习笔记：\n\n${userPrompt}`,
      },
    ];

    const notes = await this.callDeepSeek(messages, {
      temperature: 0.6,
      maxTokens: 2500,
    });

    // 提取标签
    const tags = await this.extractTags(content);

    return {
      notes,
      tags,
      title: title || (await this.generateTitle(content)),
      key_concepts: this.extractKeyConcepts(notes),
    };
  }

  /**
   * 提取关键标签
   * @param {String} content - 内容
   */
  async extractTags(content) {
    const messages = [
      {
        role: "system",
        content: "从内容中提取3-5个最相关的标签词，用逗号分隔，只返回标签词",
      },
      { role: "user", content: content.substring(0, 1000) },
    ];

    const response = await this.callDeepSeek(messages, {
      temperature: 0.3,
      maxTokens: 50,
    });

    return response
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  /**
   * 生成标题
   * @param {String} content - 内容
   */
  async generateTitle(content) {
    const messages = [
      {
        role: "system",
        content: "为学习内容生成一个简洁准确的标题，不超过20个字",
      },
      { role: "user", content: content.substring(0, 500) },
    ];

    return await this.callDeepSeek(messages, {
      temperature: 0.5,
      maxTokens: 50,
    });
  }

  /**
   * 提取关键概念
   * @param {String} notes - 笔记内容
   */
  extractKeyConcepts(notes) {
    // 简单的关键概念提取
    const concepts = [];
    const lines = notes.split("\n");

    lines.forEach((line) => {
      if (line.includes("**") && line.includes("**")) {
        const matches = line.match(/\*\*(.*?)\*\*/g);
        if (matches) {
          matches.forEach((match) => {
            const concept = match.replace(/\*\*/g, "");
            if (concept.length > 2 && concept.length < 30) {
              concepts.push(concept);
            }
          });
        }
      }
    });

    return [...new Set(concepts)].slice(0, 10);
  }

  /**
   * 分析学习进度和推荐
   * @param {Array} recentNotes - 最近的学习笔记
   */
  async analyzeLearningProgress(recentNotes) {
    if (recentNotes.length === 0) {
      return {
        summary: "暂无学习记录",
        recommendations: ["开始添加你的第一条学习笔记"],
      };
    }

    const topics = recentNotes.map((note) => note.title).join(", ");
    const messages = [
      {
        role: "system",
        content: "分析用户的学习进度，提供个性化建议",
      },
      {
        role: "user",
        content: `最近学习主题：${topics}\n请分析学习进度并给出3条建议`,
      },
    ];

    const analysis = await this.callDeepSeek(messages, {
      temperature: 0.7,
      maxTokens: 500,
    });

    return {
      summary: analysis,
      recommendations: this.parseRecommendations(analysis),
    };
  }

  /**
   * 解析推荐建议
   */
  parseRecommendations(text) {
    const lines = text.split("\n");
    return lines
      .filter((line) => line.match(/^\d+\.|^-|^•/))
      .map((line) => line.replace(/^\d+\.|^-|^•/, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  }
}

export default new AIService();
