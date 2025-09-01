// utils/errorHandler.js - 统一错误处理
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const errorHandler = (err, req, res, next) => {
  console.error("API错误:", err.message);

  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "内部服务器错误",
    ...(isDevelopment && { stack: err.stack }),
  });
};
