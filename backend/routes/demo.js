// routes/demo.js - 演示信息路由
import express from "express";

const router = express.Router();

router.get("/demo-info", (req, res) => {
  res.json({
    demo_scenarios: [
      {
        name: "技术文档学习",
        description: "粘贴技术文档，生成结构化笔记和摘要",
        example_content: "React Hooks文档、Vue3组合式API等",
        example_questions: [
          "React Hooks和Vue Composition API有什么区别？",
          "如何优化前端性能？",
        ],
      },
      {
        name: "代码理解",
        description: "分析代码片段，理解实现原理",
        example_content: "算法实现、设计模式代码",
        example_questions: [
          "这段代码使用了什么设计模式？",
          "如何优化这个算法？",
        ],
      },
      {
        name: "知识整理",
        description: "整理学习笔记，构建个人知识库",
        example_content: "学习心得、项目总结、面试准备",
        example_questions: ["我最近学了哪些内容？", "给我一些学习建议"],
      },
    ],
    rag_features: [
      "语义搜索 - 基于含义而非关键词匹配",
      "上下文增强 - 结合历史笔记提供个性化答案",
      "智能摘要 - 自动提取核心内容",
      "结构化笔记 - AI自动整理学习材料",
      "知识图谱 - 自动提取概念和关联",
    ],
  });
});

export default router;
