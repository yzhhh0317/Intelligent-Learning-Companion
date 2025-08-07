// routes/chat.js - 智能问答路由
import express from "express";
import chatController from "../controllers/chatController.js";

const router = express.Router();

router.post("/ask", chatController.askQuestion);
router.post("/summary", chatController.generateSummary);
router.post("/generate-notes", chatController.generateNotes);
router.get("/analyze", chatController.analyzeLearning);

export default router;
