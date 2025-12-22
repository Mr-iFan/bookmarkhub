package task

import (
	"fmt"
	"sync"

	"bookmarkhub/internal/model"
	"bookmarkhub/internal/service"

	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

// Manager 任务管理器
type Manager struct {
	cron    *cron.Cron
	db      *gorm.DB
	entries map[string]cron.EntryID // taskID -> entryID
	mu      sync.RWMutex
}

// NewManager 创建任务管理器
func NewManager(db *gorm.DB) *Manager {
	return &Manager{
		cron:    cron.New(cron.WithSeconds()), // 支持秒级精度
		db:      db,
		entries: make(map[string]cron.EntryID),
	}
}

// Start 启动任务管理器
func (m *Manager) Start() {
	m.cron.Start()
}

// Stop 停止任务管理器
func (m *Manager) Stop() {
	m.cron.Stop()
}

// ScheduleBookmark 为单个书签调度任务
func (m *Manager) ScheduleBookmark(bookmark *model.Bookmark) error {
	// 只处理有URL的书签项，group节点不需要健康检查
	if bookmark.URL == nil {
		return nil
	}
	
	taskID := service.GetBookmarkTaskID(*bookmark.URL)

	m.mu.Lock()
	defer m.mu.Unlock()

	// 如果任务已存在，先删除
	if entryID, exists := m.entries[taskID]; exists {
		m.cron.Remove(entryID)
		delete(m.entries, taskID)
	}

	// 创建健康检测任务
	job := NewHealthJob(m.db, bookmark)

	// 添加新任务
	entryID, err := m.cron.AddJob(bookmark.HeartbeatCron, job)
	if err != nil {
		return fmt.Errorf("failed to schedule bookmark %s: %w", *bookmark.URL, err)
	}

	m.entries[taskID] = entryID
	return nil
}

// UnscheduleBookmark 取消书签任务调度
func (m *Manager) UnscheduleBookmark(url string) error {
	taskID := service.GetBookmarkTaskID(url)

	m.mu.Lock()
	defer m.mu.Unlock()

	if entryID, exists := m.entries[taskID]; exists {
		m.cron.Remove(entryID)
		delete(m.entries, taskID)
	}

	return nil
}

// ScheduleAllBookmarks 为所有书签调度任务
func (m *Manager) ScheduleAllBookmarks() error {
	var bookmarks []model.Bookmark
	if err := m.db.Find(&bookmarks).Error; err != nil {
		return fmt.Errorf("failed to query bookmarks: %w", err)
	}

	for i := range bookmarks {
		if err := m.ScheduleBookmark(&bookmarks[i]); err != nil {
			// 记录错误但继续处理其他书签
			_ = err
		}
	}

	return nil
}

// RescheduleAllBookmarks 重新调度所有书签（用于配置更新后）
func (m *Manager) RescheduleAllBookmarks() error {
	// 清除所有现有任务
	m.mu.Lock()
	for _, entryID := range m.entries {
		m.cron.Remove(entryID)
	}
	m.entries = make(map[string]cron.EntryID)
	m.mu.Unlock()

	// 重新调度所有书签
	return m.ScheduleAllBookmarks()
}

