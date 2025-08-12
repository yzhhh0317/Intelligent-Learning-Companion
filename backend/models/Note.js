// models/Note.js - 笔记数据模型
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const noteSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
    },
    original_content: {
      type: String,
      default: "",
    },
    preview: {
      type: String,
      default: function () {
        return (
          this.content.substring(0, 200) +
          (this.content.length > 200 ? "..." : "")
        );
      },
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    content_type: {
      type: String,
      enum: ["text", "markdown", "generated", "url", "imported"],
      default: "text",
    },
    content_length: {
      type: Number,
      default: function () {
        return this.content.length;
      },
    },
    source_url: {
      type: String,
      default: null,
    },
    key_concepts: [
      {
        type: String,
      },
    ],
    embedding_indexed: {
      type: Boolean,
      default: false,
    },
    chunks: [
      {
        chunk_id: String,
        content: String,
        vector: [Number],
        chunk_index: Number,
        created_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    statistics: {
      word_count: {
        type: Number,
        default: 0,
      },
      reading_time: {
        type: Number,
        default: 0,
      },
      view_count: {
        type: Number,
        default: 0,
      },
      vector_data: {
        type: [Number], // 向量数组
        default: null,
      },
      search_hits: {
        type: Number,
        default: 0,
      },
    },
    metadata: {
      author: String,
      category: String,
      difficulty: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "intermediate",
      },
      language: {
        type: String,
        default: "zh-CN",
      },
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "notes",
  }
);

// 索引优化
noteSchema.index({ id: 1 });
noteSchema.index({ title: "text", content: "text" });
noteSchema.index({ tags: 1 });
noteSchema.index({ created_at: -1 });
noteSchema.index({ deleted: 1 });

// 中间件：更新前自动更新时间戳和统计
noteSchema.pre("save", function (next) {
  // 更新预览
  this.preview =
    this.content.substring(0, 200) + (this.content.length > 200 ? "..." : "");

  // 更新内容长度
  this.content_length = this.content.length;

  // 计算词数（中英文混合）
  const chineseCount = (this.content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = this.content
    .replace(/[\u4e00-\u9fa5]/g, "")
    .split(/\s+/)
    .filter(Boolean).length;
  this.statistics.word_count = chineseCount + englishWords;

  // 估算阅读时间（分钟）
  this.statistics.reading_time = Math.ceil(this.statistics.word_count / 200);

  next();
});

// 虚拟字段
noteSchema.virtual("summary").get(function () {
  return this.preview;
});

// 实例方法
noteSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj._id;
  delete obj.__v;
  delete obj.original_content; // 不返回原始内容，节省带宽
  return obj;
};

// 静态方法
noteSchema.statics.findByTags = function (tags) {
  return this.find({
    tags: { $in: tags },
    deleted: false,
  }).sort("-created_at");
};

noteSchema.statics.getPopularTags = async function (limit = 10) {
  const result = await this.aggregate([
    { $match: { deleted: false } },
    { $unwind: "$tags" },
    {
      $group: {
        _id: "$tags",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]);

  return result.map((item) => [item._id, item.count]);
};

noteSchema.statics.getRecentNotes = function (days = 7) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);

  return this.find({
    created_at: { $gte: dateFrom },
    deleted: false,
  }).sort("-created_at");
};

noteSchema.statics.getStatistics = async function () {
  const total = await this.countDocuments({ deleted: false });
  const recentCount = await this.countDocuments({
    created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    deleted: false,
  });
  const popularTags = await this.getPopularTags(10);

  return {
    total_notes: total,
    recent_notes_count: recentCount,
    popular_tags: popularTags,
    last_updated: await this.findOne({ deleted: false })
      .sort("-updated_at")
      .select("updated_at")
      .then((doc) => doc?.updated_at),
    database_status: "healthy",
  };
};

// 软删除
noteSchema.methods.softDelete = function () {
  this.deleted = true;
  return this.save();
};

const Note = mongoose.model("Note", noteSchema);

export default Note;
