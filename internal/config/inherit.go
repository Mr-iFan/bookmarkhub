package config

import (
	"encoding/json"
	"fmt"
)

// EffectiveConfig 有效配置（继承后的最终值）
type EffectiveConfig struct {
	Proxy    string
	Headers  map[string]string
	Heartbeat string
}

// GetEffectiveProxy 获取有效的代理配置
func (c *Config) GetEffectiveProxy(item *BookmarkItem, group *BookmarkGroup) string {
	if item != nil && item.Proxy != "" {
		return item.Proxy
	}
	if group != nil && group.Proxy != "" {
		return group.Proxy
	}
	return c.Settings.Proxy
}

// GetEffectiveHeaders 获取有效的请求头配置
func (c *Config) GetEffectiveHeaders(item *BookmarkItem, group *BookmarkGroup) (map[string]string, bool) {
	// 检查是否显式禁用
	if item != nil && item.Headers != nil {
		if disabled, ok := item.Headers["_disabled"].(bool); ok && disabled {
			return nil, false
		}
		// 检查是否有 false 值
		for _, v := range item.Headers {
			if v == false {
				return nil, false
			}
		}
	}

	// 合并策略：全局 -> 组 -> 项
	headers := make(map[string]string)

	// 先应用全局设置
	for k, v := range c.Settings.Headers {
		headers[k] = v
	}

	// 再应用组设置
	if group != nil && group.Headers != nil {
		if disabled, ok := group.Headers["_disabled"].(bool); ok && disabled {
			return nil, false
		}
		for k, v := range group.Headers {
			if v == false {
				return nil, false
			}
			if str, ok := v.(string); ok {
				headers[k] = str
			}
		}
	}

	// 最后应用项设置
	if item != nil && item.Headers != nil {
		for k, v := range item.Headers {
			if v == false {
				return nil, false
			}
			if str, ok := v.(string); ok {
				headers[k] = str
			}
		}
	}

	return headers, true
}

// GetEffectiveHeartbeat 获取有效的心跳配置
func (c *Config) GetEffectiveHeartbeat(item *BookmarkItem, group *BookmarkGroup) string {
	defaultHeartbeat := "0 */30 * * * *" // 默认每30分钟

	if item != nil && item.Heartbeat != "" {
		return item.Heartbeat
	}
	if group != nil && group.Heartbeat != "" {
		return group.Heartbeat
	}
	if c.Settings.Heartbeat != "" {
		return c.Settings.Heartbeat
	}
	return defaultHeartbeat
}

// GetEffectiveConfig 获取完整的有效配置
func (c *Config) GetEffectiveConfig(item *BookmarkItem, group *BookmarkGroup) *EffectiveConfig {
	headers, enabled := c.GetEffectiveHeaders(item, group)
	if !enabled {
		headers = nil
	}

	return &EffectiveConfig{
		Proxy:     c.GetEffectiveProxy(item, group),
		Headers:   headers,
		Heartbeat: c.GetEffectiveHeartbeat(item, group),
	}
}

// HeadersToJSON 将 headers map 转换为 JSON 字符串
func HeadersToJSON(headers map[string]string) (string, error) {
	if headers == nil || len(headers) == 0 {
		return "{}", nil
	}
	data, err := json.Marshal(headers)
	if err != nil {
		return "", fmt.Errorf("failed to marshal headers: %w", err)
	}
	return string(data), nil
}

