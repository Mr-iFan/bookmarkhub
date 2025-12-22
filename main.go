package main

import (
	"log"
	"os"

	"bookmarkhub/internal/config"
	"bookmarkhub/internal/controller"
	"bookmarkhub/internal/database"
	"bookmarkhub/internal/service"
	"bookmarkhub/internal/task"

	"github.com/gin-gonic/gin"
)

func main() {
	// 初始化数据库
	db, err := database.InitDB("data/bookmarkhub.db")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 初始化配置
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "config.yaml"
	}
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 执行初始同步
	if err := service.SyncConfigToDB(db, cfg); err != nil {
		log.Fatalf("Failed to sync config: %v", err)
	}

	// 初始化任务管理器
	taskManager := task.NewManager(db)
	taskManager.Start()

	// 启动文件监控
	watcher, err := config.StartWatcher(configPath, func() {
		log.Println("Config file changed, reloading...")
		cfg, err := config.LoadConfig(configPath)
		if err != nil {
			log.Printf("Failed to reload config: %v", err)
			return
		}
		// 触发同步
		if err := service.SyncConfigToDB(db, cfg); err != nil {
			log.Printf("Failed to sync config: %v", err)
			return
		}
		// 重新调度任务
		if err := taskManager.RescheduleAllBookmarks(); err != nil {
			log.Printf("Failed to reschedule bookmarks: %v", err)
		}
	})
	if err != nil {
		log.Printf("Failed to start file watcher: %v", err)
	}
	defer watcher.Close()

	// 初始化 Favicon 服务
	faviconService := service.NewFaviconService(db)

	// 启动心跳检测任务
	if err := taskManager.ScheduleAllBookmarks(); err != nil {
		log.Printf("Failed to schedule bookmarks: %v", err)
	}

	// 启动 Favicon 抓取任务
	go faviconService.FetchAllFavicons()

	// 设置 Gin 模式
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 初始化 Gin 路由（使用 New 而不是 Default，避免自动重定向）
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// CORS 中间件
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 禁用自动重定向功能
	r.RedirectTrailingSlash = false
	r.RedirectFixedPath = false

	// 初始化控制器
	bookmarkCtrl := controller.NewBookmarkController(db)

	// API 路由
	api := r.Group("/api")
	{
		api.GET("/bookmarks", bookmarkCtrl.GetBookmarks)
		api.GET("/bookmarks/tree", bookmarkCtrl.GetBookmarkTree)
		api.GET("/bookmarks/:id", bookmarkCtrl.GetBookmark)
		api.GET("/health", bookmarkCtrl.HealthCheck)
	}
	// 代理静态文件 指定目录，然后代理本地目录下的文件
	// 静态文件服务，区分 /api 路由
	r.NoRoute(func(c *gin.Context) {
		// 如果以 /api 开头，直接返回 404
		if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
			c.JSON(404, gin.H{"message": "API Not Found"})
			return
		}

		// 静态文件目录，可以通过配置指定，默认为 frontend/out
		staticDir := os.Getenv("STATIC_DIR")
		if staticDir == "" {
			staticDir = "frontend/out"
		}
		// 文件实际路径
		filePath := staticDir + c.Request.URL.Path

		// 检查文件是否存在且不是目录
		if stat, err := os.Stat(filePath); err == nil && !stat.IsDir() {
			c.File(filePath)
			return
		}
		// 不存在的路径 (SPA 路由)，都返回 index.html
		c.File(staticDir + "/index.html")
	})

	// 启动 Gin 服务器
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Starting server on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
