// routes/content.js - 内容处理路由
import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import logger from "../config/logger.js";

const router = express.Router();

// 从URL提取内容
router.post("/extract-from-url", async (req, res) => {
  try {
    const { url, extract_text = true } = req.body;

    if (!url) {
      return res.status(400).json({
        status: "error",
        message: "URL不能为空",
      });
    }

    // 获取网页内容
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    const $ = cheerio.load(response.data);

    // 移除脚本和样式
    $("script").remove();
    $("style").remove();

    // 提取标题
    const title =
      $("title").text() ||
      $("h1").first().text() ||
      $('meta[property="og:title"]').attr("content") ||
      "Untitled";

    // 提取主要内容
    let content = "";
    if (extract_text) {
      // 尝试找到主要内容区域
      const contentSelectors = [
        "article",
        "main",
        ".content",
        "#content",
        ".post",
        ".article-body",
      ];
      let mainContent = null;

      for (const selector of contentSelectors) {
        if ($(selector).length > 0) {
          mainContent = $(selector).first();
          break;
        }
      }

      if (mainContent) {
        content = mainContent.text();
      } else {
        content = $("body").text();
      }

      // 清理内容
      content = content
        .replace(/\s+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    res.json({
      status: "success",
      title,
      content,
      url,
      content_length: content.length,
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

export default router;
