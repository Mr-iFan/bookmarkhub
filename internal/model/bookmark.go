package model

import (
	"time"

	"gorm.io/gorm"
)

// Bookmark 书签模型
type Bookmark struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// 基础字段
	Name     string  `gorm:"not null;index" json:"name"`
	URL      *string `gorm:"uniqueIndex" json:"url"` // 允许为NULL，group节点为NULL，书签项为实际URL
	Icon     string  `gorm:"type:text" json:"icon"`  // base64 编码的图标
	ParentID *uint   `gorm:"index" json:"parent_id"` // 树形结构父节点

	// 状态字段
	IsOnline  bool       `gorm:"default:false;index" json:"is_online"`
	StatusCode int        `gorm:"default:0" json:"status_code"`
	Latency    int        `gorm:"default:0" json:"latency"` // 延迟（毫秒）
	LastCheck  *time.Time `json:"last_check"`

	// 配置字段（继承后的有效值）
	Proxy         string `gorm:"type:text" json:"proxy"`         // 代理地址
	Headers       string `gorm:"type:text" json:"headers"`       // JSON 格式的请求头
	HeartbeatCron string `gorm:"default:'0 */30 * * * *'" json:"heartbeat_cron"` // Cron 表达式

	// 关联关系
	Parent   *Bookmark   `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children []Bookmark  `gorm:"foreignKey:ParentID" json:"children,omitempty"`
}

// TableName 指定表名
func (Bookmark) TableName() string {
	return "bookmarks"
}

