// backend/server.js - 简化版服务器，快速启动
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// 中间件
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// 简单的内存存储（如果MongoDB连接失败会用这个）
let memoryNotes = [];
let useMemoryDB = false;

// MongoDB模型
let Note;
if (!useMemoryDB) {
  try {
    // 尝试连接MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI ||
        "mongodb://localhost:27017/intelligent-learning"
    );
    console.log("✅ MongoDB连接成功");

    // 定义Note模型
    const noteSchema = new mongoose.Schema({
      id: { type: String, default: () => uuidv4() },
      title: String,
      content: String,
      preview: String,
      tags: [String],
      created_at: { type: Date, default: Date.now },
      content_length: Number,
    });

    Note = mongoose.model("Note", noteSchema);
  } catch (error) {
    console.log("⚠️ MongoDB连接失败，使用内存存储");
    useMemoryDB = true;
  }
}

// ============ DeepSeek AI服务 ============
async function callDeepSeek(messages, temperature = 0.7) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey || apiKey === "你的DeepSeek_API_KEY_在这里填入") {
    console.error("❌ 请在.env文件中配置DEEPSEEK_API_KEY");
    return "请先配置DeepSeek API Key";
  }

  try {
    const response = await axios.post(
      process.env.DEEPSEEK_API_URL,
      {
        model: process.env.DEEPSEEK_MODEL || "deepseek-r1",
        messages,
        stream: false,
        temperature,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 600000,
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("DeepSeek API错误:", error.response?.data || error.message);
    throw new Error("AI服务暂时不可用");
  }
}

// ============ 简单的向量搜索（模拟） ============
function simpleSearch(query, notes) {
  // 简单的关键词匹配（真实项目应该用向量数据库）
  const queryWords = query.toLowerCase().split(/\s+/);

  const results = notes
    .map((note) => {
      const text = `${note.title} ${note.content}`.toLowerCase();
      let score = 0;

      queryWords.forEach((word) => {
        if (text.includes(word)) {
          score += 1;
        }
      });

      return { ...note, similarity: score / queryWords.length };
    })
    .filter((note) => note.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  return results;
}

// ============ API路由 ============

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      mongodb: useMemoryDB ? "using memory" : "connected",
      deepseek: process.env.DEEPSEEK_API_KEY ? "configured" : "not configured",
    },
  });
});

// RAG问答 - 核心功能
app.post("/api/chat/ask", async (req, res) => {
  try {
    const { question, use_rag, current_content } = req.body;

    let context = [];

    // 如果启用RAG，搜索相关笔记
    if (use_rag) {
      const notes = useMemoryDB ? memoryNotes : await Note.find({}).limit(100);
      context = simpleSearch(question, notes);
      console.log(`🔍 找到 ${context.length} 条相关笔记`);
    }

    // 构建prompt
    const systemPrompt = `你是一个专业的学习助手。基于提供的上下文回答问题，如果没有相关上下文，使用你的知识回答。回答要准确、专业、易懂。`;

    const contextText =
      context.length > 0
        ? `\n相关笔记：\n${context
            .map((doc) => `${doc.title}：${doc.content?.substring(0, 500)}`)
            .join("\n\n")}`
        : "";

    const userPrompt = `${contextText}\n\n问题：${question}`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const startTime = Date.now();
    const answer = await callDeepSeek(messages);
    const processingTime = (Date.now() - startTime) / 1000;

    res.json({
      answer,
      sources_used: context.length,
      context_info: {
        has_context: context.length > 0,
        relevant_notes: context.length,
        sources_info: context.map((c) => c.title),
      },
      processing_time: processingTime,
    });
  } catch (error) {
    console.error("问答错误:", error);
    res.status(500).json({ error: error.message });
  }
});

// 生成摘要
app.post("/api/chat/summary", async (req, res) => {
  try {
    const { content } = req.body;

    const messages = [
      { role: "system", content: "请生成内容的简洁摘要，保留核心要点。" },
      { role: "user", content: `请为以下内容生成摘要：\n\n${content}` },
    ];

    const summary = await callDeepSeek(messages, 0.5);

    res.json({
      summary,
      original_length: content.length,
      compression_ratio: summary.length / content.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 生成结构化笔记
app.post("/api/chat/generate-notes", async (req, res) => {
  try {
    const { content, title, auto_save } = req.body;

    const messages = [
      {
        role: "system",
        content: "将内容转换为结构化的Markdown笔记，包含核心概念、要点和总结。",
      },
      {
        role: "user",
        content: `标题：${title || "学习笔记"}\n\n内容：${content}`,
      },
    ];

    const notes = await callDeepSeek(messages, 0.6);

    // 自动保存
    let savedNote = null;
    if (auto_save) {
      const noteData = {
        id: uuidv4(),
        title: title || "学习笔记",
        content: notes,
        preview: notes.substring(0, 200),
        tags: ["学习", "AI生成"],
        created_at: new Date(),
        content_length: notes.length,
      };

      if (useMemoryDB) {
        memoryNotes.push(noteData);
        savedNote = noteData;
      } else {
        savedNote = await new Note(noteData).save();
      }
    }

    res.json({
      notes,
      title: title || "学习笔记",
      tags: ["学习", "AI生成"],
      saved: !!savedNote,
      note_id: savedNote?.id,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 语义搜索
app.post("/api/notes/search", async (req, res) => {
  try {
    const { query } = req.body;
    const notes = useMemoryDB ? memoryNotes : await Note.find({}).limit(100);
    const results = simpleSearch(query, notes);

    res.json({
      results: results.map((r) => ({
        id: r.id,
        content: r.content,
        preview: r.preview || r.content?.substring(0, 200),
        metadata: {
          id: r.id,
          title: r.title,
          tags: r.tags?.join(",") || "",
          created_at: r.created_at,
          content_length: r.content_length,
        },
        similarity: r.similarity,
      })),
      total_found: results.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取最近笔记
app.get("/api/notes/recent", async (req, res) => {
  try {
    let notes = [];

    if (useMemoryDB) {
      notes = memoryNotes.slice(-10).reverse();
    } else {
      notes = await Note.find({}).sort("-created_at").limit(10);
    }

    res.json({ notes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 知识库统计
app.get("/api/notes/stats", async (req, res) => {
  try {
    const total = useMemoryDB
      ? memoryNotes.length
      : await Note.countDocuments();

    res.json({
      total_notes: total,
      recent_notes_count: Math.min(total, 10),
      popular_tags: [
        ["学习", total],
        ["AI生成", Math.floor(total * 0.7)],
      ],
      last_updated: new Date().toISOString(),
      database_status: useMemoryDB ? "memory" : "mongodb",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建笔记
app.post("/api/notes/create", async (req, res) => {
  try {
    const { title, content, tags } = req.body;

    const noteData = {
      id: uuidv4(),
      title,
      content,
      preview: content.substring(0, 200),
      tags: tags || [],
      created_at: new Date(),
      content_length: content.length,
    };

    let note;
    if (useMemoryDB) {
      memoryNotes.push(noteData);
      note = noteData;
    } else {
      note = await new Note(noteData).save();
    }

    res.json({ note });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 演示信息
app.get("/api/demo-info", (req, res) => {
  res.json({
    demo_scenarios: [
      {
        name: "技术文档学习",
        description: "粘贴技术文档，生成结构化笔记",
        example_questions: ["React和Vue的区别？"],
      },
    ],
    rag_features: ["语义搜索", "智能问答", "自动摘要", "结构化笔记"],
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📚 智能学习伴侣后端已启动`);

  if (
    !process.env.DEEPSEEK_API_KEY ||
    process.env.DEEPSEEK_API_KEY === "你的DeepSeek_API_KEY_在这里填入"
  ) {
    console.log("⚠️  请在.env文件中配置DEEPSEEK_API_KEY");
  }
});
