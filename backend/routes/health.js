// routes/health.js - 健康检查路由
import express from "express";
import mongoose from "mongoose";
import ragService from "../services/ragService.js";

const router = express.Router();

router.get("/health", async (req, res) => {
  try {
    const mongoStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    const vectorStats = await ragService.getStats();

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoStatus,
        vectorStore: vectorStats.status,
        deepseek: process.env.DEEPSEEK_API_KEY
          ? "configured"
          : "not configured",
      },
      version: "1.0.0",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

export default router;
