package database

import (
	"os"
	"path/filepath"

	"bookmarkhub/internal/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// InitDB 初始化数据库连接
func InitDB(dbPath string) (*gorm.DB, error) {
	// 确保数据目录存在
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	// 使用 glebarez/sqlite 驱动
	dsn := dbPath + "?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)"
	
	db, err := gorm.Open(sqlite.Dialector{
		DSN: dsn,
	}, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // 生产环境可以改为 logger.Info
	})
	if err != nil {
		return nil, err
	}

	// 配置连接池
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)

	// 自动迁移
	if err := AutoMigrate(db); err != nil {
		return nil, err
	}

	return db, nil
}

// AutoMigrate 自动迁移所有模型
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.Bookmark{},
		&model.SystemLog{},
	)
}

