package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestLoadConfig(t *testing.T) {
	// 创建临时测试目录
	tmpDir := t.TempDir()

	tests := []struct {
		name        string
		setup       func() string // 返回配置文件路径
		wantErr     bool
		errContains string
		validate    func(*testing.T, *Config)
	}{
		{
			name: "成功加载有效配置文件",
			setup: func() string {
				configPath := filepath.Join(tmpDir, "valid.yaml")
				configContent := `
settings:
  heartbeat: "0 */30 * * * *"
  proxy: ""
  headers:
    User-Agent: "BookmarkHub/1.0"

groups:
  - name: "测试组"
    items:
      - name: "测试网站"
        url: "https://example.com"
`
				if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
					t.Fatalf("创建测试配置文件失败: %v", err)
				}
				return configPath
			},
			wantErr: false,
			validate: func(t *testing.T, cfg *Config) {
				if cfg == nil {
					t.Fatal("配置不应为 nil")
				}
				if cfg.Settings.Heartbeat != "0 */30 * * * *" {
					t.Errorf("期望 heartbeat 为 '0 */30 * * * *'，实际为 '%s'", cfg.Settings.Heartbeat)
				}
				if len(cfg.Groups) != 1 {
					t.Errorf("期望 1 个组，实际为 %d", len(cfg.Groups))
				}
				if cfg.Groups[0].Name != "测试组" {
					t.Errorf("期望组名为 '测试组'，实际为 '%s'", cfg.Groups[0].Name)
				}
				if len(cfg.Groups[0].Items) != 1 {
					t.Errorf("期望 1 个书签项，实际为 %d", len(cfg.Groups[0].Items))
				}
				if cfg.Groups[0].Items[0].URL != "https://example.com" {
					t.Errorf("期望 URL 为 'https://example.com'，实际为 '%s'", cfg.Groups[0].Items[0].URL)
				}
			},
		},
		{
			name: "文件不存在",
			setup: func() string {
				return filepath.Join(tmpDir, "not-exist.yaml")
			},
			wantErr:     true,
			errContains: "failed to read config file",
		},
		{
			name: "YAML 格式错误",
			setup: func() string {
				configPath := filepath.Join(tmpDir, "invalid.yaml")
				configContent := `
settings:
  heartbeat: "0 */30 * * * *"
  invalid: [unclosed bracket
`
				if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
					t.Fatalf("创建测试配置文件失败: %v", err)
				}
				return configPath
			},
			wantErr:     true,
			errContains: "failed to parse YAML",
		},
		{
			name: "包含 include 的配置文件",
			setup: func() string {
				// 创建被包含的文件
				includeDir := filepath.Join(tmpDir, "includes")
				if err := os.MkdirAll(includeDir, 0755); err != nil {
					t.Fatalf("创建 include 目录失败: %v", err)
				}

				includePath := filepath.Join(includeDir, "external.yaml")
				includeContent := `
groups:
  - name: "外部组"
    items:
      - name: "外部网站"
        url: "https://external.com"
`
				if err := os.WriteFile(includePath, []byte(includeContent), 0644); err != nil {
					t.Fatalf("创建 include 文件失败: %v", err)
				}

				// 创建主配置文件
				configPath := filepath.Join(tmpDir, "with-include.yaml")
				configContent := `
settings:
  heartbeat: "0 */30 * * * *"

groups:
  - name: "主组"
    include: "includes/external.yaml"
    items:
      - name: "主网站"
        url: "https://main.com"
`
				if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
					t.Fatalf("创建测试配置文件失败: %v", err)
				}
				return configPath
			},
			wantErr: false,
			validate: func(t *testing.T, cfg *Config) {
				if cfg == nil {
					t.Fatal("配置不应为 nil")
				}
				if len(cfg.Groups) != 1 {
					t.Fatalf("期望 1 个组，实际为 %d", len(cfg.Groups))
				}
				// include 应该被解析并合并
				// 主组的 items 应该包含主网站
				// include 的 groups 应该被合并到主组
				mainGroup := cfg.Groups[0]
				if mainGroup.Name != "主组" {
					t.Errorf("期望组名为 '主组'，实际为 '%s'", mainGroup.Name)
				}
				// 检查 include 是否被清除
				if mainGroup.Include != "" {
					t.Errorf("include 应该被清除，但实际为 '%s'", mainGroup.Include)
				}
				// 检查合并后的 groups（include 文件中的 groups 应该被合并）
				if len(mainGroup.Groups) != 1 {
					t.Errorf("期望合并后 1 个子组，实际为 %d", len(mainGroup.Groups))
				}
				if len(mainGroup.Groups) > 0 && mainGroup.Groups[0].Name != "外部组" {
					t.Errorf("期望子组名为 '外部组'，实际为 '%s'", mainGroup.Groups[0].Name)
				}
			},
		},
		{
			name: "include 文件不存在",
			setup: func() string {
				configPath := filepath.Join(tmpDir, "include-not-exist.yaml")
				configContent := `
settings:
  heartbeat: "0 */30 * * * *"

groups:
  - name: "测试组"
    include: "not-exist.yaml"
`
				if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
					t.Fatalf("创建测试配置文件失败: %v", err)
				}
				return configPath
			},
			wantErr:     true,
			errContains: "failed to resolve includes",
		},
		{
			name: "空配置文件",
			setup: func() string {
				configPath := filepath.Join(tmpDir, "empty.yaml")
				configContent := ``
				if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
					t.Fatalf("创建测试配置文件失败: %v", err)
				}
				return configPath
			},
			wantErr: false,
			validate: func(t *testing.T, cfg *Config) {
				if cfg == nil {
					t.Fatal("配置不应为 nil")
				}
				// 空配置文件应该返回默认的空配置
			},
		},
		{
			name: "复杂嵌套配置",
			setup: func() string {
				configPath := filepath.Join(tmpDir, "nested.yaml")
				configContent := `
settings:
  heartbeat: "0 */30 * * * *"
  proxy: "http://proxy.example.com:8080"
  headers:
    User-Agent: "BookmarkHub/1.0"

groups:
  - name: "一级组"
    proxy: "http://group-proxy.com:8080"
    groups:
      - name: "二级组"
        items:
          - name: "嵌套网站"
            url: "https://nested.com"
`
				if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
					t.Fatalf("创建测试配置文件失败: %v", err)
				}
				return configPath
			},
			wantErr: false,
			validate: func(t *testing.T, cfg *Config) {
				if cfg == nil {
					t.Fatal("配置不应为 nil")
				}
				if len(cfg.Groups) != 1 {
					t.Fatalf("期望 1 个一级组，实际为 %d", len(cfg.Groups))
				}
				level1 := cfg.Groups[0]
				if level1.Name != "一级组" {
					t.Errorf("期望一级组名为 '一级组'，实际为 '%s'", level1.Name)
				}
				if level1.Proxy != "http://group-proxy.com:8080" {
					t.Errorf("期望一级组代理为 'http://group-proxy.com:8080'，实际为 '%s'", level1.Proxy)
				}
				if len(level1.Groups) != 1 {
					t.Fatalf("期望 1 个二级组，实际为 %d", len(level1.Groups))
				}
				level2 := level1.Groups[0]
				if level2.Name != "二级组" {
					t.Errorf("期望二级组名为 '二级组'，实际为 '%s'", level2.Name)
				}
				if len(level2.Items) != 1 {
					t.Fatalf("期望 1 个书签项，实际为 %d", len(level2.Items))
				}
				if level2.Items[0].URL != "https://nested.com" {
					t.Errorf("期望 URL 为 'https://nested.com'，实际为 '%s'", level2.Items[0].URL)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			configPath := tt.setup()
			cfg, err := LoadConfig(configPath)

			if tt.wantErr {
				if err == nil {
					t.Errorf("期望错误但未返回错误")
					return
				}
				if tt.errContains != "" && !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("期望错误信息包含 '%s'，实际错误为: %v", tt.errContains, err)
				}
				return
			}

			if err != nil {
				t.Errorf("不期望错误但返回了错误: %v", err)
				return
			}

			if tt.validate != nil {
				tt.validate(t, cfg)
			}
		})
	}
}

