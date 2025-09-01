// services/ragService.js - 核心RAG服务（整合enhancedRAG.js）
import { v4 as uuidv4 } from "uuid";
import Note from "../models/Note.js";
import logger from "../config/logger.js";
import axios from "axios";
import { HfInference } from "@huggingface/inference";
import { HttpsProxyAgent } from "https-proxy-agent";

class RAGService {
  constructor() {
    this.vectors = {}; // 内存向量存储
    this.documents = new Map(); // 文档存储
    this.initialized = false;
    this.useHuggingFace = !!process.env.HUGGINGFACE_API_KEY;
    this.embeddingModel =
      "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2";
    this.vectorDimension = this.useHuggingFace ? 384 : 100;
    // 代理配置
    this.proxyAgent = null;
    this.setupProxy();
  }

  // 设置代理配置
  setupProxy() {
    // 方法1: 从环境变量获取代理（推荐）
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;

    if (httpsProxy || httpProxy) {
      const proxyUrl = httpsProxy || httpProxy;
      this.proxyAgent = new HttpsProxyAgent(proxyUrl);
      logger.info(`🌐 使用代理: ${proxyUrl}`);
    } else {
      logger.info("代理都用不了");
    }
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
        // 为HfInference配置代理
        const hfOptions = {
          apiKey: process.env.HUGGINGFACE_API_KEY,
        };

        // 如果有代理，配置自定义fetch
        if (this.proxyAgent) {
          hfOptions.fetch = (url, init) => {
            return fetch(url, {
              ...init,
              agent: this.proxyAgent,
            });
          };
        }

        this.hf = new HfInference(hfOptions);
        await this.testHuggingFaceAPI();
        logger.info("✅ HuggingFace API 测试成功");
      } catch (error) {
        logger.warn("⚠️ HuggingFace API 测试失败，将使用备用TF-IDF算法");
        this.useHuggingFace = false;
        this.vectorDimension = 100;
      }
    }

    try {
      await this.loadVectorsFromDatabase();
      this.initialized = true;
      logger.info("✅ RAG服务初始化完成");
    } catch (error) {
      logger.error("❌ RAG初始化失败:", error);
      this.initialized = true;
      logger.warn("⚠️ 将使用空的RAG状态继续运行");
    }
  }

  // 测试 HuggingFace API
  async testHuggingFaceAPI() {
    const testText = "This is a test sentence.";
    try {
      logger.info("🧪 开始测试HuggingFace API连接...");

      if (this.hf) {
        // 使用官方库测试
        const embedding = await this.generateHuggingFaceEmbedding(testText);
        logger.info(`✅ 官方库测试成功，向量维度: ${embedding.length}`);
        return embedding;
      } else {
        // 使用axios测试
        const embedding = await this.generateHuggingFaceEmbeddingAxios(
          testText
        );
        logger.info(`✅ Axios方法测试成功，向量维度: ${embedding.length}`);
        return embedding;
      }
    } catch (error) {
      logger.error(`❌ HuggingFace API测试失败: ${error.message}`);

      throw error;
    }
  }

  // 方案1: 使用官方库的embedding方法（已配置代理）
  async generateHuggingFaceEmbedding(text) {
    try {
      logger.info(`调用HuggingFace API生成向量，文本长度: ${text.length}`);

      const result = await this.hf.featureExtraction({
        model: this.embeddingModel,
        inputs: text,
        options: {
          wait_for_model: true,
          use_cache: false,
        },
      });

      // HuggingFace返回的可能是嵌套数组，需要扁平化
      let embedding;
      if (Array.isArray(result) && Array.isArray(result[0])) {
        embedding = result[0]; // 取第一个句子的embedding
      } else if (Array.isArray(result)) {
        embedding = result;
      } else {
        throw new Error(`意外的响应格式: ${typeof result}`);
      }

      // 验证向量维度
      if (!Array.isArray(embedding) || embedding.length !== 384) {
        throw new Error(
          `向量维度错误: 期望384维，实际${embedding?.length || "undefined"}维`
        );
      }

      logger.info(`✅ HuggingFace向量生成成功，维度: ${embedding.length}`);
      return embedding;
    } catch (error) {
      logger.error(`❌ HuggingFace API调用失败: ${error.message}`);

      // 提供详细的错误信息
      if (error.name === "AbortError" || error.code === "ECONNRESET") {
        logger.error("网络连接问题，可能是代理配置问题");
      } else if (error.message.includes("401")) {
        logger.error("API Key无效，请检查HUGGINGFACE_API_KEY");
      } else if (error.message.includes("429")) {
        logger.error("API调用超限，请稍后重试");
      } else if (error.message.includes("503")) {
        logger.error("模型正在加载中，请稍后重试");
      }

      throw error;
    }
  }

  // 方案2: 修复后的axios方法（备用方案，已配置代理）
  async generateHuggingFaceEmbeddingAxios(text) {
    try {
      logger.info(`使用axios调用HuggingFace API，文本长度: ${text.length}`);

      // 配置axios请求，包括代理
      const axiosConfig = {
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000, // 增加到60秒
      };

      // 如果有代理，添加代理配置
      if (this.proxyAgent) {
        axiosConfig.httpsAgent = this.proxyAgent;
        axiosConfig.httpAgent = this.proxyAgent; // 也配置http代理以防万一
      }

      const response = await axios.post(
        `https://api-inference.huggingface.co/models/${this.embeddingModel}`,
        {
          inputs: [text], // 注意：inputs应该是数组格式
          options: {
            wait_for_model: true,
            use_cache: false,
          },
        },
        axiosConfig
      );

      logger.info(`API响应状态: ${response.status}`);
      logger.info(
        `响应数据类型: ${typeof response.data}, 是数组: ${Array.isArray(
          response.data
        )}`
      );

      let embedding;

      // 处理不同的响应格式
      if (Array.isArray(response.data)) {
        if (Array.isArray(response.data[0])) {
          // 格式: [[0.1, 0.2, ...]]
          embedding = response.data[0];
        } else if (typeof response.data[0] === "number") {
          // 格式: [0.1, 0.2, ...]
          embedding = response.data;
        } else {
          throw new Error(`意外的嵌套数组格式: ${typeof response.data[0]}`);
        }
      } else {
        throw new Error(`意外的响应格式: ${typeof response.data}`);
      }

      // 验证向量
      if (!Array.isArray(embedding) || embedding.length !== 384) {
        throw new Error(
          `向量维度错误: 期望384维，实际${embedding?.length || "undefined"}维`
        );
      }

      logger.info(`✅ HuggingFace向量生成成功，维度: ${embedding.length}`);
      return embedding;
    } catch (error) {
      // 详细错误处理
      if (error.response) {
        logger.error(
          `HuggingFace API错误 ${error.response.status}: ${error.response.data}`
        );

        if (error.response.status === 503) {
          logger.error("模型正在加载，建议等待1-2分钟后重试");
        } else if (error.response.status === 401) {
          logger.error("API Key验证失败，请检查HUGGINGFACE_API_KEY是否正确");
        } else if (error.response.status === 429) {
          logger.error("API请求频率超限，请稍后重试");
        }
      } else if (error.request) {
        logger.error("网络请求失败，可能是代理连接问题");
      } else {
        logger.error(`其他错误: ${error.message}`);
      }

      throw error;
    }
  }

  // 生成向量（HuggingFace 或 TF-IDF）
  async generateEmbedding(text) {
    if (this.useHuggingFace) {
      try {
        // 优先使用官方库，失败后降级到axios
        if (this.hf) {
          return await this.generateHuggingFaceEmbedding(text);
        } else {
          return await this.generateHuggingFaceEmbeddingAxios(text);
        }
      } catch (error) {
        logger.warn(`HuggingFace向量生成失败，降级到TF-IDF: ${error.message}`);
        this.useHuggingFace = false; // 暂时禁用，避免重复失败
        this.vectorDimension = 100; // 更新向量维度
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

    // 生成向量
    for (const [word, freq] of Object.entries(wordFreq)) {
      const hash1 = this.hashCode(word);
      const hash2 = this.hashCode(word.split("").reverse().join(""));

      const index1 = Math.abs(hash1) % this.vectorDimension;
      const index2 = Math.abs(hash2) % this.vectorDimension;

      const tf = freq / words.length;
      const weight = Math.log(1 + tf);

      vector[index1] += weight;
      if (index2 !== index1) {
        vector[index2] += weight * 0.5;
      }
    }

    // L2归一化
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (norm > 0) {
      return vector.map((val) => val / norm);
    }
    return vector;
  }

  // 哈希函数
  hashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
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

      for (const note of notes) {
        this.documents.set(note.id, {
          id: note.id,
          title: note.title,
          content: note.chunks.map((chunk) => chunk.content).join("\n"),
          chunks: note.chunks.length,
          createdAt: note.created_at.toISOString(),
        });

        for (const chunk of note.chunks) {
          const vectorId = `${note.id}_chunk_${chunk.chunk_index}`;

          if (chunk.vector && chunk.vector.length === this.vectorDimension) {
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
            // 重新生成向量
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

              // 更新数据库
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
    } catch (error) {
      logger.error("❌ 从数据库加载向量失败:", error);
      throw error;
    }
  }

  // 文档去噪处理
  cleanDocument(text) {
    const originalLength = text.length;
    logger.info(`开始去噪处理，原文长度: ${originalLength}`);

    // 1. 基础HTML清理
    text = text.replace(/<script[^>]*>.*?<\/script>/gi, "");
    text = text.replace(/<style[^>]*>.*?<\/style>/gi, "");
    text = text.replace(/<[^>]*>/g, " ");

    // 2. 特殊字符标准化
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&quot;/g, '"');

    // 3. 保留通信技术文档中的关键内容 - 更宽松的过滤
    // 清理多余空白，但保持段落结构
    text = text.replace(/[ \t]+/g, " "); // 多个空格/制表符合并为单个空格
    text = text.replace(/\n\s*\n\s*\n/g, "\n\n"); // 多个空行合并为双空行
    text = text.trim();

    // 4. 更宽松的质量验证 - 专门针对技术文档优化
    const lines = text.split("\n").filter((line) => {
      const trimmed = line.trim();

      // 保留非空行
      if (trimmed.length === 0) return false;

      // 大幅放宽长度限制 - 技术文档可能有很短的标题或很长的描述
      if (trimmed.length < 1) return false; // 几乎不过滤
      if (trimmed.length > 10000) return false; // 只过滤超长异常行

      // 保留markdown标题（以#开头）
      if (trimmed.match(/^#+\s/)) return true;

      // 保留编号列表
      if (trimmed.match(/^\d+\.\s/) || trimmed.match(/^[-\*\+]\s/)) return true;

      // 保留包含中文的行（技术术语解释）
      if (trimmed.match(/[\u4e00-\u9fa5]/)) return true;

      // 保留包含英文技术术语的行
      if (
        trimmed.match(
          /\b(gNB|UE|5G|NR|RRC|PDCP|QoS|AMF|SMF|UPF|CU|DU|NG-RAN)\b/i
        )
      ) {
        return true;
      }

      // 过滤纯符号行，但放宽条件
      if (trimmed.match(/^[\d\.\s\-|+()[\]{}]+$/)) return false;

      // 过滤重复字符行，但放宽条件
      if (trimmed.match(/^(.)\1{50,}$/)) return false; // 50个重复字符才过滤

      return true; // 默认保留
    });

    const cleanedText = lines.join("\n").trim();
    const cleanedLength = cleanedText.length;

    logger.info(
      `去噪完成: ${originalLength} → ${cleanedLength} 字符 (保留${(
        (cleanedLength / originalLength) *
        100
      ).toFixed(1)}%)`
    );

    // 如果去噪后内容过少，给出警告但不返回空内容
    if (cleanedLength < originalLength * 0.05) {
      logger.warn("⚠️ 去噪后内容显著减少，可能过于激进");
    }

    if (cleanedLength === 0) {
      logger.error("❌ 去噪后内容为空，返回原始内容的前5000字符");
      return text.substring(0, 5000);
    }

    return cleanedText;
  }

  // 智能文本分块
  splitText(text, chunkSize = 1000, overlap = 200) {
    logger.info(
      `开始分块处理，文本长度: ${text.length}，块大小: ${chunkSize}，重叠: ${overlap}`
    );

    if (text.length === 0) {
      logger.warn("输入文本为空，返回空分块数组");
      return [];
    }

    const chunks = [];

    // 如果文本长度小于chunk大小，直接返回整个文本
    if (text.length <= chunkSize) {
      chunks.push(text);
      logger.info(`文本较短，生成1个分块`);
      return chunks;
    }

    // 优化的分块策略：先按markdown标题分割，再按段落细分
    const sections = this.splitByHeaders(text);

    let currentChunk = "";

    for (const section of sections) {
      // 如果当前段落很长，需要进一步分割
      if (section.length > chunkSize) {
        // 先保存当前累积的块
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
          currentChunk = "";
        }

        // 对长段落进行分割
        const subChunks = this.splitLongSection(section, chunkSize, overlap);
        chunks.push(...subChunks);
      } else {
        // 检查加入后是否超出大小限制
        if (
          currentChunk.length + section.length > chunkSize &&
          currentChunk.length > 0
        ) {
          chunks.push(currentChunk.trim());

          // 创建重叠部分
          const overlapText = currentChunk.slice(-overlap).trim();
          currentChunk = overlapText + "\n\n" + section;
        } else {
          currentChunk += (currentChunk ? "\n\n" : "") + section;
        }
      }
    }

    // 处理剩余内容
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // 过滤过短的分块（降低最小长度要求）
    const validChunks = chunks.filter((chunk) => chunk.length >= 20); // 从50降到20

    logger.info(`分块完成: 生成 ${validChunks.length} 个有效分块`);

    // 输出分块统计
    validChunks.forEach((chunk, index) => {
      logger.info(`  分块 ${index + 1}: ${chunk.length} 字符`);
    });

    return validChunks;
  }

  // 新增：按标题分割的辅助方法
  splitByHeaders(text) {
    const sections = [];
    const lines = text.split("\n");
    let currentSection = "";

    for (const line of lines) {
      const trimmed = line.trim();

      // 检测markdown标题
      if (trimmed.match(/^#+\s/) && currentSection.trim()) {
        // 遇到新标题，保存当前段落
        sections.push(currentSection.trim());
        currentSection = line;
      } else {
        currentSection += (currentSection ? "\n" : "") + line;
      }
    }

    // 添加最后一个段落
    if (currentSection.trim()) {
      sections.push(currentSection.trim());
    }

    return sections.length > 0 ? sections : [text]; // 如果没有标题，返回整个文本
  }

  // 新增：长段落分割的辅助方法
  splitLongSection(section, chunkSize, overlap) {
    const chunks = [];
    const sentences = section.split(/(?<=[。！？.])\s+/); // 按句子分割（中英文）

    let currentChunk = "";

    for (const sentence of sentences) {
      if (
        currentChunk.length + sentence.length > chunkSize &&
        currentChunk.length > 0
      ) {
        chunks.push(currentChunk.trim());

        // 创建重叠
        const words = currentChunk.split(/\s+/);
        const overlapWords = words.slice(-Math.ceil(overlap / 10)); // 估算重叠词数
        currentChunk = overlapWords.join(" ") + " " + sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // 如果还是太长，强制按字符分割
    const finalChunks = [];
    for (const chunk of chunks) {
      if (chunk.length > chunkSize * 1.5) {
        // 强制字符分割
        for (let i = 0; i < chunk.length; i += chunkSize - overlap) {
          const subChunk = chunk.slice(i, i + chunkSize);
          if (subChunk.trim()) {
            finalChunks.push(subChunk.trim());
          }
        }
      } else {
        finalChunks.push(chunk);
      }
    }

    return finalChunks;
  }

  // 文档处理主流程
  // async processDocument(content, title = "未命名文档", existingNoteId = null) {
  //   await this.initialize();

  //   logger.info(`📄 处理文档: ${title}`);

  //   try {
  //     // 1. 文档清理
  //     const cleanedContent = this.cleanDocument(content);

  //     // 2. 智能分块
  //     const chunks = this.splitText(cleanedContent);
  //     logger.info(`✂️ 分块完成: ${chunks.length} 个语义块`);

  //     // 3. 确定文档ID
  //     let docId;
  //     let isUpdate = false;

  //     if (existingNoteId) {
  //       docId = existingNoteId;
  //       isUpdate = true;
  //     } else {
  //       docId = uuidv4();
  //     }

  //     // 4. 生成向量并存储
  //     const chunksWithVectors = [];
  //     for (let i = 0; i < chunks.length; i++) {
  //       const embedding = await this.generateEmbedding(chunks[i]);
  //       const vectorId = `${docId}_chunk_${i}`;

  //       // 内存存储
  //       this.vectors[vectorId] = {
  //         docId,
  //         chunk: chunks[i],
  //         embedding,
  //         metadata: {
  //           title,
  //           chunkIndex: i,
  //           totalChunks: chunks.length,
  //           createdAt: new Date().toISOString(),
  //           embeddingMethod: this.useHuggingFace ? "huggingface" : "tfidf",
  //         },
  //       };

  //       // 准备数据库存储格式
  //       chunksWithVectors.push({
  //         chunk_id: vectorId,
  //         content: chunks[i],
  //         vector: embedding,
  //         chunk_index: i,
  //         created_at: new Date(),
  //         embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
  //       });
  //     }

  //     // 5. 持久化到MongoDB
  //     await this.persistToDatabase(
  //       docId,
  //       title,
  //       content,
  //       chunksWithVectors,
  //       isUpdate
  //     );

  //     // 6. 存储文档信息到内存
  //     this.documents.set(docId, {
  //       id: docId,
  //       title,
  //       content,
  //       chunks: chunks.length,
  //       createdAt: new Date().toISOString(),
  //       embeddingMethod: this.useHuggingFace ? "huggingface" : "tfidf",
  //     });

  //     logger.info(`✅ 文档处理完成: ${chunks.length} 个向量块`);

  //     return {
  //       success: true,
  //       docId,
  //       chunks: chunks.length,
  //       title,
  //       embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
  //       vector_dimension: this.vectorDimension,
  //       isUpdate,
  //     };
  //   } catch (error) {
  //     logger.error("❌ 文档处理失败:", error);
  //     throw new Error(`文档处理失败: ${error.message}`);
  //   }
  // }

  // 持久化到数据库
  async persistToDatabase(docId, title, content, chunks, isUpdate) {
    try {
      let note;

      if (isUpdate) {
        // 查找现有笔记时增加调试信息
        logger.info(`正在查找ID为 ${docId} 的笔记进行更新`);

        note = await Note.findOne({ id: docId, deleted: false });

        if (note) {
          logger.info(`找到现有笔记: ${note.title}`);

          // 更新现有笔记的向量数据
          note.content = content;
          note.title = title;
          note.chunks = chunks;
          note.embedding_indexed = true;
          note.updated_at = new Date();

          // 更新统计信息
          note.statistics = note.statistics || {};
          note.statistics.vector_data =
            chunks.length > 0 ? chunks[0].vector : null;

          await note.save();
          logger.info(`笔记向量数据更新成功: ${note.title}`);
        } else {
          // 如果找不到现有笔记，可能是ID不匹配或笔记已被删除
          logger.warn(`未找到ID为 ${docId} 的笔记，尝试按标题查找...`);

          // 尝试按标题查找（防止ID不匹配的情况）
          const noteByTitle = await Note.findOne({
            title: title,
            deleted: false,
          });

          if (noteByTitle) {
            logger.info(`按标题找到笔记: ${noteByTitle.title}，更新其向量数据`);

            noteByTitle.chunks = chunks;
            noteByTitle.embedding_indexed = true;
            noteByTitle.updated_at = new Date();
            noteByTitle.statistics = noteByTitle.statistics || {};
            noteByTitle.statistics.vector_data =
              chunks.length > 0 ? chunks[0].vector : null;

            await noteByTitle.save();
            note = noteByTitle;
          } else {
            // 既找不到ID也找不到标题，记录警告但不抛出错误
            logger.warn(
              `无法找到匹配的笔记 (ID: ${docId}, 标题: ${title})，将创建新的向量索引记录`
            );

            // 创建一个临时的向量索引记录（不是完整的笔记）
            note = new Note({
              id: docId,
              title,
              content: "向量索引占位符", // 占位内容
              chunks,
              embedding_indexed: true,
              tags: ["向量索引", "自动生成"],
              content_type: "vector_placeholder",
              metadata: {
                rag_processed: true,
                vector_count: chunks.length,
                embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
                vector_dimension: this.vectorDimension,
                note: "这是向量索引的占位符记录",
              },
            });
            await note.save();
            logger.info(`创建向量索引占位符记录: ${docId}`);
          }
        }
      } else {
        // 创建新笔记的逻辑保持不变
        const existingNote = await Note.findOne({
          title: title,
          deleted: false,
        });

        if (existingNote) {
          // 更新现有文档
          existingNote.content = content;
          existingNote.chunks = chunks;
          existingNote.embedding_indexed = true;
          existingNote.updated_at = new Date();
          note = await existingNote.save();
          logger.info(`更新现有笔记的向量数据: ${existingNote.title}`);
        } else {
          // 创建新文档
          note = new Note({
            id: docId,
            title,
            content,
            chunks,
            embedding_indexed: true,
            tags: [
              "RAG处理",
              "向量索引",
              this.useHuggingFace ? "HuggingFace" : "TF-IDF",
            ],
            content_type: "generated",
            metadata: {
              rag_processed: true,
              vector_count: chunks.length,
              embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
              vector_dimension: this.vectorDimension,
            },
          });
          await note.save();
          logger.info(`创建新笔记: ${title}`);
        }
      }

      logger.info(`文档已持久化: ${title}`);
      return note;
    } catch (error) {
      logger.error("数据库持久化失败:", error);

      // 不要抛出错误，而是记录问题并返回null
      logger.warn(`持久化失败但不影响向量索引: ${error.message}`);
      return null;
    }
  }

  // 同时需要修复processDocument方法中的调用逻辑
  async processDocument(content, title = "未命名文档", existingNoteId = null) {
    await this.initialize();

    logger.info(`处理文档: ${title}`);

    try {
      // 1. 文档清理
      const cleanedContent = this.cleanDocument(content);

      // 2. 智能分块
      const chunks = this.splitText(cleanedContent);
      logger.info(`分块完成: ${chunks.length} 个语义块`);

      // 3. 确定文档ID和更新标识
      let docId;
      let isUpdate = false;

      if (existingNoteId) {
        docId = existingNoteId;
        isUpdate = true;
        logger.info(`准备更新现有笔记: ${docId}`);
      } else {
        docId = uuidv4();
        logger.info(`准备创建新文档: ${docId}`);
      }

      // 4. 生成向量并存储
      const chunksWithVectors = [];
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await this.generateEmbedding(chunks[i]);
        const vectorId = `${docId}_chunk_${i}`;

        // 内存存储
        this.vectors[vectorId] = {
          docId,
          chunk: chunks[i],
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
          chunk_id: vectorId,
          content: chunks[i],
          vector: embedding,
          chunk_index: i,
          created_at: new Date(),
          embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
        });
      }

      // 5. 持久化到MongoDB（使用改进的方法，不会因为找不到笔记而失败）
      const persistResult = await this.persistToDatabase(
        docId,
        title,
        content,
        chunksWithVectors,
        isUpdate
      );

      // 6. 存储文档信息到内存
      this.documents.set(docId, {
        id: docId,
        title,
        content,
        chunks: chunks.length,
        createdAt: new Date().toISOString(),
        embeddingMethod: this.useHuggingFace ? "huggingface" : "tfidf",
      });

      logger.info(`文档处理完成: ${chunks.length} 个向量块`);

      return {
        success: true,
        docId,
        chunks: chunks.length,
        title,
        embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
        vector_dimension: this.vectorDimension,
        isUpdate,
        persistResult: persistResult ? "success" : "partial", // 标识持久化结果
      };
    } catch (error) {
      logger.error("文档处理失败:", error);
      throw new Error(`文档处理失败: ${error.message}`);
    }
  }

  // 余弦相似度计算
  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      logger.warn("向量维度不匹配或向量为空");
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      if (typeof vec1[i] !== "number" || typeof vec2[i] !== "number") {
        logger.warn("向量包含非数字值");
        return 0;
      }
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    if (denominator === 0) {
      return 0;
    }

    const similarity = dotProduct / denominator;

    // 确保相似度在合理范围内
    return Math.min(1, Math.max(-1, similarity));
  }

  // BM25评分
  calculateBM25Score(text, queryTerms, k1 = 1.2, b = 0.75) {
    if (!text || queryTerms.length === 0) return 0;

    const textLower = text.toLowerCase();
    const words = textLower.split(/\s+/).filter((word) => word.length > 0);
    const textLength = words.length; // 使用词数而不是字符数
    const avgLength = 100; // 假设平均文档词数
    let totalScore = 0;

    // 为每个查询词计算BM25得分
    queryTerms.forEach((queryTerm) => {
      const term = queryTerm.toLowerCase().trim();
      if (term.length === 0) return;

      // 计算词频 (TF)
      let tf = 0;
      words.forEach((word) => {
        if (word.includes(term) || term.includes(word)) {
          tf += 1;
        }
      });

      if (tf > 0) {
        // 计算文档频率 (DF)
        const totalDocs = Object.keys(this.vectors).length || 1;
        let docsWithTerm = 0;

        for (const vectorData of Object.values(this.vectors)) {
          if (vectorData.chunk.toLowerCase().includes(term)) {
            docsWithTerm += 1;
          }
        }

        // 防止除零错误
        docsWithTerm = Math.max(1, docsWithTerm);

        // IDF计算
        const idf = Math.log(
          (totalDocs - docsWithTerm + 0.5) / (docsWithTerm + 0.5)
        );

        // BM25公式
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + (b * textLength) / avgLength);
        const termScore = idf * (numerator / denominator);

        totalScore += Math.max(0, termScore);

        // 调试信息
        if (termScore > 0) {
          logger.info(
            `BM25计算 - 词:"${term}", TF:${tf}, DF:${docsWithTerm}/${totalDocs}, IDF:${idf.toFixed(
              3
            )}, 得分:${termScore.toFixed(4)}`
          );
        }
      }
    });

    return totalScore;
  }

  // Reciprocal Rank Fusion 算法
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

  // 混合搜索（核心搜索功能）
  async hybridSearch(query, topK = 5) {
    await this.initialize();

    if (Object.keys(this.vectors).length === 0) {
      logger.warn("知识库为空，返回空结果");
      return [];
    }

    const queryEmbedding = await this.generateEmbedding(query);
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 1); // 过滤掉太短的词

    logger.info(`执行混合搜索: "${query}" (查询词: ${queryTerms.join(", ")})`);

    // 1. 语义搜索
    const semanticResults = [];
    for (const [id, data] of Object.entries(this.vectors)) {
      const semanticScore = this.cosineSimilarity(
        queryEmbedding,
        data.embedding
      );
      if (semanticScore > 0.2) {
        semanticResults.push({
          id,
          content: data.chunk,
          metadata: data.metadata,
          score: semanticScore,
        });
      }
    }
    semanticResults.sort((a, b) => b.score - a.score);
    logger.info(`语义搜索找到 ${semanticResults.length} 个候选结果`);

    // 2. BM25搜索 - 增强版
    const bm25Results = [];
    for (const [id, data] of Object.entries(this.vectors)) {
      const bm25Score = this.calculateBM25Score(data.chunk, queryTerms);

      // 调试输出前几个计算结果
      if (bm25Results.length < 3 && bm25Score > 0) {
        logger.info(
          `BM25候选 - ID:${id.substring(0, 8)}..., 得分:${bm25Score.toFixed(
            4
          )}, 内容:"${data.chunk.substring(0, 50)}..."`
        );
      }

      if (bm25Score > 0.08) {
        bm25Results.push({
          id,
          content: data.chunk,
          metadata: data.metadata,
          score: bm25Score,
        });
      }
    }
    bm25Results.sort((a, b) => b.score - a.score);
    logger.info(`BM25搜索找到 ${bm25Results.length} 个候选结果`);

    // 输出前几个BM25结果的得分
    bm25Results.slice(0, 3).forEach((result, index) => {
      logger.info(
        `  BM25结果${index + 1}: 得分=${result.score.toFixed(
          4
        )}, 内容="${result.content.substring(0, 30)}..."`
      );
    });

    // 3. RRF融合
    const fusedResults = this.reciprocalRankFusion(
      semanticResults.slice(0, topK * 2),
      bm25Results.slice(0, topK * 2),
      60 // k=60
    );

    // 4. 返回最终结果
    const finalResults = fusedResults.slice(0, topK).map((result) => ({
      id: result.id,
      content: result.content,
      metadata: result.metadata,
      score: result.totalRRF,
      match_type:
        result.bm25RRF > 0 && result.semanticRRF > 0
          ? "hybrid"
          : result.bm25RRF > 0
          ? "keyword"
          : "semantic",
      fusion_details: {
        semantic_rrfScore: result.semanticRRF,
        bm25_rrfScore: result.bm25RRF,
        total_rrfScore: result.totalRRF,
      },
    }));

    logger.info(`混合搜索完成: 返回 ${finalResults.length} 个结果`);

    return finalResults;
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
          { deleted: true, embedding_indexed: false, chunks: [] }
        );
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
    return {
      totalDocuments: this.documents.size,
      totalChunks: Object.keys(this.vectors).length,
      initialized: this.initialized,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      embedding_method: this.useHuggingFace ? "huggingface" : "tfidf",
      vector_dimension: this.vectorDimension,
      huggingface_model: this.useHuggingFace ? this.embeddingModel : null,
    };
  }
}

export default new RAGService();
