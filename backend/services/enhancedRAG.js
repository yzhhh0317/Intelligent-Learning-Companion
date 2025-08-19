// services/enhancedRAG.js - RAG服务（集成HuggingFace Embeddings）
import { v4 as uuidv4 } from "uuid";
import Note from "../models/Note.js";
import logger from "../config/logger.js";
import axios from "axios";

class EnhancedRAGService {
  constructor() {
    this.vectors = {}; // 内存向量存储
    this.documents = new Map(); // 文档存储
    this.initialized = false;
    this.useHuggingFace = !!process.env.HUGGINGFACE_API_KEY;
    this.embeddingModel = "sentence-transformers/all-MiniLM-L6-v2"; // 轻量级但高质量的模型
    this.vectorDimension = this.useHuggingFace ? 384 : 100; // HuggingFace模型维度
  }

  // 初始化服务
  async initialize() {
    if (this.initialized) return;

    logger.info("🚀 初始化增强版RAG服务...");
    this.vectors = {};
    this.documents = new Map();

    // 测试 HuggingFace API
    if (this.useHuggingFace) {
      try {
        await this.testHuggingFaceAPI();
        logger.info("✅ HuggingFace API 测试成功");
      } catch (error) {
        logger.warn("⚠️ HuggingFace API 测试失败，将使用备用TF-IDF算法");
        logger.warn(`错误详情: ${error.message}`);
        this.useHuggingFace = false;
        this.vectorDimension = 100;
      }
    }

    try {
      // 从MongoDB重新加载向量数据
      await this.loadVectorsFromDatabase();
      this.initialized = true;
      logger.info("✅ 增强版RAG服务初始化完成");
      logger.info(
        `📊 向量化方案: ${
          this.useHuggingFace ? "HuggingFace Embeddings" : "TF-IDF算法"
        }`
      );
      logger.info(`📏 向量维度: ${this.vectorDimension}`);
      logger.info(
        `📦 已加载 ${Object.keys(this.vectors).length} 个向量，${
          this.documents.size
        } 个文档`
      );
    } catch (error) {
      logger.error("❌ 增强版RAG初始化失败:", error);
      this.initialized = true;
      logger.warn("⚠️ 将使用空的RAG状态继续运行");
    }
  }

  // 测试 HuggingFace API
  async testHuggingFaceAPI() {
    const testText = "This is a test sentence.";
    await this.generateHuggingFaceEmbedding(testText);
  }

  // 使用 HuggingFace API 生成向量
  async generateHuggingFaceEmbedding(text) {
    try {
      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.embeddingModel}`,
        {
          inputs: text,
          options: { wait_for_model: true },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data[0]; // 返回向量数组
      } else {
        throw new Error("Invalid response format from HuggingFace API");
      }
    } catch (error) {
      logger.error("HuggingFace API调用失败:", error.message);
      throw error;
    }
  }

  // 改进的向量生成方法
  async generateEmbedding(text) {
    if (this.useHuggingFace) {
      try {
        return await this.generateHuggingFaceEmbedding(text);
      } catch (error) {
        logger.warn("HuggingFace向量生成失败，使用备用TF-IDF算法");
        return this.generateTFIDFEmbedding(text);
      }
    } else {
      return this.generateTFIDFEmbedding(text);
    }
  }

  // 改进的TF-IDF向量生成（备用方案）
  generateTFIDFEmbedding(text) {
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(this.vectorDimension).fill(0);

    // 计算词频
    const wordFreq = {};
    words.forEach((word) => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // 生成向量，使用改进的哈希方法
    for (const [word, freq] of Object.entries(wordFreq)) {
      const hash1 = this.hashCode(word);
      const hash2 = this.hashCode(word.split("").reverse().join("")); // 反向哈希

      const index1 = Math.abs(hash1) % this.vectorDimension;
      const index2 = Math.abs(hash2) % this.vectorDimension;

      // 使用TF-IDF近似，考虑词的重要性
      const tf = freq / words.length;
      const weight = Math.log(1 + tf); // 对数缩放

      vector[index1] += weight;
      if (index2 !== index1) {
        vector[index2] += weight * 0.5; // 降权的第二个特征
      }
    }

    // L2归一化
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      return vector.map((val) => val / norm);
    }
    return vector;
  }

  // 改进的哈希函数
  hashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash;
  }

  // 从数据库加载向量数据
  async loadVectorsFromDatabase() {
    try {
      logger.info("📥 从MongoDB加载向量数据...");

      const notes = await Note.find({
        embedding_indexed: true,
        chunks: { $exists: true, $not: { $size: 0 } },
      }).select("id title chunks created_at");

      let loadedChunks = 0;
      let reprocessedChunks = 0;

      for (const note of notes) {
        // 重建文档信息
        this.documents.set(note.id, {
          id: note.id,
          title: note.title,
          content: note.chunks.map((chunk) => chunk.content).join("\n"),
          chunks: note.chunks.length,
          createdAt: note.created_at.toISOString(),
        });

        // 重建向量索引
        for (const chunk of note.chunks) {
          const vectorId = `${note.id}_chunk_${chunk.chunk_index}`;

          // 检查向量维度是否匹配当前设置
          if (chunk.vector && chunk.vector.length === this.vectorDimension) {
            // 向量维度匹配，直接使用
            this.vectors[vectorId] = {
              docId: note.id,
              chunk: chunk.content,
              embedding: chunk.vector,
              metadata: {
                title: note.title,
                chunkIndex: chunk.chunk_index,
                totalChunks: note.chunks.length,
                createdAt:
                  chunk.created_at?.toISOString() ||
                  note.created_at.toISOString(),
                embeddingMethod:
                  chunk.vector.length === 384 ? "huggingface" : "tfidf",
              },
            };
            loadedChunks++;
          } else {
            // 向量维度不匹配或不存在，需要重新生成
            logger.info(
              `🔄 重新生成向量: ${note.title} - chunk ${chunk.chunk_index}`
            );
            try {
              const newEmbedding = await this.generateEmbedding(chunk.content);
              this.vectors[vectorId] = {
                docId: note.id,
                chunk: chunk.content,
                embedding: newEmbedding,
                metadata: {
                  title: note.title,
                  chunkIndex: chunk.chunk_index,
                  totalChunks: note.chunks.length,
                  createdAt: new Date().toISOString(),
                  embeddingMethod: this.useHuggingFace
                    ? "huggingface"
                    : "tfidf",
                },
              };

              // 更新数据库中的向量
              await Note.updateOne(
                {
                  id: note.id,
                  "chunks.chunk_index": chunk.chunk_index,
                },
                {
                  $set: {
                    "chunks.$.vector": newEmbedding,
                    "chunks.$.updated_at": new Date(),
                  },
                }
              );

              reprocessedChunks++;
              loadedChunks++;
            } catch (error) {
              logger.warn(`⚠️ 重新生成向量失败: ${error.message}`);
            }
          }
        }
      }

      logger.info(
        `✅ 成功加载 ${notes.length} 个文档，${loadedChunks} 个向量块`
      );
      if (reprocessedChunks > 0) {
        logger.info(`🔄 重新处理了 ${reprocessedChunks} 个向量块（维度升级）`);
      }
    } catch (error) {
      logger.error("❌ 从数据库加载向量失败:", error);
      throw error;
    }
  }

  // 简单的文本分块（保持原有逻辑）
  splitText(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    const sentences = text.match(/[^。！？.!?]+[。！？.!?]+/g) || [text];
    let currentChunk = "";

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());
        // 保留重叠部分
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(
          -Math.floor((words.length * overlap) / chunkSize)
        );
        currentChunk = overlapWords.join(" ") + " " + sentence;
      } else {
        currentChunk += sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }

  // 处理文档 - 支持使用现有ID避免重复索引
  async processDocument(content, title = "未命名文档", existingNoteId = null) {
    await this.initialize();

    logger.info(`📄 处理文档: ${title}`);
    logger.info(
      `🧠 使用向量化方案: ${this.useHuggingFace ? "HuggingFace" : "TF-IDF"}`
    );
    logger.info("─".repeat(50));

    // 1. 智能分块
    const chunks = this.splitText(content);
    logger.info(`✂️ 分块完成: ${chunks.length} 个语义块`);

    // 2. 生成向量并存储到内存
    let docId;
    let isUpdate = false;

    // 🔧 修复：如果提供了现有笔记ID，使用它而不是生成新ID
    if (existingNoteId) {
      docId = existingNoteId;
      isUpdate = true;
      logger.info(`🔄 更新现有文档: ${docId}`);
    } else {
      docId = uuidv4();
      logger.info(`🆕 创建新文档: ${docId}`);
    }

    let processedChunks = 0;
    const chunksWithVectors = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      logger.info(`🔢 处理向量 ${i + 1}/${chunks.length}...`);

      const embedding = await this.generateEmbedding(chunk);
      const vectorId = `${docId}_chunk_${i}`;
      const chunkId = `${docId}_chunk_${i}`;

      // 内存存储
      this.vectors[vectorId] = {
        docId,
        chunk,
        embedding,
        metadata: {
          title,
          chunkIndex: i,
          totalChunks: chunks.length,
          createdAt: new Date().toISOString(),
          embeddingMethod: this.useHuggingFace ? "huggingface" : "tfidf",
        },
      };

      // 准备数据库存储格式
      chunksWithVectors.push({
        chunk_id: chunkId,
        content: chunk,
        vector: embedding,
        chunk_index: i,
        created_at: new Date(),
        embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
      });

      processedChunks++;
    }

    // 3. 持久化到MongoDB
    try {
      logger.info("💾 保存向量数据到MongoDB...");

      let note;
      if (isUpdate) {
        // 🔧 修复：更新现有笔记而不是查找同名文档
        note = await Note.findOne({ id: docId, deleted: false });
        if (note) {
          note.content = content;
          note.title = title;
          note.chunks = chunksWithVectors;
          note.embedding_indexed = true;
          note.updated_at = new Date();
          note.metadata = {
            ...note.metadata,
            rag_processed: true,
            vector_count: chunksWithVectors.length,
            embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
            vector_dimension: this.vectorDimension,
          };
          note = await note.save();
          logger.info(`🔄 更新了现有笔记: ${title}`);
        } else {
          throw new Error(`找不到ID为 ${docId} 的笔记`);
        }
      } else {
        // 查找是否已存在同名文档（仅在创建新文档时）
        const existingNote = await Note.findOne({
          title: title,
          deleted: false,
        });

        if (existingNote) {
          // 更新现有文档
          existingNote.content = content;
          existingNote.chunks = chunksWithVectors;
          existingNote.embedding_indexed = true;
          existingNote.updated_at = new Date();
          existingNote.metadata = {
            ...existingNote.metadata,
            rag_processed: true,
            vector_count: chunksWithVectors.length,
            embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
            vector_dimension: this.vectorDimension,
          };
          note = await existingNote.save();
          docId = existingNote.id; // 使用现有文档的ID
          logger.info(`🔄 更新了现有文档: ${title}`);
        } else {
          // 创建新文档
          note = new Note({
            id: docId,
            title,
            content,
            chunks: chunksWithVectors,
            embedding_indexed: true,
            tags: [
              "RAG处理",
              "向量索引",
              this.useHuggingFace ? "HuggingFace" : "TF-IDF",
            ],
            content_type: "generated",
            metadata: {
              rag_processed: true,
              vector_count: chunksWithVectors.length,
              embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
              vector_dimension: this.vectorDimension,
            },
          });
          await note.save();
          logger.info(`🆕 创建了新文档: ${title}`);
        }
      }

      // 4. 存储文档信息到内存
      this.documents.set(docId, {
        id: docId,
        title,
        content,
        chunks: chunks.length,
        createdAt: new Date().toISOString(),
        embeddingMethod: this.useHuggingFace ? "huggingface" : "tfidf",
      });

      logger.info(
        `🔢 向量生成: ${processedChunks} 个 ${
          this.useHuggingFace ? "HuggingFace" : "TF-IDF"
        } 向量`
      );
      logger.info(`💾 存储完成: 文档ID ${docId}`);
      logger.info("─".repeat(50));

      return {
        success: true,
        docId,
        chunks: chunks.length,
        title,
        note_id: note.id,
        persisted: true,
        embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
        vector_dimension: this.vectorDimension,
        isUpdate: isUpdate,
      };
    } catch (dbError) {
      logger.error("❌ MongoDB持久化失败:", dbError);
      logger.warn("⚠️ 向量数据仅保存在内存中，重启后将丢失");

      // 即使数据库保存失败，内存中的数据仍然可用
      this.documents.set(docId, {
        id: docId,
        title,
        content,
        chunks: chunks.length,
        createdAt: new Date().toISOString(),
        embeddingMethod: this.useHuggingFace ? "huggingface" : "tfidf",
      });

      return {
        success: true,
        docId,
        chunks: chunks.length,
        title,
        persisted: false,
        warning: "数据库保存失败，仅在内存中可用",
        embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
        isUpdate: isUpdate,
      };
    }
  }

  // 余弦相似度计算
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      logger.warn("向量维度不匹配，无法计算相似度");
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2) || 1);
    // HuggingFace向量质量更高，不需要过度调整
    return Math.min(
      1,
      Math.max(0, this.useHuggingFace ? similarity : similarity * 2)
    );
  }

  // BM25评分
  calculateBM25Score(text, queryTerms, k1 = 1.2, b = 0.75) {
    const textLength = text.length;
    const avgLength = 1000;
    let score = 0;

    queryTerms.forEach((term) => {
      const tf = (text.toLowerCase().match(new RegExp(term, "g")) || []).length;
      if (tf > 0) {
        const documentCount = Object.keys(this.vectors).length || 1;
        const documentsWithTerm =
          Object.values(this.vectors).filter((v) =>
            v.chunk.toLowerCase().includes(term)
          ).length || 1;
        const idf = Math.log(
          (documentCount - documentsWithTerm + 0.5) / (documentsWithTerm + 0.5)
        );

        score +=
          (idf * (tf * (k1 + 1))) /
          (tf + k1 * (1 - b + (b * textLength) / avgLength));
      }
    });

    return score;
  }

  // 实现真正的 Reciprocal Rank Fusion (RRF) 算法
  reciprocalRankFusion(semanticResults, bm25Results, k = 60) {
    const candidateSet = new Map();

    // 处理语义搜索结果
    semanticResults.forEach((result, rank) => {
      const id = result.id;
      const rrfScore = 1 / (k + rank + 1);

      if (candidateSet.has(id)) {
        candidateSet.get(id).semanticRRF = rrfScore;
        candidateSet.get(id).totalRRF += rrfScore;
      } else {
        candidateSet.set(id, {
          ...result,
          semanticRRF: rrfScore,
          bm25RRF: 0,
          totalRRF: rrfScore,
        });
      }
    });

    // 处理BM25搜索结果
    bm25Results.forEach((result, rank) => {
      const id = result.id;
      const rrfScore = 1 / (k + rank + 1);

      if (candidateSet.has(id)) {
        candidateSet.get(id).bm25RRF = rrfScore;
        candidateSet.get(id).totalRRF += rrfScore;
      } else {
        candidateSet.set(id, {
          ...result,
          semanticRRF: 0,
          bm25RRF: rrfScore,
          totalRRF: rrfScore,
        });
      }
    });

    // 按RRF总分排序
    return Array.from(candidateSet.values()).sort(
      (a, b) => b.totalRRF - a.totalRRF
    );
  }

  // 增强的混合搜索（使用真正的RRF算法）
  async hybridSearch(query, topK = 5) {
    await this.initialize();

    if (Object.keys(this.vectors).length === 0) {
      logger.warn("⚠️ 知识库为空，返回模拟数据");
      return this.generateMockResults(query, topK);
    }

    const queryEmbedding = await this.generateEmbedding(query);
    const queryTerms = query.toLowerCase().split(/\s+/);

    logger.info(`🔍 执行增强混合搜索: "${query}"`);
    logger.info(`📊 搜索范围: ${Object.keys(this.vectors).length} 个向量块`);
    logger.info(
      `🧠 向量化方法: ${this.useHuggingFace ? "HuggingFace" : "TF-IDF"}`
    );

    // 1. 语义搜索
    const semanticResults = [];
    for (const [id, data] of Object.entries(this.vectors)) {
      const semanticScore = this.cosineSimilarity(
        queryEmbedding,
        data.embedding
      );
      if (semanticScore > 0.1) {
        semanticResults.push({
          id,
          content: data.chunk,
          metadata: data.metadata,
          score: semanticScore,
        });
      }
    }
    semanticResults.sort((a, b) => b.score - a.score);

    // 2. BM25搜索
    const bm25Results = [];
    for (const [id, data] of Object.entries(this.vectors)) {
      const bm25Score = this.calculateBM25Score(data.chunk, queryTerms);
      if (bm25Score > 0.1) {
        bm25Results.push({
          id,
          content: data.chunk,
          metadata: data.metadata,
          score: bm25Score,
        });
      }
    }
    bm25Results.sort((a, b) => b.score - a.score);

    // 3. 使用RRF融合结果
    const fusedResults = this.reciprocalRankFusion(
      semanticResults.slice(0, topK * 2),
      bm25Results.slice(0, topK * 2)
    );

    // 4. 返回Top-K结果
    const finalResults = fusedResults.slice(0, topK).map((result) => ({
      id: result.id,
      content: result.content,
      metadata: result.metadata,
      score: result.totalRRF, // 使用RRF分数
      fusion_details: {
        semantic_rrfScore: result.semanticRRF,
        bm25_rrfScore: result.bm25RRF,
        total_rrfScore: result.totalRRF,
      },
    }));

    logger.info(`✅ 增强搜索完成:`);
    logger.info(`   • 语义候选: ${semanticResults.length} 个`);
    logger.info(`   • BM25候选: ${bm25Results.length} 个`);
    logger.info(`   • RRF融合后: ${fusedResults.length} 个`);
    logger.info(`   • 最终返回: ${finalResults.length} 个`);

    if (finalResults.length > 0) {
      logger.info(`🎯 最高RRF分数: ${finalResults[0].score.toFixed(4)}`);
    }

    return finalResults;
  }

  // 模拟结果（改进版）
  generateMockResults(query, topK) {
    const mockData = [
      {
        title: "5G NR物理层技术详解",
        content:
          "5G新无线(NR)物理层采用了多项关键技术，包括massive MIMO、灵活的帧结构、先进的信道编码等。massive MIMO通过大规模天线阵列实现空间复用和波束成形，显著提升频谱效率。LDPC码和极化码作为信道编码方案，在不同场景下提供最优性能。毫米波频段的引入扩展了可用频谱资源...",
      },
      {
        title: "massive MIMO预编码算法研究",
        content:
          "massive MIMO系统中，预编码技术是实现空间复用的关键。线性预编码算法包括迫零(ZF)和最小均方误差(MMSE)等。ZF预编码通过消除用户间干扰实现空间分离，而MMSE预编码在抑制干扰的同时考虑噪声影响。非线性预编码如脏纸编码可以进一步提升性能，但复杂度较高...",
      },
      {
        title: "毫米波通信系统设计挑战",
        content:
          "毫米波通信面临严峻的传播特性挑战。高频段信号的高路径损耗和有限穿透能力要求采用高增益天线和波束成形技术。波束管理包括波束搜索、波束跟踪和波束恢复等过程。硬件非理想特性如相位噪声、功率放大器非线性等也需要在系统设计中考虑...",
      },
      {
        title: "6G愿景与关键技术展望",
        content:
          "6G移动通信系统预计在2030年商用，将实现更高的数据速率、更低的时延和更广的连接。关键技术包括太赫兹通信、智能超表面、全息通信等。太赫兹频段提供极大带宽但传播损耗巨大。智能超表面通过可编程的电磁响应优化无线环境。空天地一体化网络架构将扩展覆盖范围...",
      },
    ];

    // 改进的相关性评分
    const queryLower = query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/);

    const scoredResults = mockData.map((item, index) => {
      let score = 0.2; // 基础分数

      // 标题匹配
      const titleLower = item.title.toLowerCase();
      queryTokens.forEach((token) => {
        if (titleLower.includes(token)) score += 0.3;
      });

      // 内容匹配
      const contentLower = item.content.toLowerCase();
      queryTokens.forEach((token) => {
        const matches = (contentLower.match(new RegExp(token, "g")) || [])
          .length;
        score += matches * 0.1;
      });

      return {
        id: `mock_${index}`,
        content: item.content,
        metadata: {
          title: item.title,
          chunkIndex: index,
          createdAt: new Date().toISOString(),
          embeddingMethod: "mock",
        },
        score: Math.min(score, 0.9), // 限制最高分数
      };
    });

    return scoredResults.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  // 删除文档
  async deleteDocument(docId) {
    try {
      const vectorIds = Object.keys(this.vectors).filter((id) =>
        id.startsWith(docId)
      );
      vectorIds.forEach((id) => delete this.vectors[id]);
      this.documents.delete(docId);

      try {
        await Note.findOneAndUpdate(
          { id: docId },
          {
            deleted: true,
            embedding_indexed: false,
            chunks: [],
          }
        );
        logger.info(`💾 已从数据库删除文档: ${docId}`);
      } catch (dbError) {
        logger.warn(`⚠️ 数据库删除失败: ${dbError.message}`);
      }

      logger.info(`🗑️ 文档 ${docId} 已删除 (${vectorIds.length} 个向量块)`);
      return true;
    } catch (error) {
      logger.error("❌ 删除文档失败:", error);
      return false;
    }
  }

  // 清空知识库
  clear() {
    this.vectors = {};
    this.documents.clear();
    logger.info("🗑️ 知识库已清空");
  }

  // 获取统计信息
  getStats() {
    const stats = {
      totalDocuments: this.documents.size,
      totalChunks: Object.keys(this.vectors).length,
      initialized: this.initialized,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
      vector_dimension: this.vectorDimension,
      huggingface_model: this.useHuggingFace ? this.embeddingModel : null,
    };

    // 分析向量方法分布
    const embeddingMethods = {};
    Object.values(this.vectors).forEach((vector) => {
      const method = vector.metadata?.embeddingMethod || "unknown";
      embeddingMethods[method] = (embeddingMethods[method] || 0) + 1;
    });
    stats.embedding_distribution = embeddingMethods;

    return stats;
  }
}

// 导出单例
export default new EnhancedRAGService();
