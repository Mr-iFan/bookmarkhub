package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Config 根配置结构
type Config struct {
	Settings GlobalSettings  `yaml:"settings"`
	Groups   []BookmarkGroup `yaml:"groups"`
}

// GlobalSettings 全局设置
type GlobalSettings struct {
	Heartbeat string            `yaml:"heartbeat"` // 默认心跳检测频率，Cron 表达式
	Proxy     string            `yaml:"proxy"`     // 默认代理地址
	Headers   map[string]string `yaml:"headers"`   // 默认请求头
}

// BookmarkGroup 书签组（支持递归嵌套）
type BookmarkGroup struct {
	Name      string                 `yaml:"name"`
	Proxy     string                 `yaml:"proxy,omitempty"`
	Idx       int                    `yaml:"idx,omitempty"`
	Headers   map[string]interface{} `yaml:"headers,omitempty"` // 支持 false 值禁用
	Heartbeat string                 `yaml:"heartbeat,omitempty"`
	Groups    []BookmarkGroup        `yaml:"groups,omitempty"`
	Items     []BookmarkItem         `yaml:"items,omitempty"`
	Include   string                 `yaml:"include,omitempty"` // 包含其他配置文件
}

// BookmarkItem 书签项
type BookmarkItem struct {
	Name      string                 `yaml:"name"`
	URL       string                 `yaml:"url"`
	Idx       int                    `yaml:"idx,omitempty"`
	Icon      string                 `yaml:"icon,omitempty"` // 图标路径或 URL
	Proxy     string                 `yaml:"proxy,omitempty"`
	Headers   map[string]interface{} `yaml:"headers,omitempty"` // 支持 false 值禁用
	Heartbeat string                 `yaml:"heartbeat,omitempty"`
	Include   string                 `yaml:"include,omitempty"` // 包含其他配置文件
}

const (
	// MaxIncludeDepth 最大 include 深度
	MaxIncludeDepth = 3
)

// LoadConfig 加载配置文件
func LoadConfig(configPath string) (*Config, error) {
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	// 解析 include
	baseDir := filepath.Dir(configPath)
	if err := resolveIncludes(&config, baseDir, 0); err != nil {
		return nil, fmt.Errorf("failed to resolve includes: %w", err)
	}

	return &config, nil
}

// resolveIncludes 递归解析 include（最大深度3层）
func resolveIncludes(config *Config, baseDir string, depth int) error {
	if depth > MaxIncludeDepth {
		return fmt.Errorf("include depth exceeds maximum (%d)", MaxIncludeDepth)
	}

	// 解析 groups 中的 include
	for i := range config.Groups {
		if err := resolveGroupIncludes(&config.Groups[i], baseDir, depth); err != nil {
			return err
		}
	}

	return nil
}

// resolveGroupIncludes 解析组中的 include
func resolveGroupIncludes(group *BookmarkGroup, baseDir string, depth int) error {
	// 处理当前组的 include
	if group.Include != "" {
		includePath := filepath.Join(baseDir, group.Include)
		if !filepath.IsAbs(group.Include) {
			includePath = filepath.Join(baseDir, group.Include)
		}

		// 检查循环引用（简单检查：如果文件路径相同则认为是循环）
		// 这里可以扩展为更复杂的循环检测

		includeData, err := os.ReadFile(includePath)
		if err != nil {
			return fmt.Errorf("failed to read include file %s: %w", includePath, err)
		}

		var includedGroup BookmarkGroup
		if err := yaml.Unmarshal(includeData, &includedGroup); err != nil {
			return fmt.Errorf("failed to parse include file %s: %w", includePath, err)
		}

		// 合并 include 的内容
		includeBaseDir := filepath.Dir(includePath)
		if err := resolveGroupIncludes(&includedGroup, includeBaseDir, depth+1); err != nil {
			return err
		}

		// 合并 groups 和 items
		group.Groups = append(group.Groups, includedGroup.Groups...)
		group.Items = append(group.Items, includedGroup.Items...)
		group.Include = "" // 清除已处理的 include
	}

	// 递归处理子组
	for i := range group.Groups {
		if err := resolveGroupIncludes(&group.Groups[i], baseDir, depth+1); err != nil {
			return err
		}
	}

	// 处理 items 中的 include
	for i := range group.Items {
		if group.Items[i].Include != "" {
			includePath := filepath.Join(baseDir, group.Items[i].Include)
			if !filepath.IsAbs(group.Items[i].Include) {
				includePath = filepath.Join(baseDir, group.Items[i].Include)
			}

			includeData, err := os.ReadFile(includePath)
			if err != nil {
				return fmt.Errorf("failed to read include file %s: %w", includePath, err)
			}

			var includedItems []BookmarkItem
			if err := yaml.Unmarshal(includeData, &includedItems); err != nil {
				return fmt.Errorf("failed to parse include file %s: %w", includePath, err)
			}

			// 合并 items
			group.Items = append(group.Items, includedItems...)
			group.Items[i].Include = "" // 清除已处理的 include
		}
	}

	return nil
}
