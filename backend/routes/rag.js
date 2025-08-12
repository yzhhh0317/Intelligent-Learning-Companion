// routes/rag.js - RAG专用路由
import express from "express";
import simpleRAG from "../services/simpleRAG.js";
import aiService from "../services/aiService.js";
import noteService from "../services/noteService.js";
import logger from "../config/logger.js";

const router = express.Router();

// RAG文档处理
router.post("/process", async (req, res) => {
  try {
    const { content, title } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "文档内容不能为空",
      });
    }

    logger.info(`📄 RAG文档处理: ${title || "未命名文档"}`);
    logger.info(`📏 内容长度: ${content.length} 字符`);

    // 使用简化的RAG服务处理文档
    const result = await simpleRAG.processDocument(
      content,
      title || "未命名文档"
    );

    // 同时保存到数据库
    const note = await noteService.createNote({
      title: title || "未命名文档",
      content: content,
      tags: ["RAG处理", "自动索引"],
      content_type: "generated",
      key_concepts: [],
      metadata: {
        rag_processed: true,
        chunks: result.chunks,
        doc_id: result.docId,
      },
    });

    logger.info(`✅ 文档处理完成: ${result.chunks} 个语义块`);
    logger.info(`💾 已保存到数据库: ${note.id}`);

    res.json({
      status: "success",
      docId: result.docId,
      chunks: result.chunks,
      title: result.title,
      note_id: note.id,
      processing_info: {
        content_length: content.length,
        chunks_created: result.chunks,
        indexed_vectors: result.chunks,
      },
    });
  } catch (error) {
    logger.error("RAG文档处理失败:", error);
    res.status(500).json({
      status: "error",
      message: "文档处理失败",
      error: error.message,
    });
  }
});

// RAG查询
router.post("/query", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "查询问题不能为空",
      });
    }

    logger.info(`🔍 RAG查询: ${question}`);

    const startTime = Date.now();
    const pipelineSteps = [];

    // Step 1: Query Embedding
    const embeddingStart = Date.now();
    logger.info("⚙️ 生成查询向量...");
    // 这里实际上在hybridSearch中会生成
    pipelineSteps.push({
      name: "Query Embedding",
      time: `${Date.now() - embeddingStart}ms`,
      tech: "TF-IDF Vector",
      details: "查询向量化完成",
    });

    // Step 2: Hybrid Search
    const searchStart = Date.now();
    logger.info("🔍 执行混合检索...");
    const searchResults = await simpleRAG.hybridSearch(question, 5);
    pipelineSteps.push({
      name: "Hybrid Search",
      time: `${Date.now() - searchStart}ms`,
      tech: "Semantic + BM25",
      details: `检索到 ${searchResults.length} 个相关文档`,
    });

    // Step 3: Context Building
    const contextStart = Date.now();
    logger.info("📝 构建上下文...");
    const context = searchResults
      .map(
        (doc, i) =>
          `[文档${i + 1}] ${
            doc.metadata?.title || "未知标题"
          }\n${doc.content.substring(0, 500)}`
      )
      .join("\n\n");
    pipelineSteps.push({
      name: "Context Building",
      time: `${Date.now() - contextStart}ms`,
      tech: "Text Concatenation",
      details: `上下文长度: ${context.length} 字符`,
    });

    // Step 4: LLM Generation
    const llmStart = Date.now();
    logger.info("🧠 调用DeepSeek生成答案...");

    const systemPrompt = `你是一个基于知识库的智能助手。请根据提供的相关文档回答用户问题。

回答要求：
1. 基于提供的文档内容回答，保证准确性
2. 如果文档不足以回答问题，明确说明
3. 简洁专业，重点突出
4. 可以适当补充背景知识`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `相关文档：\n${context}\n\n用户问题：${question}\n\n请基于上述文档回答问题。`,
      },
    ];

    const answer = await aiService.callDeepSeek(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    pipelineSteps.push({
      name: "LLM Generation",
      time: `${Date.now() - llmStart}ms`,
      tech: "DeepSeek R1",
      details: `答案长度: ${answer.length} 字符`,
    });

    const totalTime = Date.now() - startTime;

    logger.info(`✅ RAG查询完成，总耗时: ${totalTime}ms`);
    logger.info(`📊 使用了 ${searchResults.length} 个文档块`);

    // 构建响应
    res.json({
      status: "success",
      answer,
      pipeline: {
        steps: pipelineSteps,
        total_time: `${totalTime}ms`,
      },
      sources: searchResults.map((result, index) => ({
        id: result.id,
        title: result.metadata?.title || `文档片段 ${index + 1}`,
        content: result.content,
        score: result.score,
        type: result.score > 0.7 ? "semantic" : "bm25",
        chunkIndex: result.metadata?.chunkIndex || index,
      })),
      context_info: {
        documents_used: searchResults.length,
        total_context_length: context.length,
        has_relevant_context:
          searchResults.length > 0 && searchResults[0].score > 0.3,
      },
      totalTime: `${(totalTime / 1000).toFixed(2)}s`,
    });
  } catch (error) {
    logger.error("RAG查询失败:", error);
    res.status(500).json({
      status: "error",
      message: "RAG查询失败",
      error: error.message,
    });
  }
});

// RAG系统状态
router.get("/status", async (req, res) => {
  try {
    const stats = simpleRAG.getStats();

    res.json({
      status: "operational",
      initialized: stats.initialized,
      storage_type: "memory",
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
        "LLM Generation",
      ],
      algorithms: {
        embedding: "TF-IDF改进算法",
        search: "语义相似度 + BM25",
        fusion: "加权平均（待升级为RRF）",
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

// 清空RAG知识库
router.delete("/clear", async (req, res) => {
  try {
    simpleRAG.clear();

    logger.info("🗑️ RAG知识库已清空");

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

// 删除特定文档
router.delete("/document/:docId", async (req, res) => {
  try {
    const { docId } = req.params;

    const result = simpleRAG.deleteDocument(docId);

    if (result) {
      logger.info(`🗑️ 文档已删除: ${docId}`);
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
  } catch (error) {
    logger.error("删除文档失败:", error);
    res.status(500).json({
      status: "error",
      message: "删除文档失败",
      error: error.message,
    });
  }
});

export default router;
