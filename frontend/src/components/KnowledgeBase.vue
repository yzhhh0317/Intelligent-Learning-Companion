<template>
  <div class="knowledge-base">
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
              <button @click="viewNote(note)" class="action-btn view">
                查看全部
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
            <p class="note-preview">{{ note.preview }}</p>
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

    <!-- 查看笔记模态框 -->
    <div v-if="showViewModal" class="modal-overlay" @click="closeViewModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h3>📖 查看笔记</h3>
          <button @click="closeViewModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="note-view">
            <h4 class="note-title">{{ currentNote.title }}</h4>
            <div class="note-tags-view">
              <span v-for="tag in currentNote.tags" :key="tag" class="tag">
                {{ tag }}
              </span>
            </div>
            <div class="note-content-full">{{ currentNote.content }}</div>
            <div class="note-info">
              <p><strong>创建时间：</strong>{{ formatDate(currentNote.created_at) }}</p>
              <p><strong>更新时间：</strong>{{ formatDate(currentNote.updated_at) }}</p>
              <p><strong>字数统计：</strong>{{ currentNote.statistics?.word_count || 0 }} 字</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="editNote(currentNote)" class="btn btn-primary">
            编辑笔记
          </button>
          <button @click="closeViewModal" class="btn btn-secondary">
            关闭
          </button>
        </div>
      </div>
    </div>

    <!-- 编辑笔记模态框 -->
    <div v-if="showEditModal" class="modal-overlay" @click="closeEditModal">
      <div class="modal-container large" @click.stop>
        <div class="modal-header">
          <h3>✏️ 编辑笔记</h3>
          <button @click="closeEditModal" class="close-btn">✕</button>
        </div>
        <div class="modal-body">
          <div class="edit-form">
            <div class="form-group">
              <label>笔记标题</label>
              <input 
                v-model="editForm.title" 
                type="text" 
                class="form-input"
                placeholder="输入笔记标题..."
              />
            </div>
            
            <div class="form-group">
              <label>标签 (用逗号分隔)</label>
              <input 
                v-model="editForm.tagsString" 
                type="text" 
                class="form-input"
                placeholder="例如：React, 前端开发, 学习笔记"
              />
            </div>
            
            <div class="form-group">
              <label>笔记内容</label>
              <textarea 
                v-model="editForm.content" 
                rows="15"
                class="form-textarea"
                placeholder="输入笔记内容..."
              ></textarea>
            </div>
            
            <div class="form-stats">
              <span>字数统计: {{ editForm.content.length }} 字符</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="saveNote" :disabled="isSaving" class="btn btn-primary">
            {{ isSaving ? '保存中...' : '保存修改' }}
          </button>
          <button @click="closeEditModal" class="btn btn-secondary">
            取消
          </button>
        </div>
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

// 模态框状态
const showViewModal = ref(false);
const showEditModal = ref(false);
const currentNote = ref({});
const editForm = ref({
  title: '',
  content: '',
  tagsString: ''
});
const isSaving = ref(false);

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

// 查看笔记
const viewNote = (note) => {
  currentNote.value = note;
  showViewModal.value = true;
};

// 编辑笔记
const editNote = (note) => {
  currentNote.value = note;
  editForm.value = {
    title: note.title,
    content: note.content,
    tagsString: note.tags ? note.tags.join(', ') : ''
  };
  showViewModal.value = false; // 如果是从查看模态框切换过来的
  showEditModal.value = true;
};

// 保存笔记
const saveNote = async () => {
  if (isSaving.value) return;
  
  isSaving.value = true;
  
  try {
    const tags = editForm.value.tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
    
    const noteData = {
      title: editForm.value.title,
      content: editForm.value.content,
      tags: tags
    };
    
    await api.updateNote(currentNote.value.id, noteData);
    
    // 更新本地数据
    const noteIndex = recentNotes.value.findIndex(n => n.id === currentNote.value.id);
    if (noteIndex !== -1) {
      recentNotes.value[noteIndex] = {
        ...recentNotes.value[noteIndex],
        ...noteData,
        updated_at: new Date().toISOString()
      };
    }
    
    showEditModal.value = false;
    alert('笔记更新成功！');
    
  } catch (error) {
    console.error('保存失败:', error);
    alert('保存失败: ' + error.message);
  } finally {
    isSaving.value = false;
  }
};

// 关闭模态框
const closeViewModal = () => {
  showViewModal.value = false;
  currentNote.value = {};
};

const closeEditModal = () => {
  showEditModal.value = false;
  currentNote.value = {};
  editForm.value = { title: '', content: '', tagsString: '' };
};

// 删除笔记
const deleteNote = async (noteId) => {
  if (!confirm('确定要删除这条笔记吗？')) return;
  
  try {
    await api.deleteNote(noteId);
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

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.note-item h4 {
  color: #2d3748;
  margin: 0;
}

.note-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.25rem 0.75rem;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn.view {
  background: #edf2f7;
  color: #4a5568;
}

.action-btn.view:hover {
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

.note-preview {
  color: #4a5568;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
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

/* 模态框样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-container.large {
  max-width: 800px;
  max-height: 90vh;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
}

.modal-header h3 {
  color: #2d3748;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #718096;
  padding: 0.25rem;
  transition: color 0.3s;
}

.close-btn:hover {
  color: #e53e3e;
}

.modal-body {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  background: #f8f9fa;
}

/* 查看笔记样式 */
.note-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.note-title {
  color: #2d3748;
  font-size: 1.5rem;
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e2e8f0;
}

.note-tags-view {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.note-content-full {
  background: #f7fafc;
  padding: 1.5rem;
  border-radius: 8px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: #2d3748;
  border: 1px solid #e2e8f0;
  max-height: 400px;
  overflow-y: auto;
}

.note-info {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  color: #4a5568;
  font-size: 0.875rem;
}

.note-info p {
  margin-bottom: 0.25rem;
}

/* 编辑表单样式 */
.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #4a5568;
}

.form-input {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-textarea {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.3s;
}

.form-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-stats {
  color: #718096;
  font-size: 0.875rem;
  text-align: right;
}

/* 按钮样式 */
.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5a67d8;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #e2e8f0;
  color: #4a5568;
}

.btn-secondary:hover {
  background: #cbd5e0;
}

/* 响应式 */
@media (max-width: 768px) {
  .modal-container {
    max-width: 95%;
    max-height: 95vh;
  }
  
  .note-actions {
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .action-btn {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
  }
}
</style>