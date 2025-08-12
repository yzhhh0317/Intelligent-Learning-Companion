<template>
  <div class="knowledge-base">
    <!-- <div class="page-header">
      <h2>📚 个人知识库</h2>
      <p>管理你的学习笔记，支持语义搜索</p>
    </div> -->

    <!-- 语义搜索 -->
    <div class="search-section">
      <h3>🔍 语义搜索</h3>
      <p class="search-hint">基于内容含义匹配，而非简单关键词</p>
      
      <div class="search-bar">
        <input 
          v-model="searchQuery"
          @keyup.enter="performSearch"
          type="text"
          placeholder="搜索你的笔记内容..."
          class="search-input"
        />
        <button 
          @click="performSearch"
          :disabled="!searchQuery.trim() || isSearching"
          class="search-btn"
        >
          {{ isSearching ? '搜索中...' : '搜索' }}
        </button>
      </div>

      <!-- 搜索结果 -->
      <div v-if="searchResults.length > 0" class="search-results">
        <h4>搜索结果 ({{ searchResults.length }} 条)</h4>
        <div class="result-list">
          <div v-for="result in searchResults" :key="result.id" class="result-item">
            <div class="result-header">
              <h5>{{ result.metadata.title }}</h5>
              <span class="similarity-badge">
                {{ (result.similarity * 100).toFixed(1) }}% 匹配
              </span>
            </div>
            <p class="result-preview">{{ result.preview }}</p>
            <div class="result-meta">
              <span class="meta-item">📅 {{ formatDate(result.metadata.created_at) }}</span>
              <span class="meta-item">📏 {{ result.metadata.content_length }} 字符</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="searchQuery && !isSearching && hasSearched" class="no-results">
        <p>🔍 没有找到相关笔记</p>
        <small>试试调整搜索关键词</small>
      </div>
    </div>

    <!-- 最近笔记 -->
    <div class="recent-section">
      <div class="section-header">
        <h3>📅 最近笔记</h3>
        <button @click="loadRecentNotes" class="refresh-btn">
          🔄 刷新
        </button>
      </div>

      <div v-if="recentNotes.length > 0" class="notes-list">
        <div v-for="note in recentNotes" :key="note.id" class="note-item">
          <div class="note-header">
            <h4>{{ note.title }}</h4>
            <div class="note-actions">
              <button @click="toggleNoteExpand(note)" class="action-btn expand">
                {{ note.expanded ? '收起' : '展开' }}
              </button>
              <button @click="editNote(note)" class="action-btn edit">
                编辑
              </button>
              <button @click="deleteNote(note.id)" class="action-btn delete">
                删除
              </button>
            </div>
          </div>
          
          <div class="note-content-area">
            <p v-if="!note.expanded" class="note-preview">{{ note.preview }}</p>
            <div v-else class="note-full-content">{{ note.content }}</div>
          </div>
          
          <div class="note-footer">
            <div class="note-tags">
              <span v-for="tag in note.tags" :key="tag" class="tag">
                {{ tag }}
              </span>
            </div>
            <span class="note-date">{{ formatDate(note.created_at) }}</span>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <p>📝 还没有学习笔记</p>
        <small>去「内容处理」页面生成你的第一条笔记吧！</small>
      </div>
    </div>

    <!-- 热门标签 -->
    <div v-if="stats.popular_tags.length > 0" class="tags-section">
      <h3>🏷️ 热门学习主题</h3>
      <div class="tags-cloud">
        <button 
          v-for="[tag, count] in stats.popular_tags"
          :key="tag"
          @click="searchByTag(tag)"
          class="tag-btn"
        >
          {{ tag }}
          <span class="tag-count">{{ count }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../config/api';

// 状态
const stats = ref({
  total_notes: 0,
  recent_notes_count: 0,
  popular_tags: [],
  database_status: 'unknown'
});
const recentNotes = ref([]);
const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const hasSearched = ref(false);

// 加载统计信息
const loadStats = async () => {
  try {
    stats.value = await api.getStats();
  } catch (error) {
    console.error('加载统计失败:', error);
  }
};

// 加载最近笔记
const loadRecentNotes = async () => {
  try {
    const response = await api.getRecentNotes();
    recentNotes.value = response.notes || [];
  } catch (error) {
    console.error('加载笔记失败:', error);
    recentNotes.value = [];
  }
};

// 执行搜索
const performSearch = async () => {
  if (!searchQuery.value.trim() || isSearching.value) return;
  
  isSearching.value = true;
  hasSearched.value = true;
  
  try {
    const response = await api.searchNotes(searchQuery.value);
    searchResults.value = response.results || [];
  } catch (error) {
    console.error('搜索失败:', error);
    searchResults.value = [];
  } finally {
    isSearching.value = false;
  }
};

// 根据标签搜索
const searchByTag = (tag) => {
  searchQuery.value = tag;
  performSearch();
};

// 获取数据库状态文本
const getDatabaseStatusText = () => {
  switch (stats.value.database_status) {
    case 'mongodb': return 'MongoDB';
    case 'memory': return '内存存储';
    case 'healthy': return '正常';
    default: return '未知';
  }
};

// 切换笔记展开状态
const toggleNoteExpand = (note) => {
  note.expanded = !note.expanded;
};

// 编辑笔记
const editNote = (note) => {
  // 这里可以打开编辑对话框或跳转到编辑页面
  alert(`编辑笔记: ${note.title}`);
};

// 删除笔记
const deleteNote = async (noteId) => {
  if (!confirm('确定要删除这条笔记吗？')) return;
  
  try {
    // 调用API删除笔记
    await api.deleteNote(noteId);
    // 重新加载笔记列表
    await loadRecentNotes();
    alert('笔记已删除');
  } catch (error) {
    console.error('删除失败:', error);
    alert('删除失败');
  }
};

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '未知时间';
  return new Date(dateString).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 初始化
onMounted(() => {
  loadStats();
  loadRecentNotes();
});
</script>

<style scoped>
.knowledge-base {
  padding: 0;
  max-width: 1400px;
  margin: 15px;
}

.page-header {
  text-align: center;
  margin-bottom: 2rem;
}

.page-header h2 {
  color: #333;
  margin-bottom: 0.5rem;
}

.page-header p {
  color: #666;
  font-size: 0.95rem;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  text-align: center;
  transition: transform 0.3s, box-shadow 0.3s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #718096;
}

.status-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #cbd5e0;
}

.status-dot.mongodb,
.status-dot.healthy {
  background: #48bb78;
}

.status-dot.memory {
  background: #f6ad55;
}

/* 搜索部分 */
.search-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.search-section h3 {
  color: #333;
  margin-bottom: 0.5rem;
}

.search-hint {
  color: #718096;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.search-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.search-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-btn {
  padding: 0.75rem 1.5rem;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.search-btn:hover:not(:disabled) {
  background: #5a67d8;
}

.search-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.search-results h4 {
  color: #4a5568;
  margin-bottom: 1rem;
}

.result-list {
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  background: #f8f9fa;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  transition: background 0.3s;
}

.result-item:hover {
  background: #edf2f7;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.result-header h5 {
  color: #2d3748;
  margin: 0;
}

.similarity-badge {
  background: #c6f6d5;
  color: #22543d;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

.result-preview {
  color: #4a5568;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.result-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: #718096;
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: #718096;
}

/* 最近笔记部分 */
.recent-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  color: #333;
  margin: 0;
}

.refresh-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 0.875rem;
  transition: transform 0.3s;
}

.refresh-btn:hover {
  transform: rotate(180deg);
}

.notes-list {
  max-height: 400px;
  overflow-y: auto;
}

.note-item {
  background: #f8f9fa;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  transition: background 0.3s;
}

.note-item:hover {
  background: #edf2f7;
}

.note-item h4 {
  color: #2d3748;
  margin-bottom: 0.5rem;
}

.note-preview {
  color: #4a5568;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
}

.note-full-content {
  color: #4a5568;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  white-space: pre-wrap;
  line-height: 1.6;
  background: #f7fafc;
  padding: 1rem;
  border-radius: 6px;
}

.note-content-area {
  margin-bottom: 0.75rem;
}

.note-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.action-btn {
  padding: 0.25rem 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn.expand {
  background: #edf2f7;
  color: #4a5568;
}

.action-btn.expand:hover {
  background: #667eea;
  color: white;
}

.action-btn.edit {
  background: #4299e1;
  color: white;
}

.action-btn.edit:hover {
  background: #3182ce;
}

.action-btn.delete {
  background: #fc8181;
  color: white;
}

.action-btn.delete:hover {
  background: #f56565;
}

.note-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.note-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag {
  background: #edf2f7;
  color: #4a5568;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.note-date {
  color: #718096;
  font-size: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #718096;
}

/* 标签云 */
.tags-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.5rem;
}

.tags-section h3 {
  color: #333;
  margin-bottom: 1rem;
}

.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.tag-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  border: 1px solid #667eea30;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.3s;
  color: #4a5568;
}

.tag-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.tag-count {
  background: rgba(255, 255, 255, 0.5);
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}
</style>