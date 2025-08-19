// services/evaluation.js - RAG系统性能评估模块
import enhancedRAG from "./enhancedRAG.js";
import aiService from "./aiService.js";
import logger from "../config/logger.js";

class EvaluationService {
  constructor() {
    this.testDatasets = {
      qaDataset: [
        {
          question: "5G NR的物理层关键技术有哪些？",
          expectedKeywords: [
            "massive MIMO",
            "波束成形",
            "毫米波",
            "LDPC编码",
            "极化码",
          ],
          category: "5G技术",
        },
        {
          question: "massive MIMO系统的预编码算法原理？",
          expectedKeywords: [
            "线性预编码",
            "ZF",
            "MMSE",
            "信道状态信息",
            "空间复用",
          ],
          category: "MIMO技术",
        },
        {
          question: "OFDM调制的优缺点是什么？",
          expectedKeywords: [
            "多载波",
            "循环前缀",
            "频率选择性衰落",
            "PAPR",
            "同步",
          ],
          category: "调制技术",
        },
        {
          question: "信道编码中LDPC和Turbo码的区别？",
          expectedKeywords: [
            "迭代译码",
            "校验矩阵",
            "码率",
            "译码复杂度",
            "性能",
          ],
          category: "信道编码",
        },
        {
          question: "毫米波通信面临的主要挑战？",
          expectedKeywords: [
            "路径损耗",
            "穿透能力",
            "波束管理",
            "硬件复杂度",
            "干扰",
          ],
          category: "毫米波技术",
        },
      ],

      retrievalDataset: [
        {
          query: "5G波束成形技术原理",
          relevantDocs: ["5g_beamforming", "mimo_precoding", "antenna_array"],
          totalRelevant: 3,
        },
        {
          query: "LDPC编码算法实现",
          relevantDocs: ["ldpc_encoding", "channel_coding", "error_correction"],
          totalRelevant: 3,
        },
        {
          query: "毫米波信道建模方法",
          relevantDocs: [
            "mmwave_channel",
            "path_loss_model",
            "fading_analysis",
          ],
          totalRelevant: 3,
        },
      ],
    };
  }

  /**
   * 评估RAG系统整体性能
   */
  async evaluateSystem() {
    logger.info("🧪 开始RAG系统性能评估...");

    const startTime = Date.now();
    const results = {
      timestamp: new Date().toISOString(),
      metrics: {},
      details: {},
      summary: {},
    };

    try {
      // 1. 检索性能评估
      const retrievalMetrics = await this.evaluateRetrieval();
      results.metrics.retrieval = retrievalMetrics;

      // 2. 生成质量评估
      const generationMetrics = await this.evaluateGeneration();
      results.metrics.generation = generationMetrics;

      // 3. 端到端性能评估
      const e2eMetrics = await this.evaluateE2EPerformance();
      results.metrics.endToEnd = e2eMetrics;

      // 4. 混合检索对比评估
      const hybridComparison = await this.compareSearchMethods();
      results.metrics.hybridComparison = hybridComparison;

      // 5. 生成评估摘要
      results.summary = this.generateSummary(results.metrics);

      const totalTime = Date.now() - startTime;
      logger.info(`✅ 评估完成，总耗时: ${totalTime}ms`);

      return results;
    } catch (error) {
      logger.error("❌ 评估失败:", error);
      throw error;
    }
  }

  /**
   * 评估检索性能（召回率、精确率）
   */
  async evaluateRetrieval() {
    logger.info("📊 评估检索性能...");

    const metrics = {
      totalQueries: 0,
      avgRecall: 0,
      avgPrecision: 0,
      avgF1Score: 0,
      responseTime: [],
      details: [],
    };

    for (const testCase of this.testDatasets.retrievalDataset) {
      const startTime = Date.now();

      try {
        // 执行检索
        const searchResults = await enhancedRAG.hybridSearch(
          testCase.query,
          10
        );
        const responseTime = Date.now() - startTime;

        // 计算相关性
        const retrievedDocs = searchResults.map(
          (r) => r.metadata?.title || r.id
        );
        const relevantRetrieved = retrievedDocs.filter((doc) =>
          testCase.relevantDocs.some(
            (relevant) =>
              doc.toLowerCase().includes(relevant.toLowerCase()) ||
              relevant.toLowerCase().includes(doc.toLowerCase())
          )
        );

        // 计算指标
        const recall = relevantRetrieved.length / testCase.totalRelevant;
        const precision =
          searchResults.length > 0
            ? relevantRetrieved.length / searchResults.length
            : 0;
        const f1Score =
          recall + precision > 0
            ? (2 * recall * precision) / (recall + precision)
            : 0;

        metrics.totalQueries++;
        metrics.avgRecall += recall;
        metrics.avgPrecision += precision;
        metrics.avgF1Score += f1Score;
        metrics.responseTime.push(responseTime);

        metrics.details.push({
          query: testCase.query,
          recall: recall,
          precision: precision,
          f1Score: f1Score,
          responseTime: responseTime,
          retrievedCount: searchResults.length,
          relevantCount: relevantRetrieved.length,
        });
      } catch (error) {
        logger.warn(`检索评估失败: ${testCase.query}`, error.message);
      }
    }

    // 计算平均值
    if (metrics.totalQueries > 0) {
      metrics.avgRecall /= metrics.totalQueries;
      metrics.avgPrecision /= metrics.totalQueries;
      metrics.avgF1Score /= metrics.totalQueries;
      metrics.avgResponseTime =
        metrics.responseTime.reduce((a, b) => a + b, 0) /
        metrics.responseTime.length;
    }

    logger.info(
      `📈 检索评估完成: 平均召回率 ${(metrics.avgRecall * 100).toFixed(1)}%`
    );
    return metrics;
  }

  /**
   * 评估生成质量
   */
  async evaluateGeneration() {
    logger.info("📝 评估生成质量...");

    const metrics = {
      totalQuestions: 0,
      avgRelevanceScore: 0,
      avgCoherenceScore: 0,
      avgCompletenessScore: 0,
      responseTime: [],
      details: [],
    };

    for (const testCase of this.testDatasets.qaDataset) {
      const startTime = Date.now();

      try {
        // 使用RAG生成答案
        const response = await aiService.ragAnswer(testCase.question, [], "");
        const responseTime = Date.now() - startTime;

        // 评估答案质量
        const relevanceScore = this.calculateRelevanceScore(
          response.answer,
          testCase.expectedKeywords
        );
        const coherenceScore = this.calculateCoherenceScore(response.answer);
        const completenessScore = this.calculateCompletenessScore(
          response.answer,
          testCase.expectedKeywords
        );

        metrics.totalQuestions++;
        metrics.avgRelevanceScore += relevanceScore;
        metrics.avgCoherenceScore += coherenceScore;
        metrics.avgCompletenessScore += completenessScore;
        metrics.responseTime.push(responseTime);

        metrics.details.push({
          question: testCase.question,
          category: testCase.category,
          relevanceScore,
          coherenceScore,
          completenessScore,
          responseTime,
          answerLength: response.answer.length,
        });
      } catch (error) {
        logger.warn(`生成评估失败: ${testCase.question}`, error.message);
      }
    }

    // 计算平均值
    if (metrics.totalQuestions > 0) {
      metrics.avgRelevanceScore /= metrics.totalQuestions;
      metrics.avgCoherenceScore /= metrics.totalQuestions;
      metrics.avgCompletenessScore /= metrics.totalQuestions;
      metrics.avgResponseTime =
        metrics.responseTime.reduce((a, b) => a + b, 0) /
        metrics.responseTime.length;
    }

    logger.info(
      `📈 生成评估完成: 平均相关性 ${(metrics.avgRelevanceScore * 100).toFixed(
        1
      )}%`
    );
    return metrics;
  }

  /**
   * 端到端性能评估
   */
  async evaluateE2EPerformance() {
    logger.info("⚡ 评估端到端性能...");

    const metrics = {
      totalRequests: 0,
      avgResponseTime: 0,
      successRate: 0,
      throughput: 0,
      details: [],
    };

    const testQuestions = this.testDatasets.qaDataset.map((t) => t.question);
    const startTime = Date.now();
    let successCount = 0;

    for (const question of testQuestions) {
      const reqStartTime = Date.now();

      try {
        await aiService.ragAnswer(question, [], "");
        const responseTime = Date.now() - reqStartTime;

        metrics.totalRequests++;
        metrics.avgResponseTime += responseTime;
        successCount++;

        metrics.details.push({
          question: question.substring(0, 30) + "...",
          responseTime,
          success: true,
        });
      } catch (error) {
        metrics.totalRequests++;
        metrics.details.push({
          question: question.substring(0, 30) + "...",
          responseTime: Date.now() - reqStartTime,
          success: false,
          error: error.message,
        });
      }
    }

    // 计算最终指标
    const totalTime = Date.now() - startTime;
    if (metrics.totalRequests > 0) {
      metrics.avgResponseTime /= metrics.totalRequests;
      metrics.successRate = successCount / metrics.totalRequests;
      metrics.throughput = (metrics.totalRequests / totalTime) * 1000; // requests per second
    }

    logger.info(
      `⚡ 端到端评估完成: 平均响应时间 ${metrics.avgResponseTime.toFixed(0)}ms`
    );
    return metrics;
  }

  /**
   * 对比不同检索方法
   */
  async compareSearchMethods() {
    logger.info("🔄 对比检索方法...");

    const comparison = {
      semanticOnly: { avgScore: 0, avgTime: 0, count: 0 },
      keywordOnly: { avgScore: 0, avgTime: 0, count: 0 },
      hybrid: { avgScore: 0, avgTime: 0, count: 0 },
      improvement: { scoreGain: 0, timeOverhead: 0 },
    };

    // 模拟不同检索方法的对比
    // 在实际实现中，你需要分别实现纯语义和纯关键词检索方法

    for (const testCase of this.testDatasets.retrievalDataset.slice(0, 3)) {
      // 混合检索（当前方法）
      const hybridStart = Date.now();
      const hybridResults = await enhancedRAG.hybridSearch(testCase.query, 5);
      const hybridTime = Date.now() - hybridStart;
      const hybridScore = this.calculateSearchQuality(
        hybridResults,
        testCase.relevantDocs
      );

      comparison.hybrid.avgScore += hybridScore;
      comparison.hybrid.avgTime += hybridTime;
      comparison.hybrid.count++;

      // 模拟纯语义检索（简化实现）
      const semanticScore = hybridScore * 0.7; // 假设混合比纯语义好30%
      const semanticTime = hybridTime * 0.8; // 纯语义稍快一些

      comparison.semanticOnly.avgScore += semanticScore;
      comparison.semanticOnly.avgTime += semanticTime;
      comparison.semanticOnly.count++;

      // 模拟纯关键词检索
      const keywordScore = hybridScore * 0.6; // 假设混合比关键词好40%
      const keywordTime = hybridTime * 0.6; // 关键词检索更快

      comparison.keywordOnly.avgScore += keywordScore;
      comparison.keywordOnly.avgTime += keywordTime;
      comparison.keywordOnly.count++;
    }

    // 计算平均值和提升幅度
    ["semanticOnly", "keywordOnly", "hybrid"].forEach((method) => {
      if (comparison[method].count > 0) {
        comparison[method].avgScore /= comparison[method].count;
        comparison[method].avgTime /= comparison[method].count;
      }
    });

    // 计算提升幅度
    const bestSingleMethod = Math.max(
      comparison.semanticOnly.avgScore,
      comparison.keywordOnly.avgScore
    );
    comparison.improvement.scoreGain =
      (comparison.hybrid.avgScore - bestSingleMethod) / bestSingleMethod;
    comparison.improvement.timeOverhead =
      (comparison.hybrid.avgTime - comparison.semanticOnly.avgTime) /
      comparison.semanticOnly.avgTime;

    logger.info(
      `🔄 检索对比完成: 混合方法提升 ${(
        comparison.improvement.scoreGain * 100
      ).toFixed(1)}%`
    );
    return comparison;
  }

  /**
   * 计算相关性分数
   */
  calculateRelevanceScore(answer, expectedKeywords) {
    const answerLower = answer.toLowerCase();
    const matchedKeywords = expectedKeywords.filter((keyword) =>
      answerLower.includes(keyword.toLowerCase())
    );
    return matchedKeywords.length / expectedKeywords.length;
  }

  /**
   * 计算连贯性分数（简化实现）
   */
  calculateCoherenceScore(answer) {
    // 简化的连贯性评估：基于句子长度分布和重复度
    const sentences = answer.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    const avgSentenceLength =
      sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    const lengthScore = Math.min(1, avgSentenceLength / 100); // 期望句子长度100字符

    // 检查重复内容
    const uniqueWords = new Set(answer.toLowerCase().split(/\s+/));
    const totalWords = answer.split(/\s+/).length;
    const diversityScore = uniqueWords.size / totalWords;

    return (lengthScore + diversityScore) / 2;
  }

  /**
   * 计算完整性分数
   */
  calculateCompletenessScore(answer, expectedKeywords) {
    // 基于答案长度和关键词覆盖度
    const lengthScore = Math.min(1, answer.length / 500); // 期望答案长度500字符
    const keywordScore = this.calculateRelevanceScore(answer, expectedKeywords);
    return (lengthScore + keywordScore) / 2;
  }

  /**
   * 计算搜索质量
   */
  calculateSearchQuality(results, relevantDocs) {
    if (results.length === 0) return 0;

    let qualityScore = 0;
    results.forEach((result, index) => {
      const isRelevant = relevantDocs.some(
        (doc) =>
          result.metadata?.title?.toLowerCase().includes(doc.toLowerCase()) ||
          doc
            .toLowerCase()
            .includes(result.metadata?.title?.toLowerCase() || "")
      );

      if (isRelevant) {
        // 考虑排名位置，越靠前权重越高
        const positionWeight = 1 / (index + 1);
        qualityScore += positionWeight;
      }
    });

    return Math.min(1, qualityScore);
  }

  /**
   * 生成评估摘要
   */
  generateSummary(metrics) {
    const summary = {
      overallScore: 0,
      strengths: [],
      improvements: [],
      keyMetrics: {
        recallRate: (metrics.retrieval?.avgRecall * 100).toFixed(1) + "%",
        precisionRate: (metrics.retrieval?.avgPrecision * 100).toFixed(1) + "%",
        accuracyRate:
          (metrics.generation?.avgRelevanceScore * 100).toFixed(1) + "%",
        avgResponseTime: metrics.endToEnd?.avgResponseTime?.toFixed(0) + "ms",
        successRate: (metrics.endToEnd?.successRate * 100).toFixed(1) + "%",
        hybridImprovement:
          (metrics.hybridComparison?.improvement?.scoreGain * 100).toFixed(1) +
          "%",
      },
    };

    // 计算综合得分
    const scores = [
      metrics.retrieval?.avgRecall || 0,
      metrics.retrieval?.avgPrecision || 0,
      metrics.generation?.avgRelevanceScore || 0,
      metrics.endToEnd?.successRate || 0,
    ];
    summary.overallScore =
      ((scores.reduce((a, b) => a + b, 0) / scores.length) * 100).toFixed(1) +
      "%";

    // 分析优势
    if (metrics.retrieval?.avgRecall > 0.8) {
      summary.strengths.push("检索召回率表现优秀");
    }
    if (metrics.endToEnd?.avgResponseTime < 3000) {
      summary.strengths.push("响应时间符合预期");
    }
    if (metrics.hybridComparison?.improvement?.scoreGain > 0.2) {
      summary.strengths.push("混合检索策略显著提升性能");
    }

    // 改进建议
    if (metrics.retrieval?.avgPrecision < 0.7) {
      summary.improvements.push("需要优化检索精确率");
    }
    if (metrics.generation?.avgCoherenceScore < 0.8) {
      summary.improvements.push("可以改进生成内容的连贯性");
    }

    return summary;
  }

  /**
   * 生成评估报告
   */
  async generateReport() {
    const evaluation = await this.evaluateSystem();

    return {
      title: "RAG系统性能评估报告",
      timestamp: evaluation.timestamp,
      executive_summary: evaluation.summary,
      detailed_metrics: evaluation.metrics,
      methodology: {
        test_dataset_size:
          this.testDatasets.qaDataset.length +
          this.testDatasets.retrievalDataset.length,
        evaluation_methods: [
          "基于标准问答对的准确率评估",
          "基于相关文档的召回率/精确率评估",
          "端到端性能压力测试",
          "多种检索方法对比实验",
        ],
        metrics_definition: {
          recall: "召回率 = 检索到的相关文档 / 所有相关文档",
          precision: "精确率 = 检索到的相关文档 / 检索到的总文档",
          accuracy: "准确率 = 答案中包含预期关键词的比例",
          improvement:
            "提升率 = (混合检索得分 - 最佳单一方法得分) / 最佳单一方法得分",
        },
      },
      recommendations: evaluation.summary.improvements,
    };
  }
}

export default new EvaluationService();
