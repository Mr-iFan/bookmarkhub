package model

import (
	"time"

	"gorm.io/gorm"
)

// SystemLog 系统日志模型
type SystemLog struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// 日志字段
	Type    string `gorm:"not null;index" json:"type"`    // sync/health/favicon
	Message string `gorm:"type:text" json:"message"`     // 日志消息
	Level   string `gorm:"not null;index" json:"level"`   // info/error/warn
}

// TableName 指定表名
func (SystemLog) TableName() string {
	return "system_logs"
}

// LogType 日志类型常量
const (
	LogTypeSync    = "sync"
	LogTypeHealth  = "health"
	LogTypeFavicon = "favicon"
)

// LogLevel 日志级别常量
const (
	LogLevelInfo  = "info"
	LogLevelWarn  = "warn"
	LogLevelError = "error"
)

