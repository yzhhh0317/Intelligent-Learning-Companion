import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保.env文件被正确加载
dotenv.config({
  path: path.join(__dirname, ".env"),
});

// 验证必需的环境变量
const validateEnvironment = () => {
  console.log("🔍 验证环境变量...");

  const requiredVars = ["DEEPSEEK_API_KEY", "DEEPSEEK_API_URL", "MONGODB_URI"];

  const optionalVars = ["HUGGINGFACE_API_KEY"];

  const missingRequired = requiredVars.filter((varName) => {
    const value = process.env[varName];
    console.log(`   ${varName}: ${value ? "✅ 已配置" : "❌ 未配置"}`);
    return !value;
  });

  optionalVars.forEach((varName) => {
    const value = process.env[varName];
    console.log(
      `   ${varName}: ${value ? "✅ 已配置" : "⚠️ 未配置（将使用备用方案）"}`
    );
  });

  if (missingRequired.length > 0) {
    console.error(`❌ 缺少必需的环境变量: ${missingRequired.join(", ")}`);
    console.error("💡 请检查backend目录下的.env文件");
    return false;
  }

  console.log("✅ 环境变量验证通过");

  if (process.env.HUGGINGFACE_API_KEY) {
    console.log("🚀 检测到HuggingFace API Key，将使用高质量向量化");
  } else {
    console.log("⚠️ 未配置HuggingFace API Key，将使用改进的TF-IDF算法");
  }

  return true;
};

const app = express();
const PORT = process.env.PORT || 8000;

// ============ 中间件配置 ============
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 详细的请求日志中间件
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 400 ? "🔴" : "🟢";
    console.log(
      `${statusColor} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ============ 强制数据库连接 ============
async function connectDatabase() {
  try {
    console.log("📊 连接MongoDB数据库...");
    console.log(`🔗 连接地址: ${process.env.MONGODB_URI}`);

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5秒超时
      socketTimeoutMS: 45000, // 45秒socket超时
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB连接错误:", err);
      console.error("💥 数据库连接丢失，服务器将停止运行");
      process.exit(1); // 强制退出
    });

    mongoose.connection.on("disconnected", () => {
      console.error("❌ MongoDB连接断开");
      console.error("💥 数据库连接丢失，服务器将停止运行");
      process.exit(1); // 强制退出
    });

    console.log("✅ MongoDB连接成功");
    return true;
  } catch (error) {
    console.error("❌ MongoDB连接失败:", error);
    console.error("💡 请确保MongoDB正在运行并检查以下配置:");
    console.error("   1. MongoDB服务是否启动");
    console.error("   2. MONGODB_URI是否正确");
    console.error("   3. 网络连接是否正常");
    console.error("   4. 数据库权限是否正确");
    throw error;
  }
}

// ============ 加载增强服务 ============
let enhancedRAG = null;
let aiService = null;

async function loadServices() {
  try {
    console.log("🧠 加载增强版RAG服务...");
    const { default: ragModule } = await import("./services/enhancedRAG.js");
    await ragModule.initialize();
    enhancedRAG = ragModule;
    console.log("✅ 增强版RAG服务加载成功");

    // 显示RAG服务详情
    const stats = enhancedRAG.getStats();
    console.log("📊 RAG服务状态:");
    console.log(`   • 向量化方法: ${stats.embedding_method}`);
    console.log(`   • 向量维度: ${stats.vector_dimension}`);
    console.log(`   • 已加载文档: ${stats.totalDocuments}`);
    console.log(`   • 已加载向量: ${stats.totalChunks}`);
    if (stats.huggingface_model) {
      console.log(`   • HuggingFace模型: ${stats.huggingface_model}`);
    }
  } catch (error) {
    console.error("❌ 增强版RAG服务加载失败:", error);
    console.error("💥 RAG服务是核心功能，加载失败将停止服务器");
    throw error;
  }

  try {
    console.log("🤖 加载AI服务...");
    const { default: aiModule } = await import("./services/aiService.js");
    aiService = aiModule;
    console.log("✅ AI服务加载成功");
  } catch (error) {
    console.error("❌ AI服务加载失败:", error);
    console.error("💥 AI服务是核心功能，加载失败将停止服务器");
    throw error;
  }
}

// 健康检查（显示更多信息）
app.get("/api/health", async (req, res) => {
  const mongoStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const ragStats = enhancedRAG
    ? enhancedRAG.getStats()
    : { initialized: false };

  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: {
        status: mongoStatus,
        database: mongoose.connection.db?.databaseName || "unknown",
      },
      deepseek: {
        configured: !!process.env.DEEPSEEK_API_KEY,
        model: process.env.DEEPSEEK_MODEL || "deepseek-r1",
      },
      huggingface: {
        configured: !!process.env.HUGGINGFACE_API_KEY,
        model: ragStats.huggingface_model || "not_used",
      },
      enhancedRAG: {
        status: enhancedRAG ? "loaded" : "failed",
        embedding_method: ragStats.embedding_method,
        vector_dimension: ragStats.vector_dimension,
      },
      aiService: aiService ? "loaded" : "failed",
    },
    rag_stats: ragStats,
    version: "2.0.0-optimized",
    features: [
      "强制数据库依赖",
      "HuggingFace Embeddings",
      "Reciprocal Rank Fusion",
      "向量维度自动升级",
      "改进的TF-IDF备用算法",
    ],
  });
});

// 清理并重建RAG索引
app.post("/api/rag/rebuild", async (req, res) => {
  try {
    console.log("🧹 开始清理并重建RAG索引...");

    // 1. 清空当前向量存储
    enhancedRAG.clear();
    console.log("✅ 已清空向量存储");

    // 2. 从数据库重新加载所有笔记
    const { default: Note } = await import("./models/Note.js");
    const allNotes = await Note.find({ deleted: false });
    console.log(`📚 找到 ${allNotes.length} 条笔记需要重新索引`);

    // 3. 重新建立向量索引
    let processedCount = 0;
    let successCount = 0;

    for (const note of allNotes) {
      try {
        processedCount++;
        console.log(
          `🔄 处理笔记 ${processedCount}/${allNotes.length}: ${note.title}`
        );

        // 使用现有笔记ID重新建立索引
        await enhancedRAG.processDocument(note.content, note.title, note.id);
        successCount++;
      } catch (error) {
        console.error(`❌ 处理笔记失败: ${note.title}`, error.message);
      }
    }

    const stats = enhancedRAG.getStats();

    console.log("✅ RAG索引重建完成!");
    console.log(`📊 处理统计: ${successCount}/${processedCount} 成功`);

    res.json({
      status: "success",
      message: "RAG索引重建完成",
      statistics: {
        total_notes: allNotes.length,
        processed_count: processedCount,
        success_count: successCount,
        failed_count: processedCount - successCount,
        current_stats: stats,
      },
    });
  } catch (error) {
    console.error("❌ RAG索引重建失败:", error);
    res.status(500).json({
      status: "error",
      message: "RAG索引重建失败",
      error: error.message,
    });
  }
});

// 笔记统计（强制数据库查询）
app.get("/api/notes/stats", async (req, res) => {
  try {
    console.log("📊 获取笔记统计信息...");

    const { default: Note } = await import("./models/Note.js");
    const dbStats = await Note.getStatistics();

    const ragStats = enhancedRAG.getStats();

    const combinedStats = {
      ...dbStats,
      rag_info: {
        total_documents: ragStats.totalDocuments,
        total_vectors: ragStats.totalChunks,
        memory_usage_mb: Math.round(ragStats.memoryUsage),
        initialized: ragStats.initialized,
        embedding_method: ragStats.embedding_method,
        vector_dimension: ragStats.vector_dimension,
        embedding_distribution: ragStats.embedding_distribution,
      },
      database_status: "mongodb_required",
    };

    console.log(
      `✅ 统计信息获取成功: ${dbStats.total_notes} 笔记，${ragStats.totalChunks} 向量`
    );
    res.json(combinedStats);
  } catch (error) {
    console.error("❌ 获取统计失败:", error);
    res.status(500).json({
      status: "error",
      message: "获取统计失败，数据库查询错误",
      error: error.message,
    });
  }
});

// 最近笔记（强制数据库查询）
app.get("/api/notes/recent", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    console.log(`📚 获取最近 ${days} 天的笔记...`);

    const { default: Note } = await import("./models/Note.js");
    const notes = await Note.getRecentNotes(days);

    console.log(`✅ 成功获取 ${notes.length} 条最近笔记`);
    res.json({
      status: "success",
      notes,
      period_days: days,
      database_source: "mongodb",
    });
  } catch (error) {
    console.error("❌ 获取最近笔记失败:", error);
    res.status(500).json({
      status: "error",
      message: "获取笔记失败，数据库查询错误",
      error: error.message,
    });
  }
});

// 增强的语义搜索（修复版）
app.post("/api/notes/search", async (req, res) => {
  try {
    const { query, n_results = 10, min_similarity = 0.1 } = req.body; // 降低阈值，增加返回数量

    if (!query) {
      return res.status(400).json({
        status: "error",
        message: "搜索查询不能为空",
      });
    }

    console.log(`🔍 增强语义搜索: "${query}"`);
    console.log(
      `📊 搜索参数: n_results=${n_results}, min_similarity=${min_similarity}`
    );
    const startTime = Date.now();

    // 1. 执行增强混合搜索
    const searchResults = await enhancedRAG.hybridSearch(query, n_results);
    console.log(`🔍 混合搜索返回 ${searchResults.length} 条原始结果`);

    // 2. 同时执行简单文本匹配作为备用
    let textMatchResults = [];
    try {
      const { default: Note } = await import("./models/Note.js");
      const queryRegex = new RegExp(query, "gi"); // 全局、忽略大小写

      const textMatches = await Note.find({
        $or: [
          { title: queryRegex },
          { content: queryRegex },
          { tags: { $regex: query, $options: "i" } },
        ],
        deleted: false,
      }).limit(5);

      textMatchResults = textMatches.map((note, index) => ({
        id: `text_match_${note.id}`,
        content: note.content,
        metadata: {
          id: note.id,
          title: note.title,
          tags: note.tags.join(", "),
          created_at: note.created_at,
          content_length: note.content.length,
          chunkIndex: 0,
          embeddingMethod: "text_match",
        },
        similarity: 0.8 - index * 0.1, // 给文本匹配较高的基础分数
        match_type: "text_match",
      }));

      console.log(`📝 文本匹配找到 ${textMatchResults.length} 条结果`);
    } catch (textError) {
      console.warn("文本匹配失败:", textError.message);
    }

    // 3. 合并结果，去重
    const allResults = [...searchResults, ...textMatchResults];
    const uniqueResults = [];
    const seenIds = new Set();

    allResults.forEach((result) => {
      const noteId = result.metadata?.id || result.id;
      if (!seenIds.has(noteId)) {
        seenIds.add(noteId);
        uniqueResults.push(result);
      }
    });

    // 4. 按相似度排序，过滤
    const filteredResults = uniqueResults
      .sort((a, b) => b.similarity - a.similarity)
      .filter((result) => result.similarity >= min_similarity)
      .slice(0, n_results)
      .map((result) => ({
        id: result.id,
        content: result.content,
        preview:
          result.content.substring(0, 300) +
          (result.content.length > 300 ? "..." : ""),
        metadata: {
          id: result.metadata?.id || result.id,
          title: result.metadata?.title || "未命名",
          tags: result.metadata?.tags || "",
          created_at: result.metadata?.created_at || new Date().toISOString(),
          content_length: result.content.length,
          chunkIndex: result.metadata?.chunkIndex || 0,
          embeddingMethod: result.metadata?.embeddingMethod || "unknown",
        },
        similarity: result.similarity,
        match_type: result.match_type || "semantic",
        fusion_details: result.fusion_details, // RRF详情
      }));

    const processingTime = Date.now() - startTime;
    console.log(
      `✅ 搜索完成: 原始${allResults.length}条 → 去重${uniqueResults.length}条 → 过滤${filteredResults.length}条 (${processingTime}ms)`
    );

    // 5. 如果没有结果，提供调试信息
    if (filteredResults.length === 0) {
      console.warn(`⚠️ 未找到匹配结果，调试信息:`);
      console.warn(`   - 查询词: "${query}"`);
      console.warn(`   - 最小相似度: ${min_similarity}`);
      console.warn(`   - 原始结果数: ${searchResults.length}`);
      console.warn(`   - 文本匹配数: ${textMatchResults.length}`);

      if (allResults.length > 0) {
        const topResult = allResults[0];
        console.warn(`   - 最高分数: ${topResult.similarity}`);
        console.warn(
          `   - 建议降低min_similarity到: ${Math.max(
            0.05,
            topResult.similarity - 0.1
          )}`
        );
      }
    }

    res.json({
      status: "success",
      results: filteredResults,
      total_found: filteredResults.length,
      search_info: {
        query,
        min_similarity,
        total_candidates: allResults.length,
        unique_candidates: uniqueResults.length,
        processing_time: processingTime,
        search_method: "enhanced_hybrid_with_text_fallback",
      },
      debug_info:
        filteredResults.length === 0
          ? {
              suggestion: "尝试降低相似度阈值或调整搜索词",
              raw_results_count: searchResults.length,
              text_match_count: textMatchResults.length,
              top_score: allResults.length > 0 ? allResults[0].similarity : 0,
            }
          : null,
    });
  } catch (error) {
    console.error("❌ 增强搜索失败:", error);
    res.status(500).json({
      status: "error",
      message: "搜索失败",
      error: error.message,
    });
  }
});

// 智能问答（使用增强RAG）
app.post("/api/chat/ask", async (req, res) => {
  try {
    const { question, current_content, use_rag } = req.body;

    if (!question) {
      return res.status(400).json({
        status: "error",
        message: "问题不能为空",
      });
    }

    console.log(`💬 收到问题: ${question} (增强RAG: ${use_rag})`);

    let context = [];
    let contextInfo = {
      has_context: false,
      relevant_notes: 0,
      sources_info: [],
      search_method: use_rag ? "enhanced_hybrid_rrf" : "none",
    };

    // 如果启用RAG，使用增强搜索
    if (use_rag) {
      const searchResults = await enhancedRAG.hybridSearch(question, 3);

      if (searchResults.length > 0) {
        context = searchResults.map((result) => ({
          id: result.id,
          title: result.metadata?.title || "未知标题",
          content: result.content,
          score: result.score,
          embeddingMethod: result.metadata?.embeddingMethod,
        }));

        contextInfo = {
          has_context: true,
          relevant_notes: context.length,
          sources_info: context.map((c) => `${c.title} (${c.embeddingMethod})`),
          search_method: "enhanced_hybrid_rrf",
          min_score: Math.min(...context.map((c) => c.score)),
          max_score: Math.max(...context.map((c) => c.score)),
        };
      }

      console.log(`🔍 增强检索到 ${context.length} 条相关文档`);
    }

    // 调用AI生成答案
    const startTime = Date.now();
    const response = await aiService.ragAnswer(
      question,
      context,
      current_content
    );
    const processingTime = (Date.now() - startTime) / 1000;

    console.log(`✅ 智能问答完成，耗时: ${processingTime.toFixed(2)}s`);

    res.json({
      status: "success",
      answer: response.answer,
      sources_used: context.length,
      context_info: contextInfo,
      processing_time: processingTime,
      rag_enabled: use_rag,
      enhancement_info: {
        search_method: use_rag ? "enhanced_hybrid_rrf" : "none",
        vector_quality:
          use_rag && context.length > 0
            ? context[0].embeddingMethod
            : "not_applicable",
      },
    });
  } catch (error) {
    console.error("❌ 智能问答失败:", error);
    res.status(500).json({
      status: "error",
      message: "问答处理失败",
      error: error.message,
    });
  }
});

// 生成摘要
app.post("/api/chat/summary", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        status: "error",
        message: "内容不能为空",
      });
    }

    console.log(`📄 生成摘要，原文长度: ${content.length}`);

    const result = await aiService.generateSummary(content);

    console.log(
      `✅ 摘要生成完成，压缩比: ${(result.compression_ratio * 100).toFixed(1)}%`
    );

    res.json({
      status: "success",
      summary: result.summary,
      original_length: result.original_length,
      summary_length: result.summary_length,
      compression_ratio: result.compression_ratio,
    });
  } catch (error) {
    console.error("❌ 摘要生成失败:", error);
    res.status(500).json({
      status: "error",
      message: "摘要生成失败",
      error: error.message,
    });
  }
});

// 生成结构化笔记（强制保存到数据库）
app.post("/api/chat/generate-notes", async (req, res) => {
  try {
    const { content, title, tags, auto_save = true } = req.body;

    if (!content) {
      return res.status(400).json({
        status: "error",
        message: "内容不能为空",
      });
    }

    console.log(`📝 生成结构化笔记: ${title || "无标题"}`);

    // 生成笔记
    const result = await aiService.generateStructuredNotes(content, title);

    let savedNote = null;
    let ragProcessed = false;

    // 强制保存到数据库（如果auto_save为true）
    if (auto_save) {
      try {
        const { default: noteService } = await import(
          "./services/noteService.js"
        );

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
            enhanced_rag: true,
          },
        });

        console.log(`💾 笔记已保存到数据库: ${savedNote.id}`);

        // 使用增强RAG建立向量索引
        try {
          const processResult = await enhancedRAG.processDocument(
            result.notes,
            result.title
          );
          ragProcessed = true;
          console.log(`🧠 已建立增强向量索引: ${savedNote.id}`);
          console.log(`🔢 向量化方法: ${processResult.embedding_method}`);
        } catch (ragError) {
          console.warn(`⚠️ 向量索引失败: ${ragError.message}`);
        }
      } catch (saveError) {
        console.error("❌ 保存笔记失败:", saveError);
        return res.status(500).json({
          status: "error",
          message: "笔记生成成功但保存失败",
          error: saveError.message,
        });
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
        saved_to_database: !!savedNote,
        vector_indexed: ragProcessed,
      },
    });
  } catch (error) {
    console.error("❌ 笔记生成失败:", error);
    res.status(500).json({
      status: "error",
      message: "笔记生成失败",
      error: error.message,
    });
  }
});

// 增强RAG文档处理
app.post("/api/rag/process", async (req, res) => {
  try {
    const { content, title } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "文档内容不能为空",
      });
    }

    console.log(`📄 增强RAG文档处理: ${title || "未命名文档"}`);

    const result = await enhancedRAG.processDocument(
      content,
      title || "未命名文档"
    );

    // 强制保存到数据库
    let savedNote = null;
    try {
      const { default: noteService } = await import(
        "./services/noteService.js"
      );
      savedNote = await noteService.createNote({
        title: title || "未命名文档",
        content: content,
        tags: ["RAG处理", "增强向量", result.embedding_method],
        content_type: "generated",
        metadata: {
          rag_processed: true,
          chunks: result.chunks,
          doc_id: result.docId,
          embedding_method: result.embedding_method,
          vector_dimension: result.vector_dimension,
        },
      });
      console.log(`💾 已保存到数据库: ${savedNote.id}`);
    } catch (saveError) {
      console.error("❌ 保存到数据库失败:", saveError);
      return res.status(500).json({
        status: "error",
        message: "文档处理成功但保存失败",
        error: saveError.message,
      });
    }

    console.log(`✅ 增强文档处理完成: ${result.chunks} 个语义块`);

    res.json({
      status: "success",
      docId: result.docId,
      chunks: result.chunks,
      title: result.title,
      note_id: savedNote.id,
      enhancement_info: {
        embedding_method: result.embedding_method,
        vector_dimension: result.vector_dimension,
        saved_to_database: true,
      },
      processing_info: {
        content_length: content.length,
        chunks_created: result.chunks,
        indexed_vectors: result.chunks,
      },
    });
  } catch (error) {
    console.error("❌ 增强RAG文档处理失败:", error);
    res.status(500).json({
      status: "error",
      message: "文档处理失败",
      error: error.message,
    });
  }
});

// 增强RAG查询
app.post("/api/rag/query", async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "查询问题不能为空",
      });
    }

    console.log(`🔍 增强RAG查询: ${question}`);

    const startTime = Date.now();
    const pipelineSteps = [];

    // Step 1: Enhanced Hybrid Search with RRF
    const searchStart = Date.now();
    const searchResults = await enhancedRAG.hybridSearch(question, 5);
    pipelineSteps.push({
      name: "Enhanced Hybrid Search",
      time: `${Date.now() - searchStart}ms`,
      tech: "HuggingFace + RRF",
      details: `检索到 ${searchResults.length} 个相关文档`,
    });

    // Step 2: Context Building
    const contextStart = Date.now();
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

    // Step 3: Enhanced LLM Generation
    const llmStart = Date.now();
    const messages = [
      {
        role: "system",
        content:
          "你是一个基于增强知识库的智能助手。使用高质量的向量检索和RRF算法，你可以提供更准确的答案。请根据提供的相关文档回答问题。",
      },
      {
        role: "user",
        content: `相关文档（使用增强向量检索）：\n${context}\n\n用户问题：${question}\n\n请基于上述文档回答问题。`,
      },
    ];

    const answer = await aiService.callDeepSeek(messages, {
      temperature: 0.7,
      maxTokens: 2000,
    });

    pipelineSteps.push({
      name: "Enhanced LLM Generation",
      time: `${Date.now() - llmStart}ms`,
      tech: "DeepSeek + Enhanced Context",
      details: `答案长度: ${answer.length} 字符`,
    });

    const totalTime = Date.now() - startTime;

    console.log(`✅ 增强RAG查询完成，总耗时: ${totalTime}ms`);

    res.json({
      status: "success",
      answer,
      pipeline: {
        steps: pipelineSteps,
        total_time: `${totalTime}ms`,
        enhancement: "HuggingFace + RRF + Enhanced Context",
      },
      sources: searchResults.map((result, index) => ({
        id: result.id,
        title: result.metadata?.title || `文档片段 ${index + 1}`,
        content: result.content,
        score: result.score,
        type: result.score > 0.7 ? "high_quality_semantic" : "enhanced_hybrid",
        chunkIndex: result.metadata?.chunkIndex || index,
        embeddingMethod: result.metadata?.embeddingMethod || "unknown",
        fusion_details: result.fusion_details,
      })),
      context_info: {
        documents_used: searchResults.length,
        total_context_length: context.length,
        has_relevant_context:
          searchResults.length > 0 && searchResults[0].score > 0.3,
        enhancement_active: true,
      },
      totalTime: `${(totalTime / 1000).toFixed(2)}s`,
    });
  } catch (error) {
    console.error("❌ 增强RAG查询失败:", error);
    res.status(500).json({
      status: "error",
      message: "增强RAG查询失败",
      error: error.message,
    });
  }
});

// 笔记管理路由
app.post("/api/notes/create", async (req, res) => {
  try {
    const { title, content, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        status: "error",
        message: "标题和内容不能为空",
      });
    }

    const { default: Note } = await import("./models/Note.js");
    const note = new Note({
      title,
      content,
      tags: tags || [],
    });

    await note.save();
    console.log(`📝 创建笔记: ${note.title} (ID: ${note.id})`);

    // 使用增强RAG建立向量索引
    try {
      const processResult = await enhancedRAG.processDocument(content, title);
      console.log(
        `🧠 增强向量索引创建成功: ${note.id} (${processResult.embedding_method})`
      );
    } catch (ragError) {
      console.warn(`⚠️ 向量索引失败: ${ragError.message}`);
    }

    res.json({
      status: "success",
      note,
      message: "笔记创建成功",
      enhancement: "enhanced_vector_indexing",
    });
  } catch (error) {
    console.error("❌ 创建笔记失败:", error);
    res.status(500).json({
      status: "error",
      message: "创建笔记失败",
      error: error.message,
    });
  }
});

app.put("/api/notes/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        status: "error",
        message: "标题和内容不能为空",
      });
    }

    const { default: Note } = await import("./models/Note.js");
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
    console.log(`📝 笔记更新: ${note.title} (ID: ${note.id})`);

    // 重新建立增强向量索引
    try {
      const processResult = await enhancedRAG.processDocument(content, title);
      console.log(
        `🧠 增强向量索引更新成功: ${note.id} (${processResult.embedding_method})`
      );
    } catch (ragError) {
      console.warn(`⚠️ 向量索引更新失败: ${ragError.message}`);
    }

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
      enhancement: "enhanced_vector_reindexing",
    });
  } catch (error) {
    console.error("❌ 更新笔记失败:", error);
    res.status(500).json({
      status: "error",
      message: "更新笔记失败",
      error: error.message,
    });
  }
});

app.delete("/api/notes/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { default: Note } = await import("./models/Note.js");
    const note = await Note.findOne({ id });

    if (!note) {
      return res.status(404).json({
        status: "error",
        message: "笔记不存在",
      });
    }

    // 软删除
    await note.softDelete();
    console.log(`🗑️ 笔记删除: ${note.title} (ID: ${note.id})`);

    // 从增强RAG中删除
    try {
      await enhancedRAG.deleteDocument(id);
      console.log(`🧠 增强向量索引删除成功: ${id}`);
    } catch (ragError) {
      console.warn(`⚠️ 向量索引删除失败: ${ragError.message}`);
    }

    res.json({
      status: "success",
      message: "笔记已删除",
    });
  } catch (error) {
    console.error("❌ 删除笔记失败:", error);
    res.status(500).json({
      status: "error",
      message: "删除笔记失败",
      error: error.message,
    });
  }
});

// 性能评估
app.post("/api/evaluation/run", async (req, res) => {
  try {
    const { default: evaluationService } = await import(
      "./services/evaluation.js"
    );
    const report = await evaluationService.generateReport();

    console.log(
      `📊 评估完成: 综合得分 ${report.executive_summary.overallScore}`
    );
    res.json(report);
  } catch (error) {
    console.error("❌ 评估失败:", error);
    res.status(500).json({
      status: "error",
      message: "性能评估失败",
      error: error.message,
    });
  }
});

// 演示信息
app.get("/api/demo-info", (req, res) => {
  const ragStats = enhancedRAG ? enhancedRAG.getStats() : {};

  res.json({
    demo_scenarios: [
      {
        name: "增强RAG Pipeline演示",
        description: "展示完整的增强检索生成流程",
        example_questions: [
          "什么是RAG技术？",
          "如何实现语义搜索？",
          "React和Vue的区别是什么？",
        ],
        enhancements: [
          "HuggingFace高质量向量",
          "Reciprocal Rank Fusion算法",
          "自动向量维度升级",
        ],
      },
    ],
    rag_features: [
      "HuggingFace Embeddings集成",
      "真正的RRF混合检索",
      "强制数据库持久化",
      "向量维度自动升级",
      "改进的TF-IDF备用算法",
      "DeepSeek LLM生成",
    ],
    tech_stack: {
      frontend: "Vue 3 + Pinia",
      backend: "Node.js + Express",
      database: "MongoDB (Required)",
      ai_model: "DeepSeek R1",
      vector_store: "Enhanced Memory + MongoDB",
      embedding: ragStats.embedding_method || "Enhanced TF-IDF",
      search_algorithm: "Reciprocal Rank Fusion",
    },
    version: "2.0.0-optimized",
  });
});

// 404处理
app.use("*", (req, res) => {
  console.warn(`❓ 404 - 路径未找到: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: "error",
    message: "API路径未找到",
    version: "2.0.0-optimized",
  });
});

// 全局错误处理
app.use((error, req, res, next) => {
  console.error(`💥 服务器错误: ${error.message}`);
  res.status(500).json({
    status: "error",
    message:
      process.env.NODE_ENV === "development" ? error.message : "内部服务器错误",
  });
});

// ============ 启动优化版服务器 ============
async function startServer() {
  try {
    console.log("🚀 正在启动智能学习伴侣后端服务（第二阶段优化版）...");

    // 0. 验证环境变量
    if (!validateEnvironment()) {
      console.error("❌ 环境变量验证失败，服务器停止启动");
      process.exit(1);
    }

    // 1. 强制连接数据库
    await connectDatabase();

    // 2. 加载增强服务
    await loadServices();

    // 3. 启动HTTP服务器
    app.listen(PORT, () => {
      console.log("━".repeat(70));
      console.log(`🎉 智能学习伴侣后端启动成功（第二阶段优化版）!`);
      console.log(`🌐 服务地址: http://localhost:${PORT}`);
      console.log("━".repeat(70));
      console.log("✅ 优化特性:");
      console.log(`   • 数据库: MongoDB (强制依赖) ✅`);
      console.log(`   • AI服务: DeepSeek R1 ✅`);
      console.log(`   • 向量化: ${enhancedRAG.getStats().embedding_method} ✅`);
      console.log(`   • 搜索算法: Reciprocal Rank Fusion ✅`);
      console.log(
        `   • 向量维度: ${enhancedRAG.getStats().vector_dimension} ✅`
      );
      console.log(`   • 自动升级: 向量维度兼容 ✅`);
      console.log("━".repeat(70));
      console.log("📋 增强功能:");
      console.log("   • POST /api/rag/process - 增强文档处理");
      console.log("   • POST /api/rag/query - 增强RAG查询");
      console.log("   • POST /api/notes/search - 增强语义搜索");
      console.log("   • POST /api/chat/ask - 增强智能问答");
      console.log("   • 所有CRUD操作强制使用数据库");
      console.log("━".repeat(70));

      if (process.env.HUGGINGFACE_API_KEY) {
        console.log("🚀 HuggingFace增强功能已激活!");
      } else {
        console.log("⚠️  建议配置HUGGINGFACE_API_KEY以获得最佳向量质量");
      }
    });
  } catch (error) {
    console.error("💥 优化版服务器启动失败:", error);
    console.error("💡 这通常是因为:");
    console.error("   1. MongoDB连接失败");
    console.error("   2. 核心服务加载失败");
    console.error("   3. 环境变量配置错误");
    process.exit(1);
  }
}

// 优雅关闭处理
process.on("SIGTERM", () => {
  console.log("👋 收到SIGTERM信号，正在优雅关闭优化版服务器...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("👋 收到SIGINT信号，正在优雅关闭优化版服务器...");
  process.exit(0);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 未处理的Promise拒绝:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("💥 未捕获的异常:", error);
  process.exit(1);
});

// 启动优化版服务器
startServer();
