// testDeepSeekAPI.js - 测试DeepSeek API连接
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function testDeepSeekAPI() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const apiUrl = process.env.DEEPSEEK_API_URL;
  const model = process.env.DEEPSEEK_MODEL;

  console.log("=== DeepSeek API 配置检查 ===");
  console.log("API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "NOT SET");
  console.log("API URL:", apiUrl);
  console.log("Model:", model);
  console.log("");

  if (!apiKey) {
    console.error("❌ DEEPSEEK_API_KEY 未设置");
    return;
  }

  // 测试多个可能的API端点
  const testConfigs = [
    // {
    //   name: "DeepSeek官方API",
    //   url: "https://api.deepseek.com/v1/chat/completions",
    //   model: "deepseek-chat",
    // },
    // {
    //   name: "七牛云代理",
    //   url: "https://openai.qiniu.com/v1/chat/completions",
    //   model: "deepseek-chat",
    // },
    {
      name: "当前配置",
      url: apiUrl,
      model: model,
    },
  ];

  for (const config of testConfigs) {
    console.log(`=== 测试 ${config.name} ===`);
    try {
      const response = await axios.post(
        config.url,
        {
          model: config.model,
          messages: [
            {
              role: "user",
              content: "测试消息，请简单回复",
            },
          ],
          max_tokens: 50,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      console.log("✅ 成功!");
      console.log("状态码:", response.status);
      console.log(
        "响应:",
        response.data.choices?.[0]?.message?.content || "无内容"
      );
      console.log("");

      // 如果成功，更新推荐配置
      console.log("🎉 建议使用以下配置:");
      console.log(`DEEPSEEK_API_URL=${config.url}`);
      console.log(`DEEPSEEK_MODEL=${config.model}`);
      return;
    } catch (error) {
      console.log("❌ 失败!");
      if (error.response) {
        console.log("状态码:", error.response.status);
        console.log("错误信息:", error.response.data);
      } else if (error.code === "ENOTFOUND") {
        console.log("网络连接失败 - DNS解析失败");
      } else if (error.code === "ETIMEDOUT") {
        console.log("请求超时");
      } else {
        console.log("错误:", error.message);
      }
      console.log("");
    }
  }

  console.log("❌ 所有配置都失败了，请检查:");
  console.log("1. API Key是否有效");
  console.log("2. 网络连接是否正常");
  console.log("3. 是否有防火墙阻止");
}

// 运行测试
testDeepSeekAPI().catch(console.error);
