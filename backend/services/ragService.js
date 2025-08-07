// services/ragService.js - RAG（检索增强生成）核心服务
import { ChromaClient } from "chromadb";
import { OpenAI } from "openai";
import logger from "../config/logger.js";
import Note from "../models/Note.js";

class RAGService {
  constructor() {
    // 初始化ChromaDB客户端
    this.chromaClient = new ChromaClient({
      path: `http://${process.env.CHROMA_HOST || "localhost"}:${
        process.env.CHROMA_PORT || 8000
      }`,
    });

    // 初始化OpenAI客户端（用于向量化）
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    this.collectionName = process.env.CHROMA_COLLECTION || "learning_notes";
    this.collection = null;
    this.embeddingDimension = 1536; // OpenAI embedding维度
  }

  /**
   * 初始化向量存储
   */
  async initialize() {
    try {
      // 获取或创建collection
      const collections = await this.chromaClient.listCollections();
      const exists = collections.some((c) => c.name === this.collectionName);

      if (exists) {
        this.collection = await this.chromaClient.getCollection({
          name: this.collectionName,
        });
      } else {
        this.collection = await this.chromaClient.createCollection({
          name: this.collectionName,
          metadata: {
            description: "智能学习伴侣知识库向量存储",
            created_at: new Date().toISOString(),
          },
        });
      }

      logger.info(`✅ ChromaDB collection "${this.collectionName}" 已就绪`);
      return true;
    } catch (error) {
      logger.error("ChromaDB初始化失败:", error);
      // 如果ChromaDB不可用，使用备用方案
      logger.warn("⚠️ 使用内存向量存储作为备用方案");
      this.useMemoryStore = true;
      this.memoryStore = new Map();
      return false;
    }
  }

  /**
   * 生成文本向量
   * @param {String} text - 要向量化的文本
   */
  async generateEmbedding(text) {
    if (!this.openai) {
      // 如果没有OpenAI，使用简单的哈希向量（演示用）
      return this.generateSimpleEmbedding(text);
    }

    try {
      const response = await this.openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || "text-embedding-ada-002",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error("向量生成失败:", error);
      return this.generateSimpleEmbedding(text);
    }
  }

  /**
   * 简单的向量生成（备用方案）
   */
  generateSimpleEmbedding(text) {
    // 生成一个简单的向量表示（仅用于演示）
    const vector = new Array(this.embeddingDimension).fill(0);
    const words = text.toLowerCase().split(/\s+/);

    words.forEach((word, i) => {
      const hash = this.hashCode(word);
      const index = Math.abs(hash) % this.embeddingDimension;
      vector[index] += 1 / (i + 1); // 位置权重
    });

    // 归一化
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map((val) => val / (norm || 1));
  }

  /**
   * 简单哈希函数
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * 向量化并存储笔记
   * @param {Object} note - 笔记对象
   */
  async indexNote(note) {
    try {
      // 组合文本用于向量化
      const textToEmbed = `${note.title}\n${note.content}`;
      const embedding = await this.generateEmbedding(textToEmbed);

      if (this.useMemoryStore) {
        // 使用内存存储
        this.memoryStore.set(note.id, {
          id: note.id,
          embedding,
          metadata: {
            title: note.title,
            tags: note.tags.join(","),
            created_at: note.created_at,
            content_length: note.content.length,
            content_type: note.content_type,
          },
          content: note.content,
        });
      } else {
        // 使用ChromaDB
        await this.collection.add({
          ids: [note.id],
          embeddings: [embedding],
          metadatas: [
            {
              title: note.title,
              tags: note.tags.join(","),
              created_at: note.created_at.toISOString(),
              content_length: note.content.length,
              content_type: note.content_type || "text",
            },
          ],
          documents: [note.content],
        });
      }

      logger.info(`📝 笔记已索引: ${note.title} (ID: ${note.id})`);
      return true;
    } catch (error) {
      logger.error("笔记索引失败:", error);
      throw error;
    }
  }

  /**
   * 语义搜索
   * @param {String} query - 搜索查询
   * @param {Number} nResults - 返回结果数量
   * @param {Number} minSimilarity - 最小相似度阈值
   */
  async semanticSearch(query, nResults = 5, minSimilarity = 0.6) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);

      if (this.useMemoryStore) {
        // 内存存储搜索
        return this.memorySearch(queryEmbedding, nResults, minSimilarity);
      }

      // ChromaDB搜索
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: nResults * 2, // 获取更多结果用于过滤
        include: ["metadatas", "documents", "distances"],
      });

      // 转换并过滤结果
      const searchResults = [];
      for (let i = 0; i < results.ids[0].length; i++) {
        const similarity = 1 - results.distances[0][i]; // 转换为相似度

        if (similarity >= minSimilarity) {
          searchResults.push({
            id: results.ids[0][i],
            content: results.documents[0][i],
            preview: results.documents[0][i].substring(0, 200) + "...",
            metadata: results.metadatas[0][i],
            similarity: similarity,
          });
        }
      }

      // 按相似度排序并限制数量
      searchResults.sort((a, b) => b.similarity - a.similarity);
      return searchResults.slice(0, nResults);
    } catch (error) {
      logger.error("语义搜索失败:", error);
      throw error;
    }
  }

  /**
   * 内存存储搜索（备用方案）
   */
  memorySearch(queryEmbedding, nResults, minSimilarity) {
    const results = [];

    for (const [id, item] of this.memoryStore) {
      const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);

      if (similarity >= minSimilarity) {
        results.push({
          id: item.id,
          content: item.content,
          preview: item.content.substring(0, 200) + "...",
          metadata: item.metadata,
          similarity,
        });
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, nResults);
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 检索相关文档用于RAG
   * @param {String} query - 查询
   * @param {Number} topK - 返回文档数量
   */
  async retrieveContext(query, topK = 3) {
    try {
      const searchResults = await this.semanticSearch(query, topK, 0.5);

      // 获取完整的笔记内容
      const noteIds = searchResults.map((r) => r.id);
      const notes = await Note.find({ id: { $in: noteIds } });

      // 组合上下文
      const context = notes.map((note) => ({
        id: note.id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        similarity:
          searchResults.find((r) => r.id === note.id)?.similarity || 0,
      }));

      return context;
    } catch (error) {
      logger.error("上下文检索失败:", error);
      return [];
    }
  }

  /**
   * 删除向量索引
   * @param {String} noteId - 笔记ID
   */
  async deleteIndex(noteId) {
    try {
      if (this.useMemoryStore) {
        this.memoryStore.delete(noteId);
      } else {
        await this.collection.delete({
          ids: [noteId],
        });
      }

      logger.info(`🗑️ 向量索引已删除: ${noteId}`);
      return true;
    } catch (error) {
      logger.error("删除向量索引失败:", error);
      throw error;
    }
  }

  /**
   * 更新向量索引
   * @param {Object} note - 更新后的笔记
   */
  async updateIndex(note) {
    // 先删除旧索引
    await this.deleteIndex(note.id);
    // 重新索引
    await this.indexNote(note);
  }

  /**
   * 获取向量存储统计信息
   */
  async getStats() {
    try {
      if (this.useMemoryStore) {
        return {
          total_vectors: this.memoryStore.size,
          storage_type: "memory",
          status: "healthy",
        };
      }

      const count = await this.collection.count();
      return {
        total_vectors: count,
        storage_type: "chromadb",
        collection_name: this.collectionName,
        status: "healthy",
      };
    } catch (error) {
      return {
        total_vectors: 0,
        storage_type: "unknown",
        status: "error",
        error: error.message,
      };
    }
  }
}

export default new RAGService();
