package main

import (
	"log"
	"path/filepath"
	"testing"

	"bookmarkhub/internal/config"
	"bookmarkhub/internal/database"
	"bookmarkhub/internal/service"
	"bookmarkhub/internal/task"

	"gorm.io/gorm"
)

// reloadConfigCallback 配置重载回调函数（从 main 函数中提取）
func reloadConfigCallback(configPath string, db *gorm.DB, taskManager *task.Manager) error {
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		return err
	}

	// 触发同步
	if err := service.SyncConfigToDB(db, cfg); err != nil {
		return err
	}

	// 重新调度任务
	if err := taskManager.RescheduleAllBookmarks(); err != nil {
		return err
	}

	return nil
}

func TestConfigSync(t *testing.T) {
	basePath := "/Users/ifan/software/bookmarkhub"
	// 初始化测试数据库
	dbPath := filepath.Join(basePath, "data", "bookmarkhub.db")
	db, err := database.InitDB(dbPath)
	if err != nil {
		t.Fatalf("初始化数据库失败: %v", err)
	}
	defer func() {
		sqlDB, _ := db.DB()
		if sqlDB != nil {
			sqlDB.Close()
		}
	}()
	cfg, err := config.LoadConfig(filepath.Join(basePath, "config.yaml"))
	if err != nil {
		log.Printf("Failed to reload config: %v", err)
		return
	}
	// 触发同步
	if err := service.SyncConfigToDB(db, cfg); err != nil {
		log.Printf("Failed to sync config: %v", err)
		return
	}
}
