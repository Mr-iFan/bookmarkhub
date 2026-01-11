// Package config provides configuration parsing for the bookmark navigation generator.
package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// BookmarkItem represents a single bookmark entry.
type BookmarkItem struct {
	Name string `yaml:"name"`
	URL  string `yaml:"url"`
	Icon string `yaml:"icon,omitempty"`
}

// BookmarkGroup represents a group of bookmarks with optional nested subgroups.
type BookmarkGroup struct {
	Name   string          `yaml:"name"`
	Items  []BookmarkItem  `yaml:"items,omitempty"`
	Groups []BookmarkGroup `yaml:"groups,omitempty"`
}

// Config represents the root configuration structure.
type Config struct {
	Bookmark []BookmarkGroup `yaml:"bookmark"`
}

// ConfigExists checks if the configuration file exists at the given path.
func ConfigExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

// LoadConfig reads and parses a YAML configuration file from the given path.
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	return &cfg, nil
}

// configTemplate is the template content for config.template.yaml
const configTemplate = `# 书签导航配置文件模板
# 请将此文件重命名为 config.yaml 并根据需要修改

# bookmark: 书签分组列表（必填）
# 每个分组包含:
#   - name: 分组名称（必填）
#   - items: 书签项列表（可选）
#   - groups: 嵌套子分组列表（可选）
#
# 每个书签项包含:
#   - name: 书签名称（必填）
#   - url: 书签链接（必填）
#   - icon: 图标URL（可选）

bookmark:
  # 示例分组1：开发工具
  - name: "开发工具"
    items:
      - name: "GitHub"
        url: "https://github.com"
        icon: "https://github.com/favicon.ico"
      - name: "GitLab"
        url: "https://gitlab.com"
      - name: "Stack Overflow"
        url: "https://stackoverflow.com"

  # 示例分组2：技术文档
  - name: "技术文档"
    items:
      - name: "MDN Web Docs"
        url: "https://developer.mozilla.org"
      - name: "Go 文档"
        url: "https://go.dev/doc"

  # 示例分组3：嵌套分组（支持多级嵌套）
  - name: "编程语言"
    items:
      - name: "Python 官网"
        url: "https://www.python.org"
      - name: "Go 官网"
        url: "https://go.dev"
    # 嵌套的子分组
    groups:
      - name: "Python 资源"
        items:
          - name: "PyPI"
            url: "https://pypi.org"
          - name: "Python 文档"
            url: "https://docs.python.org"
      - name: "Go 资源"
        items:
          - name: "Go 包仓库"
            url: "https://pkg.go.dev"
`

// GenerateTemplate generates a config.template.yaml file at the given path.
func GenerateTemplate(path string) error {
	return os.WriteFile(path, []byte(configTemplate), 0644)
}
