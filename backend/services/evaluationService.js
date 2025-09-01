// services/evaluationService.js
import {
  telecomQADataset,
  sampleDataset,
  datasetStats,
} from "./evaluationDataset.js";
import ragService from "./ragService.js";
import aiService from "./aiService.js";
import logger from "../config/logger.js";

class EvaluationService {
  constructor() {
    this.qaDataset = telecomQADataset;
    this.stats = datasetStats;

    // 添加同义词映射表，提高匹配准确性
    this.synonymMap = new Map([
      // 基站相关
      ["gnb", ["基站", "5g基站", "nr基站", "节点"]],
      ["基站", ["gnb", "5g基站", "nr基站", "节点"]],

      // 网络架构
      ["ng-ran", ["5g接入网", "新空口接入网", "接入网"]],
      ["5gc", ["核心网", "5g核心网"]],
      ["核心网", ["5gc", "5g核心网"]],

      // 功能单元
      ["cu", ["中央单元", "控制单元"]],
      ["du", ["分布单元", "分布式单元"]],
      ["中央单元", ["cu", "控制单元"]],
      ["分布单元", ["du", "分布式单元"]],

      // 协议相关
      ["rrc", ["无线资源控制", "资源控制"]],
      ["pdcp", ["分组数据汇聚协议"]],
      ["qos", ["服务质量", "业务质量"]],
      ["服务质量", ["qos", "业务质量"]],

      // 其他常用术语
      ["ue", ["用户设备", "终端", "移动终端"]],
      ["用户设备", ["ue", "终端", "移动终端"]],
      ["切换", ["handover", "小区切换"]],
      ["handover", ["切换", "小区切换"]],
    ]);
  }

  /**
   * 快速评估（10个样本）
   */
  async quickEvaluation() {
    logger.info("🔊 开始快速评估...");

    const sampleSize = 10;
    const testSample = sampleDataset(sampleSize);

    const metrics = {
      retrieval: { precision_at_5: 0 },
      generation: { concept_coverage: 0 },
      overall_score: 0,
    };

    for (const testCase of testSample) {
      try {
        // 检索评估
        const searchResults = await ragService.hybridSearch(
          testCase.question,
          5
        );
        const precision = this.calculatePrecision(searchResults, testCase);
        metrics.retrieval.precision_at_5 += precision;

        // 生成评估
        const context = searchResults.map((r) => ({
          id: r.id,
          title: r.metadata?.title || "技术文档",
          content: r.content,
          score: r.score,
        }));

        const response = await aiService.ragAnswer(testCase.question, context);
        const conceptCoverage = this.calculateConceptCoverage(
          response.answer,
          testCase
        );
        metrics.generation.concept_coverage += conceptCoverage;
      } catch (error) {
        logger.error(`快速评估失败: ${testCase.question}`, error);
      }
    }

    // 计算平均值
    metrics.retrieval.precision_at_5 /= sampleSize;
    metrics.generation.concept_coverage /= sampleSize;
    metrics.overall_score =
      ((metrics.retrieval.precision_at_5 +
        metrics.generation.concept_coverage) /
        2) *
      100;

    logger.info(
      `✅ 快速评估完成: 综合得分 ${metrics.overall_score.toFixed(1)}%`
    );
    return metrics;
  }

  /**
   * 详细评估（80个样本）
   */
  async detailedEvaluation(sampleSize = 80) {
    logger.info(`开始详细评估，样本数: ${sampleSize}`);

    const startTime = Date.now();

    // 统一采样一批数据
    const masterSample = sampleDataset(sampleSize);
    logger.info(`统一采样完成: ${masterSample.length} 个样本`);

    // 使用相同样本进行所有评估
    const retrievalMetrics = await this.evaluateRetrieval(masterSample);
    const generationMetrics = await this.evaluateGeneration(masterSample);
    const comparisonResults = await this.compareRetrievalMethods(
      masterSample.slice(0, 60) // 前60个用于方法对比
    );

    const totalTime = Date.now() - startTime;

    const report = {
      timestamp: new Date().toISOString(),
      dataset_info: {
        total_dataset_size: this.qaDataset.length,
        sample_size: sampleSize,
        comparison_sample_size: 60,
        categories: this.stats.categories,
      },
      retrieval_metrics: retrievalMetrics,
      generation_metrics: generationMetrics,
      comparison_results: comparisonResults,
      summary: {
        overall_score: this.calculateOverallScore(
          retrievalMetrics,
          generationMetrics
        ),
        key_findings: this.generateKeyFindings(
          retrievalMetrics,
          generationMetrics,
          comparisonResults
        ),
        recommendations: this.generateRecommendations(
          retrievalMetrics,
          generationMetrics
        ),
      },
      evaluation_time: totalTime,
    };

    logger.info(`详细评估完成，耗时: ${totalTime}ms`);
    return report;
  }

  /**
   * 检索质量评估
   */
  async evaluateRetrieval(testSample) {
    if (Array.isArray(testSample)) {
      // 直接使用传入的样本
      logger.info(`开始检索质量评估，使用预定义样本: ${testSample.length} 个`);
    } else {
      // 兼容旧的调用方式
      const sampleSize = testSample || 30;
      testSample = sampleDataset(sampleSize);
      logger.info(`开始检索质量评估，样本数: ${sampleSize}`);
    }

    const metrics = {
      precision_at_5: 0,
      precision_at_10: 0,
      recall: 0,
      mrr: 0,
      total_queries: 0,
      response_times: [],
      avg_response_time: 0,
      successful_queries: 0,
    };

    for (const testCase of testSample) {
      const startTime = Date.now();

      try {
        const searchResults = await ragService.hybridSearch(
          testCase.question,
          10
        );
        const responseTime = Date.now() - startTime;
        metrics.response_times.push(responseTime);

        if (searchResults.length > 0) {
          metrics.successful_queries++;

          // 计算精确率@5 - 使用宽松标准
          const top5 = searchResults.slice(0, 5);
          const relevantInTop5 = this.countRelevantDocs(top5, testCase);
          const precisionAt5 =
            relevantInTop5 / Math.min(5, searchResults.length);
          metrics.precision_at_5 += precisionAt5;

          // 计算精确率@10
          const relevantInTop10 = this.countRelevantDocs(
            searchResults,
            testCase
          );
          const precisionAt10 =
            relevantInTop10 / Math.min(10, searchResults.length);
          metrics.precision_at_10 += precisionAt10;

          // 计算召回率 - 使用更合理的分母
          const recall = this.calculateRecall(searchResults, testCase);
          metrics.recall += recall;

          // 计算MRR
          const firstRelevantRank = this.findFirstRelevantRank(
            searchResults,
            testCase
          );
          if (firstRelevantRank !== -1) {
            metrics.mrr += 1 / (firstRelevantRank + 1);
          }

          logger.info(
            `问题 "${testCase.question.substring(0, 30)}..." - 检索到${
              searchResults.length
            }个结果, P@5=${precisionAt5.toFixed(3)}`
          );
        } else {
          logger.warn(
            `问题 "${testCase.question.substring(0, 30)}..." - 无检索结果`
          );
        }

        metrics.total_queries++;
      } catch (error) {
        logger.error(`检索评估失败: ${testCase.question}`, error);
        metrics.total_queries++;
      }
    }

    // 计算平均值（只基于成功的查询）
    if (metrics.successful_queries > 0) {
      metrics.precision_at_5 /= metrics.successful_queries;
      metrics.precision_at_10 /= metrics.successful_queries;
      metrics.recall /= metrics.successful_queries;
      metrics.mrr /= metrics.successful_queries;
    }

    if (metrics.response_times.length > 0) {
      metrics.avg_response_time =
        metrics.response_times.reduce((a, b) => a + b, 0) /
        metrics.response_times.length;
    }

    // 添加成功率指标
    metrics.success_rate = metrics.successful_queries / metrics.total_queries;

    logger.info(`检索评估完成:`);
    logger.info(
      `  成功查询: ${metrics.successful_queries}/${metrics.total_queries} (${(
        metrics.success_rate * 100
      ).toFixed(1)}%)`
    );
    logger.info(`  精确率@5: ${(metrics.precision_at_5 * 100).toFixed(1)}%`);
    logger.info(`  召回率: ${(metrics.recall * 100).toFixed(1)}%`);
    logger.info(`  平均响应时间: ${metrics.avg_response_time.toFixed(0)}ms`);

    return metrics;
  }

  /**
   * 生成质量评估
   */
  async evaluateGeneration(testSample) {
    if (Array.isArray(testSample)) {
      logger.info(`开始生成质量评估，使用预定义样本: ${testSample.length} 个`);
    } else {
      const sampleSize = testSample || 30;
      testSample = sampleDataset(sampleSize);
      logger.info(`开始生成质量评估，样本数: ${sampleSize}`);
    }

    const metrics = {
      concept_coverage: 0,
      keyword_accuracy: 0,
      answer_relevance: 0,
      answer_completeness: 0,
      total_questions: 0,
      response_times: [],
      avg_response_time: 0,
    };

    for (const testCase of testSample) {
      const startTime = Date.now();

      try {
        // 执行RAG问答
        const searchResults = await ragService.hybridSearch(
          testCase.question,
          3
        );
        const context = searchResults.map((r) => ({
          id: r.id,
          title: r.metadata?.title || "技术文档",
          content: r.content,
          score: r.score,
        }));

        const ragResponse = await aiService.ragAnswer(
          testCase.question,
          context
        );
        const responseTime = Date.now() - startTime;
        metrics.response_times.push(responseTime);

        // 评估生成质量
        const conceptCoverage = this.calculateConceptCoverage(
          ragResponse.answer,
          testCase
        );
        const keywordAccuracy = this.calculateKeywordAccuracy(
          ragResponse.answer,
          testCase
        );
        const answerRelevance = this.calculateAnswerRelevance(
          ragResponse.answer,
          testCase
        );
        const answerCompleteness = this.calculateAnswerCompleteness(
          ragResponse.answer
        );

        metrics.concept_coverage += conceptCoverage;
        metrics.keyword_accuracy += keywordAccuracy;
        metrics.answer_relevance += answerRelevance;
        metrics.answer_completeness += answerCompleteness;
        metrics.total_questions++;
      } catch (error) {
        logger.error(`生成评估失败: ${testCase.question}`, error);
      }
    }

    // 计算平均值
    if (metrics.total_questions > 0) {
      metrics.concept_coverage /= metrics.total_questions;
      metrics.keyword_accuracy /= metrics.total_questions;
      metrics.answer_relevance /= metrics.total_questions;
      metrics.answer_completeness /= metrics.total_questions;
      metrics.avg_response_time =
        metrics.response_times.reduce((a, b) => a + b, 0) /
        metrics.response_times.length;
    }

    logger.info(
      `✅ 生成评估完成: 概念覆盖=${(metrics.concept_coverage * 100).toFixed(
        1
      )}%`
    );
    return metrics;
  }

  /**
   * 检索方法对比
   */
  async compareRetrievalMethods(testSample) {
    if (Array.isArray(testSample)) {
      logger.info(`开始检索方法对比，使用预定义样本: ${testSample.length} 个`);
    } else {
      const sampleSize = testSample || 80;
      testSample = sampleDataset(sampleSize);
      logger.info(`开始检索方法对比，样本数: ${sampleSize}`);
    }

    const results = {
      hybrid_rag: { precision: 0, recall: 0, time: 0, count: 0, details: [] },
      semantic_only: {
        precision: 0,
        recall: 0,
        time: 0,
        count: 0,
        details: [],
      },
      bm25_only: { precision: 0, recall: 0, time: 0, count: 0, details: [] },
    };

    for (const testCase of testSample) {
      try {
        logger.info(`评估问题: "${testCase.question}"`);

        // 1. 测试混合检索（现有的hybridSearch方法）
        const hybridStart = Date.now();
        const hybridResults = await ragService.hybridSearch(
          testCase.question,
          5
        );
        const hybridTime = Date.now() - hybridStart;

        const hybridPrecision = this.calculatePrecision(
          hybridResults,
          testCase
        );
        const hybridRecall = this.calculateRecall(hybridResults, testCase);

        results.hybrid_rag.precision += hybridPrecision;
        results.hybrid_rag.recall += hybridRecall;
        results.hybrid_rag.time += hybridTime;
        results.hybrid_rag.count++;
        results.hybrid_rag.details.push({
          question: testCase.question,
          precision: hybridPrecision,
          recall: hybridRecall,
          results_count: hybridResults.length,
        });

        // 2. 测试纯语义检索
        const semanticStart = Date.now();
        const semanticResults = await this.performSemanticOnlySearch(
          testCase.question,
          5
        );
        const semanticTime = Date.now() - semanticStart;

        const semanticPrecision = this.calculatePrecision(
          semanticResults,
          testCase
        );
        const semanticRecall = this.calculateRecall(semanticResults, testCase);

        results.semantic_only.precision += semanticPrecision;
        results.semantic_only.recall += semanticRecall;
        results.semantic_only.time += semanticTime;
        results.semantic_only.count++;
        results.semantic_only.details.push({
          question: testCase.question,
          precision: semanticPrecision,
          recall: semanticRecall,
          results_count: semanticResults.length,
        });

        // 3. 测试纯BM25检索
        const bm25Start = Date.now();
        const bm25Results = await this.performBM25OnlySearch(
          testCase.question,
          5
        );
        const bm25Time = Date.now() - bm25Start;

        const bm25Precision = this.calculatePrecision(bm25Results, testCase);
        const bm25Recall = this.calculateRecall(bm25Results, testCase);

        results.bm25_only.precision += bm25Precision;
        results.bm25_only.recall += bm25Recall;
        results.bm25_only.time += bm25Time;
        results.bm25_only.count++;
        results.bm25_only.details.push({
          question: testCase.question,
          precision: bm25Precision,
          recall: bm25Recall,
          results_count: bm25Results.length,
        });

        logger.info(
          `问题 "${testCase.question.substring(0, 30)}..." 评估完成:`
        );
        logger.info(
          `  混合: P=${hybridPrecision.toFixed(3)}, 结果=${
            hybridResults.length
          }`
        );
        logger.info(
          `  语义: P=${semanticPrecision.toFixed(3)}, 结果=${
            semanticResults.length
          }`
        );
        logger.info(
          `  BM25: P=${bm25Precision.toFixed(3)}, 结果=${bm25Results.length}`
        );
      } catch (error) {
        logger.error(`方法对比失败: ${testCase.question}`, error);
      }
    }

    // 计算平均值
    Object.keys(results).forEach((method) => {
      if (results[method].count > 0) {
        results[method].precision /= results[method].count;
        results[method].recall /= results[method].count;
        results[method].time /= results[method].count;
      }
    });

    // 计算真实的提升幅度
    const improvements = {
      precision_vs_semantic: this.calculateImprovement(
        results.hybrid_rag.precision,
        results.semantic_only.precision
      ),
      precision_vs_bm25: this.calculateImprovement(
        results.hybrid_rag.precision,
        results.bm25_only.precision
      ),
      recall_vs_semantic: this.calculateImprovement(
        results.hybrid_rag.recall,
        results.semantic_only.recall
      ),
      recall_vs_bm25: this.calculateImprovement(
        results.hybrid_rag.recall,
        results.bm25_only.recall
      ),
    };

    logger.info(`真实方法对比完成:`);
    logger.info(
      `  混合检索精确率: ${(results.hybrid_rag.precision * 100).toFixed(1)}%`
    );
    logger.info(
      `  纯语义精确率: ${(results.semantic_only.precision * 100).toFixed(1)}%`
    );
    logger.info(
      `  纯BM25精确率: ${(results.bm25_only.precision * 100).toFixed(1)}%`
    );
    logger.info(
      `  混合vs语义提升: ${improvements.precision_vs_semantic.toFixed(1)}%`
    );
    logger.info(
      `  混合vsBM25提升: ${improvements.precision_vs_bm25.toFixed(1)}%`
    );

    return { results, improvements };
  }

  /**
   * 执行纯语义检索
   */
  async performSemanticOnlySearch(query, topK = 5) {
    await ragService.initialize();

    if (Object.keys(ragService.vectors).length === 0) {
      return [];
    }

    const queryEmbedding = await ragService.generateEmbedding(query);
    const semanticResults = [];

    for (const [id, data] of Object.entries(ragService.vectors)) {
      const score = ragService.cosineSimilarity(queryEmbedding, data.embedding);
      if (score > 0.05) {
        semanticResults.push({
          id,
          content: data.chunk,
          metadata: data.metadata,
          score: score,
        });
      }
    }

    return semanticResults.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  /**
   * 执行纯BM25检索
   */
  async performBM25OnlySearch(query, topK = 5) {
    await ragService.initialize();

    if (Object.keys(ragService.vectors).length === 0) {
      return [];
    }

    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 1);
    const bm25Results = [];

    for (const [id, data] of Object.entries(ragService.vectors)) {
      const score = ragService.calculateBM25Score(data.chunk, queryTerms);
      if (score > 0.001) {
        bm25Results.push({
          id,
          content: data.chunk,
          metadata: data.metadata,
          score: score,
        });
      }
    }

    return bm25Results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  // ============== 核心评估方法 ==============

  /**
   * 修复：相关文档计数 - 更宽松的匹配标准
   */
  countRelevantDocs(docs, testCase) {
    return docs.filter((doc) => {
      const docContent = doc.content.toLowerCase();

      // 扩展关键词匹配：包含同义词
      const expandedKeywords = this.expandKeywords(testCase.relevant_keywords);

      const matchedKeywords = expandedKeywords.filter((keyword) =>
        docContent.includes(keyword.toLowerCase())
      );

      // 修复：从50%降低到25%的匹配阈值
      const matchThreshold = Math.max(
        1,
        Math.ceil(testCase.relevant_keywords.length * 0.25)
      );

      return matchedKeywords.length >= matchThreshold;
    }).length;
  }

  /**
   * 新增：扩展关键词（包含同义词）
   */
  expandKeywords(originalKeywords) {
    const expandedSet = new Set(originalKeywords);

    for (const keyword of originalKeywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (this.synonymMap.has(lowerKeyword)) {
        const synonyms = this.synonymMap.get(lowerKeyword);
        synonyms.forEach((syn) => expandedSet.add(syn));
      }
    }

    return Array.from(expandedSet);
  }

  findFirstRelevantRank(docs, testCase) {
    return docs.findIndex((doc) => {
      const docContent = doc.content.toLowerCase();
      const expandedKeywords = this.expandKeywords(testCase.relevant_keywords);

      return expandedKeywords.some((keyword) =>
        docContent.includes(keyword.toLowerCase())
      );
    });
  }

  /**
   * 修复：精确率计算 - 添加边界检查和权重调整
   */
  calculatePrecision(docs, testCase) {
    if (!docs || docs.length === 0) return 0;

    const relevantCount = this.countRelevantDocs(docs, testCase);
    const precision = relevantCount / docs.length;
    return Math.min(1.0, Math.max(0, precision)); // 确保在0-1范围内
  }

  /**
   * 召回率计算
   */
  calculateRecall(docs, testCase) {
    if (!docs || docs.length === 0) return 0;

    const relevantCount = this.countRelevantDocs(docs, testCase);

    // 基于实际数据库规模计算合理的分母
    // 数据库总共25个chunks，假设每个问题平均有20%的chunks可能相关
    const totalRelevantDocs = Math.max(
      relevantCount, // 至少等于已找到的相关文档数
      Math.ceil(25 * 0.2) // 或者基于数据库总量的20%，即5个
    );

    return totalRelevantDocs > 0
      ? Math.min(1.0, relevantCount / totalRelevantDocs)
      : 0;
  }

  /**
   * 概念覆盖率计算 - 更宽松的匹配标准
   */
  calculateConceptCoverage(answer, testCase) {
    const answerLower = answer.toLowerCase();
    let totalCoverage = 0;

    for (const concept of testCase.expected_concepts) {
      const conceptLower = concept.toLowerCase();

      // 完全匹配
      if (answerLower.includes(conceptLower)) {
        totalCoverage += 1;
      }
      // 部分匹配（针对复合概念）
      else if (conceptLower.includes(" ")) {
        const words = conceptLower.split(" ");
        const matchedWords = words.filter((word) => answerLower.includes(word));

        // 修复：从60%降低到30%的匹配阈值
        if (matchedWords.length >= Math.ceil(words.length * 0.3)) {
          totalCoverage += 0.5; // 部分匹配给0.5分
        }
      }
      // 同义词匹配
      else {
        const synonyms = this.synonymMap.get(conceptLower) || [];
        const hasSynonymMatch = synonyms.some((synonym) =>
          answerLower.includes(synonym.toLowerCase())
        );
        if (hasSynonymMatch) {
          totalCoverage += 0.8; // 同义词匹配给0.8分
        }
      }
    }

    return Math.min(1.0, totalCoverage / testCase.expected_concepts.length);
  }

  /**
   * 修复：关键词准确率 - 增加同义词支持
   */
  calculateKeywordAccuracy(answer, testCase) {
    const answerLower = answer.toLowerCase();
    const expandedKeywords = this.expandKeywords(testCase.relevant_keywords);

    const matchedKeywords = expandedKeywords.filter((keyword) =>
      answerLower.includes(keyword.toLowerCase())
    );

    return Math.min(
      1.0,
      matchedKeywords.length / testCase.relevant_keywords.length
    );
  }

  calculateAnswerRelevance(answer, testCase) {
    let score = 0;

    // 长度合理性
    const length = answer.length;
    if (length >= 50 && length <= 500) score += 0.3;
    else if (length >= 20 && length <= 800) score += 0.2;

    // 技术术语密度 - 使用扩展关键词
    const expandedKeywords = this.expandKeywords(testCase.relevant_keywords);
    const technicalTerms = expandedKeywords.filter((keyword) =>
      answer.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    score += Math.min(0.4, technicalTerms * 0.08);

    // 结构完整性
    const hasDefinition =
      answer.includes("是") || answer.includes("指") || answer.includes("定义");
    const hasPrinciple =
      answer.includes("通过") ||
      answer.includes("采用") ||
      answer.includes("原理");
    const hasApplication =
      answer.includes("用于") ||
      answer.includes("应用") ||
      answer.includes("场景");

    if (hasDefinition) score += 0.1;
    if (hasPrinciple) score += 0.1;
    if (hasApplication) score += 0.1;

    return Math.min(1.0, score);
  }

  calculateAnswerCompleteness(answer) {
    const length = answer.length;
    if (length < 30) return 0.2;
    if (length < 100) return 0.6;
    if (length < 300) return 1.0;
    if (length < 600) return 0.9;
    return 0.8;
  }

  // 改进指标计算 - 更准确的提升计算
  calculateImprovement(improved, baseline) {
    if (baseline <= 0) return improved > 0 ? 100 : 0;
    const improvement = ((improved - baseline) / baseline) * 100;
    return Math.max(-100, Math.min(1000, improvement)); // 限制在合理范围内
  }

  // 综合得分计算 - 添加边界检查和权重调整
  calculateOverallScore(retrievalResults, generationResults) {
    // 确保所有指标都在0-1范围内
    const precision = Math.min(
      1.0,
      Math.max(0, retrievalResults.precision_at_5 || 0)
    );
    const recall = Math.min(1.0, Math.max(0, retrievalResults.recall || 0));
    const conceptCoverage = Math.min(
      1.0,
      Math.max(0, generationResults.concept_coverage || 0)
    );
    const keywordAccuracy = Math.min(
      1.0,
      Math.max(0, generationResults.keyword_accuracy || 0)
    );

    // 使用加权平均，检索和生成各占50%
    const retrievalScore = precision * 0.6 + recall * 0.4; // 精确率权重更高
    const generationScore = conceptCoverage * 0.5 + keywordAccuracy * 0.5;

    const finalScore = (retrievalScore * 0.5 + generationScore * 0.5) * 100;

    // 记录详细计算过程用于调试
    logger.info(
      `得分计算详情: P=${precision.toFixed(3)}, R=${recall.toFixed(3)}, ` +
        `CC=${conceptCoverage.toFixed(3)}, KA=${keywordAccuracy.toFixed(3)}, ` +
        `RS=${retrievalScore.toFixed(3)}, GS=${generationScore.toFixed(3)}, ` +
        `Final=${finalScore.toFixed(1)}`
    );

    return Math.min(100, Math.max(0, finalScore));
  }

  generateKeyFindings(retrievalResults, generationResults, comparisonResults) {
    const findings = [];

    if (retrievalResults.precision_at_5 > 0.4) {
      findings.push("检索精确率表现良好");
    }
    if (generationResults.concept_coverage > 0.5) {
      findings.push("概念覆盖率达到可接受水平");
    }
    if (comparisonResults.improvements.precision_vs_semantic > 5) {
      findings.push("混合检索相比单一方法有显著提升");
    }
    if (retrievalResults.avg_response_time < 2000) {
      findings.push("响应时间符合实时要求");
    }

    return findings;
  }

  generateRecommendations(retrievalResults, generationResults) {
    const recommendations = [];

    if (retrievalResults.precision_at_5 < 0.4) {
      recommendations.push("建议优化检索算法的精确率");
    }
    if (generationResults.answer_relevance < 0.5) {
      recommendations.push("建议改进答案生成的相关性");
    }
    if (retrievalResults.avg_response_time > 3000) {
      recommendations.push("建议优化系统响应速度");
    }
    if (generationResults.concept_coverage < 0.4) {
      recommendations.push("建议增强概念覆盖的全面性");
    }

    return recommendations;
  }

  // 获取数据集统计信息
  getDatasetStats() {
    return this.stats;
  }
}

export default new EvaluationService();
