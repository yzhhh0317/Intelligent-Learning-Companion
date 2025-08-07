import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { DemoInfo } from '../types'
import { healthCheck, getDemoInfo } from '../services/api'

export const useAppStore = defineStore('app', () => {
  // 状态
  const isOnline = ref(false)
  const apiStatus = ref<'checking' | 'online' | 'offline'>('checking')
  const demoInfo = ref<DemoInfo | null>(null)
  const currentTab = ref<'input' | 'chat' | 'knowledge'>('input')
  
  // 计算属性
  const isReady = computed(() => apiStatus.value === 'online')
  
  // 检查API状态
  const checkApiStatus = async (): Promise<void> => {
    apiStatus.value = 'checking'
    
    try {
      const health = await healthCheck()
      
      if (health.status === 'healthy') {
        apiStatus.value = 'online'
        isOnline.value = true
        console.log('✅ 后端服务连接正常')
      } else {
        apiStatus.value = 'offline'
        isOnline.value = false
        console.warn('⚠️ 后端服务状态异常:', health)
      }
      
    } catch (error) {
      apiStatus.value = 'offline'
      isOnline.value = false
      console.error('❌ 后端服务连接失败:', error)
    }
  }

  // 加载演示信息
  const loadDemoInfo = async (): Promise<void> => {
    try {
      const info = await getDemoInfo()
      demoInfo.value = info
      console.log('📋 演示信息加载完成')
    } catch (error) {
      console.error('❌ 演示信息加载失败:', error)
    }
  }

  // 切换标签页
  const switchTab = (tab: 'input' | 'chat' | 'knowledge') => {
    currentTab.value = tab
  }

  return {
    // 状态
    isOnline,
    apiStatus,
    demoInfo,
    currentTab,
    
    // 计算属性
    isReady,
    
    // 方法
    checkApiStatus,
    loadDemoInfo,
    switchTab
  }
})