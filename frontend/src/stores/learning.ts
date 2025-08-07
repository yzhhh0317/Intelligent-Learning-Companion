import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Note, SearchResult, KnowledgeStats, ContentProcessResult } from '../types'
import { 
  generateSummary, 
  generateNotes, 
  searchNotes,
  getRecentNotes,
  getKnowledgeStats,
  extractFromUrl
} from '../services/api'

export const useLearningStore = defineStore('learning', () => {
  // 状态
  const currentContent = ref('')
  const currentTitle = ref('')
  const recentNotes = ref<Note[]>([])
  const knowledgeStats = ref<KnowledgeStats>({
    total_notes: 0,
    recent_notes_count: 0,
    popular_tags: [],
    last_updated: null,
    database_status: 'unknown'
  })
  const isProcessing = ref(false)
  const lastProcessResult = ref<ContentProcessResult | null>(null)

  // 计算属性
  const hasContent = computed(() => currentContent.value.trim().length > 0)
  const contentWordCount = computed(() => currentContent.value.trim().split(/\s+/).length)
  const canProcess = computed(() => hasContent.value && !isProcessing.value)

  // 方法
  const setCurrentContent = (content: string, title: string = '') => {
    currentContent.value = content
    currentTitle.value = title
    console.log('📝 设置当前学习内容:', title || '无标题', `(${contentWordCount.value} 词)`)
  }

  const clearCurrentContent = () => {
    currentContent.value = ''
    currentTitle.value = ''
    lastProcessResult.value = null
  }

  // 从URL提取内容
  const extractContentFromUrl = async (url: string): Promise<void> => {
    isProcessing.value = true
    try {
      console.log('🌐 从URL提取内容:', url)
      const result = await extractFromUrl(url)
      
      setCurrentContent(result.content, result.title)
      
      // 显示提取结果统计
      console.log(`✅ 内容提取成功: ${result.content_length} 字符`)
      
    } catch (error) {
      console.error('❌ URL内容提取失败:', error)
      throw new Error(`无法提取URL内容: ${error}`)
    } finally {
      isProcessing.value = false
    }
  }

  // 生成摘要
  const generateContentSummary = async (): Promise<string> => {
    if (!hasContent.value) throw new Error('没有内容可以摘要')
    
    isProcessing.value = true
    try {
      console.log('📄 生成内容摘要...')
      const result = await generateSummary(currentContent.value)
      lastProcessResult.value = result
      
      console.log(`✅ 摘要生成成功，压缩比: ${(result.compression_ratio! * 100).toFixed(1)}%`)
      return result.summary!
      
    } catch (error) {
      console.error('❌ 摘要生成失败:', error)
      throw error
    } finally {
      isProcessing.value = false
    }
  }

  // 生成结构化笔记
  const generateStructuredNotes = async (autoSave: boolean = true): Promise<string> => {
    if (!hasContent.value) throw new Error('没有内容可以生成笔记')
    
    isProcessing.value = true
    try {
      console.log('📝 生成结构化笔记...')
      const result = await generateNotes(
        currentContent.value, 
        currentTitle.value,
        [] // 标签暂时为空，让AI自动提取
      )
      
      if (autoSave && result.saved) {
        // 刷新知识库数据
        await Promise.all([
          loadRecentNotes(),
          loadKnowledgeStats()
        ])
        console.log(`✅ 笔记已保存到知识库: ${result.note_id}`)
      }
      
      return result.notes
      
    } catch (error) {
      console.error('❌ 结构化笔记生成失败:', error)
      throw error
    } finally {
      isProcessing.value = false
    }
  }

  // 语义搜索
  const performSemanticSearch = async (query: string): Promise<SearchResult[]> => {
    try {
      console.log('🔍 执行语义搜索:', query)
      const result = await searchNotes(query, 5)
      console.log(`✅ 搜索完成，找到 ${result.total_found} 条相关笔记`)
      return result.results
    } catch (error) {
      console.error('❌ 语义搜索失败:', error)
      throw error
    }
  }

  // 加载最近笔记
  const loadRecentNotes = async (days: number = 7): Promise<void> => {
    try {
      const result = await getRecentNotes(days)
      recentNotes.value = result.notes
      console.log(`📚 加载了 ${result.notes.length} 条最近笔记`)
    } catch (error) {
      console.error('❌ 加载最近笔记失败:', error)
      recentNotes.value = []
    }
  }

  // 加载知识库统计
  const loadKnowledgeStats = async (): Promise<void> => {
    try {
      const stats = await getKnowledgeStats()
      knowledgeStats.value = stats
      console.log(`📊 知识库统计: ${stats.total_notes} 条笔记`)
    } catch (error) {
      console.error('❌ 加载知识库统计失败:', error)
    }
  }

  return {
    // 状态
    currentContent,
    currentTitle,
    recentNotes,
    knowledgeStats,
    isProcessing,
    lastProcessResult,
    
    // 计算属性
    hasContent,
    contentWordCount,
    canProcess,
    
    // 方法
    setCurrentContent,
    clearCurrentContent,
    extractContentFromUrl,
    generateContentSummary,
    generateStructuredNotes,
    performSemanticSearch,
    loadRecentNotes,
    loadKnowledgeStats
  }
})