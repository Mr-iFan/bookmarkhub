// Package cmd provides the command-line interface for the bookmark navigation generator.
package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"

	"bookmarkhub/internal/config"
	"bookmarkhub/internal/generator"
	"bookmarkhub/internal/manager"
	"bookmarkhub/internal/server"
)

const (
	defaultPort      = 8080
	defaultOutputDir = "./output"
	configFile       = "config.yaml"
	templateFile     = "config.template.yaml"
)

var (
	port      int
	outputDir string
)

// rootCmd represents the base command when called without any subcommands.
// Default behavior is to start the web server (Requirement 4.1).
var rootCmd = &cobra.Command{
	Use:   "bookmarkhub",
	Short: "书签导航网站生成器",
	Long: `书签导航网站生成器是一个基于 Go 语言的工具，
能够解析 YAML 配置文件中的书签数据，使用 HTML 模板生成静态导航页面，
同时支持启动 Web 服务实时预览。`,
	RunE: runServe,
}

// serveCmd represents the serve command (Requirement 4.3).
var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "启动 Web 服务",
	Long:  `启动 HTTP 服务器，实时预览书签导航页面。`,
	RunE:  runServe,
}

// generateCmd represents the generate command (Requirement 4.2).
var generateCmd = &cobra.Command{
	Use:   "generate",
	Short: "生成 HTML 文件",
	Long:  `根据配置文件生成静态 HTML 导航页面。`,
	RunE:  runGenerate,
}

func init() {
	// Add --port flag to root and serve commands (Requirement 4.4)
	rootCmd.Flags().IntVarP(&port, "port", "p", defaultPort, "Web 服务端口")
	serveCmd.Flags().IntVarP(&port, "port", "p", defaultPort, "Web 服务端口")

	// Add --output flag to generate command (Requirement 4.5)
	generateCmd.Flags().StringVarP(&outputDir, "output", "o", defaultOutputDir, "HTML 文件输出目录")

	// Add subcommands
	rootCmd.AddCommand(serveCmd)
	rootCmd.AddCommand(generateCmd)
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

// loadConfigOrGenerateTemplate loads the configuration file or generates a template if it doesn't exist.
// Returns the config and an error. If config doesn't exist, generates template and returns error (Requirement 1.3, 7.1, 7.2, 7.3).
func loadConfigOrGenerateTemplate() (*config.Config, error) {
	if !config.ConfigExists(configFile) {
		// Generate template file (Requirement 7.1)
		if err := config.GenerateTemplate(templateFile); err != nil {
			return nil, fmt.Errorf("生成配置模板失败: %w", err)
		}
		// Output prompt message and exit with non-zero status (Requirement 7.3)
		fmt.Printf("配置文件 %s 不存在。\n", configFile)
		fmt.Printf("已生成配置模板文件 %s，请根据需要修改后重命名为 %s。\n", templateFile, configFile)
		return nil, fmt.Errorf("配置文件不存在")
	}

	cfg, err := config.LoadConfig(configFile)
	if err != nil {
		return nil, fmt.Errorf("加载配置文件失败: %w", err)
	}

	return cfg, nil
}

// runServe starts the web server (Requirement 3.1, 4.1, 4.3).
// Supports hot reload via ConfigManager (Requirement 1.1).
func runServe(cmd *cobra.Command, args []string) error {
	cfg, err := loadConfigOrGenerateTemplate()
	if err != nil {
		return err
	}

	// Create ConfigManager for hot reload support (Requirement 1.1)
	configManager, err := manager.NewConfigManager(configFile, cfg)
	if err != nil {
		return fmt.Errorf("创建配置管理器失败: %w", err)
	}

	srv, err := server.NewServer(configManager, port)
	if err != nil {
		return fmt.Errorf("创建服务器失败: %w", err)
	}

	// Start configuration file watching (Requirement 1.1)
	if err := srv.StartWatching(); err != nil {
		return fmt.Errorf("启动配置监听失败: %w", err)
	}

	// Set up graceful shutdown (Requirement 1.4)
	return runServerWithGracefulShutdown(srv)
}

// runServerWithGracefulShutdown runs the server and handles graceful shutdown.
// Stops ConfigWatcher when the program exits (Requirement 1.4).
func runServerWithGracefulShutdown(srv *server.Server) error {
	// Create a channel to listen for OS signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Create HTTP server for graceful shutdown support
	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", srv.GetPort()),
		Handler: srv.GetRouter(),
	}

	// Start server in a goroutine
	serverErr := make(chan error, 1)
	go func() {
		fmt.Printf("Starting server on http://localhost:%d\n", srv.GetPort())
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErr <- err
		}
	}()

	// Wait for interrupt signal or server error
	select {
	case <-quit:
		fmt.Println("\nShutting down server...")
	case err := <-serverErr:
		return fmt.Errorf("服务器错误: %w", err)
	}

	// Stop configuration watching (Requirement 1.4)
	if err := srv.StopWatching(); err != nil {
		fmt.Printf("停止配置监听时出错: %v\n", err)
	}

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("服务器关闭失败: %w", err)
	}

	fmt.Println("Server stopped gracefully")
	return nil
}

// runGenerate generates HTML files (Requirement 2.1, 4.2).
func runGenerate(cmd *cobra.Command, args []string) error {
	cfg, err := loadConfigOrGenerateTemplate()
	if err != nil {
		return err
	}

	gen, err := generator.NewGenerator(cfg, outputDir)
	if err != nil {
		return fmt.Errorf("创建生成器失败: %w", err)
	}

	if err := gen.Generate(); err != nil {
		return fmt.Errorf("生成 HTML 文件失败: %w", err)
	}

	fmt.Printf("HTML 文件已生成到目录: %s\n", outputDir)
	return nil
}
