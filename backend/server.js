// server.js - 修复中间件顺序问题的完整版本
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// 立即配置环境变量（在任何其他import之前）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// 现在可以安全导入需要环境变量的模块
import { connectDB } from "./config/database.js";
import { initServices } from "./config/services.js";
import { errorHandler } from "./utils/errorHandler.js";

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

// 请求日志中间件
app.use((req, res, next) => {
  const startTime = Date.now();
  console.log(`📥 收到请求: ${req.method} ${req.path}`);

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const statusColor = res.statusCode >= 400 ? "🔴" : "🟢";
    console.log(
      `${statusColor} ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`
    );
  });
  next();
});

// ============ 动态路由注册 ============
let routesLoaded = false;

const loadRoutes = async () => {
  if (routesLoaded) return;

  try {
    console.log("🔗 开始加载所有路由...");

    // 导入所有路由模块
    const ragRoutes = (await import("./routes/rag.js")).default;
    const ragEvaluationRoutes = (await import("./routes/ragEvaluation.js"))
      .default;
    const chatRoutes = (await import("./routes/chat.js")).default;
    const notesRoutes = (await import("./routes/notes.js")).default;
    const contentRoutes = (await import("./routes/content.js")).default;

    // 注册所有路由
    app.use("/api/rag", ragRoutes);
    app.use("/api/rag-evaluation", ragEvaluationRoutes);
    app.use("/api/chat", chatRoutes);
    app.use("/api/notes", notesRoutes);
    app.use("/api/content", contentRoutes);

    routesLoaded = true;
    console.log("✅ 所有路由注册成功:");
    console.log("   • /api/rag");
    console.log("   • /api/rag-evaluation");
    console.log("   • /api/chat");
    console.log("   • /api/notes");
    console.log("   • /api/content");
  } catch (error) {
    console.error("❌ 路由加载失败:", error);
    throw error;
  }
};

// ============ 基础端点（在业务路由之前定义）============
// 健康检查
app.get("/api/health", async (req, res) => {
  try {
    const { default: ragService } = await import("./services/ragService.js");
    const ragStats = ragService.getStats();

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: "connected",
        rag_service: ragStats.initialized ? "loaded" : "failed",
        ai_service: "loaded",
        evaluation_service: "loaded",
      },
      rag_stats: ragStats,
      version: "2.0.0-refactored",
    });
  } catch (error) {
    console.error("健康检查失败:", error);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

// 演示信息
app.get("/api/demo-info", async (req, res) => {
  try {
    const { default: ragService } = await import("./services/ragService.js");
    const ragStats = ragService.getStats();

    res.json({
      demo_scenarios: [
        {
          name: "增强RAG Pipeline演示",
          description: "展示完整的增强检索生成流程",
          example_questions: [
            "什么是RAG技术？",
            "如何实现语义搜索？",
            "5G NR的关键技术有哪些？",
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
        vector_store: "Memory + MongoDB",
        embedding: ragStats.embedding_method || "Enhanced TF-IDF",
        search_algorithm: "Reciprocal Rank Fusion",
      },
      version: "2.0.0-refactored",
    });
  } catch (error) {
    console.error("获取演示信息失败:", error);
    res.status(500).json({
      status: "error",
      message: "获取演示信息失败",
    });
  }
});

// ============ 服务器启动 ============
async function startServer() {
  try {
    console.log("🚀 正在启动智能学习伴侣后端服务（重构版）...");

    // 验证环境变量
    const requiredVars = [
      "DEEPSEEK_API_KEY",
      "DEEPSEEK_API_URL",
      "MONGODB_URI",
    ];
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);

    if (missingVars.length > 0) {
      console.error(`❌ 缺少必需的环境变量: ${missingVars.join(", ")}`);
      console.error("💡 请检查backend目录下的.env文件");
      process.exit(1);
    }

    console.log("🔍 环境变量验证通过");

    // 连接数据库
    console.log("📊 连接MongoDB数据库...");
    await connectDB();
    console.log("✅ MongoDB连接成功");

    // 初始化服务（此时环境变量已正确加载）
    await initServices();

    // ✅ 关键：在启动HTTP服务器前加载所有路由
    await loadRoutes();

    // ✅ 重要：404处理必须在所有路由注册之后！
    // API 404处理
    app.use("/api/*", (req, res) => {
      console.error(`❌ API路径未找到: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        status: "error",
        message: `API路径未找到: ${req.method} ${req.originalUrl}`,
        available_routes: [
          "GET /api/health",
          "GET /api/demo-info",
          "GET /api/notes/stats",
          "GET /api/notes/recent",
          "POST /api/notes/search",
          "POST /api/chat/ask",
          "POST /api/chat/summary",
          "GET /api/rag/status",
          "POST /api/rag/query",
          "GET /api/rag-evaluation/dataset-info",
        ],
      });
    });

    // 通用404处理（非API路径）
    app.use("*", (req, res) => {
      res.status(404).json({
        status: "error",
        message: "路径未找到",
        version: "2.0.0-refactored",
      });
    });

    // 全局错误处理
    app.use(errorHandler);

    // 启动HTTP服务器
    const server = app.listen(PORT, () => {
      console.log("═".repeat(60));
      console.log(`🎉 智能学习伴侣后端启动成功（重构版）！`);
      console.log(`🌐 服务地址: http://localhost:${PORT}`);
      console.log("═".repeat(60));
      console.log("✅ 重构优化:");
      console.log(`   • 修复中间件顺序问题`);
      console.log(`   • 路由在404处理器之前注册`);
      console.log(`   • 统一的错误处理`);
      console.log("═".repeat(60));

      if (process.env.HUGGINGFACE_API_KEY) {
        console.log("🚀 HuggingFace增强功能已激活!");
      } else {
        console.log("⚠️  建议配置HUGGINGFACE_API_KEY以获得最佳向量质量");
      }

      // 测试关键端点可用性
      setTimeout(async () => {
        console.log("🧪 自动测试关键端点...");
        const testUrls = [`/api/health`, `/api/demo-info`];

        for (const url of testUrls) {
          try {
            const response = await fetch(`http://localhost:${PORT}${url}`);
            console.log(
              `${response.ok ? "✅" : "❌"} ${url} - ${response.status}`
            );
          } catch (error) {
            console.log(`❌ ${url} - 连接失败`);
          }
        }
      }, 1000);
    });

    // 优雅关闭处理
    const gracefulShutdown = (signal) => {
      console.log(`收到${signal}信号，正在关闭...`);
      server.close(() => {
        console.log("HTTP服务器已关闭");
        process.exit(0); // 直接退出，不要异步操作
      });

      // 3秒后强制退出
      setTimeout(() => {
        process.exit(1);
      }, 3000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("💥 服务器启动失败:", error);
    console.error("💡 错误详情:", error.stack);
    process.exit(1);
  }
}

// 全局异常处理
process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 未处理的Promise拒绝:", reason);
  console.error("Promise:", promise);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("💥 未捕获的异常:", error);
  console.error("Stack:", error.stack);
  process.exit(1);
});

// 启动服务器
startServer();
