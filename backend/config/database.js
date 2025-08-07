// config/database.js - MongoDB数据库配置
import mongoose from "mongoose";
import logger from "./logger.js";

export async function connectDB() {
  try {
    const uri =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/intelligent-learning";

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB连接错误:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB连接断开");
    });

    logger.info("✅ MongoDB连接成功");
    return mongoose.connection;
  } catch (error) {
    logger.error("❌ MongoDB连接失败:", error);
    throw error;
  }
}
