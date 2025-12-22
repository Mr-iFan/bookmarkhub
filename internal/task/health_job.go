package task

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"bookmarkhub/internal/model"

	"github.com/go-resty/resty/v2"
	"github.com/panjf2000/ants/v2"
	"gorm.io/gorm"
)

const (
	// PoolSize 协程池大小
	PoolSize = 30
	// HTTPTimeout HTTP 请求超时时间
	HTTPTimeout = 10 * time.Second
	// MaxRetries 最大重试次数
	MaxRetries = 3
)

var (
	// 全局协程池
	pool      *ants.Pool
	syncOnce  sync.Once
)

// initPool 初始化协程池
func initPool() {
	syncOnce.Do(func() {
		var err error
		pool, err = ants.NewPool(PoolSize)
		if err != nil {
			panic(fmt.Sprintf("failed to create goroutine pool: %v", err))
		}
	})
}

// HealthJob 健康检测任务
type HealthJob struct {
	db       *gorm.DB
	bookmark *model.Bookmark
}

// NewHealthJob 创建健康检测任务
func NewHealthJob(db *gorm.DB, bookmark *model.Bookmark) *HealthJob {
	initPool()
	return &HealthJob{
		db:       db,
		bookmark: bookmark,
	}
}

// Run 执行健康检测
func (j *HealthJob) Run() {
	// 使用协程池执行
	_ = pool.Submit(func() {
		j.checkHealth()
	})
}

// checkHealth 执行实际的健康检测
func (j *HealthJob) checkHealth() {
	bookmark := j.bookmark

	// 解析代理和请求头
	var proxy string
	if bookmark.Proxy != "" {
		proxy = bookmark.Proxy
	}

	var headers map[string]string
	if bookmark.Headers != "" && bookmark.Headers != "{}" {
		if err := json.Unmarshal([]byte(bookmark.Headers), &headers); err != nil {
			headers = nil
		}
	}

	// 创建 HTTP 客户端
	client := resty.New().
		SetTimeout(HTTPTimeout).
		SetRetryCount(MaxRetries).
		SetRetryWaitTime(1 * time.Second).
		SetRetryMaxWaitTime(5 * time.Second)

	if proxy != "" {
		client.SetProxy(proxy)
	}

	if headers != nil {
		client.SetHeaders(headers)
	}

	// 执行检测
	startTime := time.Now()
	var statusCode int
	// 只处理有URL的书签项
	if bookmark.URL == nil {
		return // group节点没有URL，跳过健康检查
	}

	var err error

	// 优先使用 HEAD 请求
	resp, err := client.R().Head(*bookmark.URL)
	if err != nil || resp.StatusCode() >= 400 {
		// HEAD 失败，回退到 GET
		resp, err = client.R().Get(*bookmark.URL)
		if err != nil {
			// GET 也失败
			j.updateStatus(false, 0, int(time.Since(startTime).Milliseconds()), err.Error())
			return
		}
	}

	statusCode = resp.StatusCode()
	latency := int(time.Since(startTime).Milliseconds())
	isOnline := statusCode >= 200 && statusCode < 400

	j.updateStatus(isOnline, statusCode, latency, "")
}

// updateStatus 更新书签状态
func (j *HealthJob) updateStatus(isOnline bool, statusCode int, latency int, errorMsg string) {
	now := time.Now()
	updates := map[string]interface{}{
		"is_online":  isOnline,
		"status_code": statusCode,
		"latency":    latency,
		"last_check": now,
	}

	if err := j.db.Model(&model.Bookmark{}).Where("id = ?", j.bookmark.ID).Updates(updates).Error; err != nil {
		// 记录错误日志
		urlStr := ""
		if j.bookmark.URL != nil {
			urlStr = *j.bookmark.URL
		}
		logEntry := &model.SystemLog{
			Type:    model.LogTypeHealth,
			Message: fmt.Sprintf("Failed to update bookmark %s: %v", urlStr, err),
			Level:   model.LogLevelError,
		}
		_ = j.db.Create(logEntry)
		return
	}

	// 记录成功日志（可选，避免日志过多）
	if errorMsg != "" {
		urlStr := ""
		if j.bookmark.URL != nil {
			urlStr = *j.bookmark.URL
		}
		logEntry := &model.SystemLog{
			Type:    model.LogTypeHealth,
			Message: fmt.Sprintf("Health check failed for %s: %s", urlStr, errorMsg),
			Level:   model.LogLevelWarn,
		}
		_ = j.db.Create(logEntry)
	}
}

