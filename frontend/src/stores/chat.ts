import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage, ChatRequest, ChatResponse } from '../types'
import { askQuestion } from '../services/api'

export const useChatStore = defineStore('chat', () => {
  // 状态
  const chatHistory = ref<ChatMessage[]>([])
  const isLoading = ref(false)
  const lastResponse = ref<ChatResponse | null>(null)

  // 发送问题
  const sendQuestion = async (request: ChatRequest): Promise<ChatResponse> => {
    isLoading.value = true
    
    try {
      console.log('💬 发送问题:', request.question, request.use_rag ? '(RAG增强)' : '(直接问答)')
      
      const response = await askQuestion(request)
      lastResponse.value = response
      
      // 添加到对话历史
      const chatMessage: ChatMessage = {
        question: request.question,
        answer: response.answer,
        context_info: response.context_info,
        timestamp: new Date().toISOString(),
        processing_time: response.processing_time
      }
      
      chatHistory.value.push(chatMessage)
      
      console.log(`✅ 问答完成，用时: ${response.processing_time?.toFixed(2)}s`)
      if (response.sources_used > 0) {
        console.log(`🧠 使用了 ${response.sources_used} 条历史笔记`)
      }
      
      return response
      
    } catch (error) {
      console.error('❌ 问答失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // 清空对话历史
  const clearHistory = () => {
    chatHistory.value = []
    lastResponse.value = null
    console.log('🗑️ 对话历史已清空')
  }

  // 获取最后N条对话
  const getRecentChats = (n: number = 5) => {
    return chatHistory.value.slice(-n)
  }

  return {
    // 状态
    chatHistory,
    isLoading,
    lastResponse,
    
    // 方法
    sendQuestion,
    clearHistory,
    getRecentChats
  }
})