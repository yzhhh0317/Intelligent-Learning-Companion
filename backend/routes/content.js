// routes/content-simple.js - 简化版内容处理路由（避免兼容性问题）
import express from "express";
import logger from "../config/logger.js";

const router = express.Router();

// 从URL提取内容（简化版 - 暂时禁用复杂的网页解析）
router.post("/extract-from-url", async (req, res) => {
  try {
    const { url, extract_text = true } = req.body;

    if (!url) {
      return res.status(400).json({
        status: "error",
        message: "URL不能为空",
      });
    }

    logger.info(`🌐 URL内容提取请求: ${url}`);

    // 临时禁用实际的网页抓取，返回模拟数据
    // 这是为了避免 cheerio 库的兼容性问题

    logger.warn("⚠️ URL内容提取功能暂时禁用（兼容性问题）");

    res.json({
      status: "success",
      title: "URL内容提取",
      content:
        "URL内容提取功能暂时不可用。请直接粘贴内容到文本框中进行处理。\n\n这是一个临时限制，为了避免某些依赖库的兼容性问题。",
      url,
      content_length: 100,
      message: "请直接粘贴内容进行处理",
    });
  } catch (error) {
    logger.error("URL内容提取失败:", error);
    res.status(500).json({
      status: "error",
      message: "URL内容提取失败",
      error: error.message,
    });
  }
});

// 健康检查端点
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    message: "内容处理服务运行正常（简化模式）",
    features: {
      url_extraction: "temporarily_disabled",
      reason: "避免依赖兼容性问题",
    },
  });
});

export default router;
