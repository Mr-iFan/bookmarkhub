// Package manager provides thread-safe configuration management with hot reload support.
package manager

import (
	"log"
	"sync"
	"time"

	"bookmarkhub/internal/config"
	"bookmarkhub/internal/watcher"
)

// ConfigManager manages configuration lifecycle with thread-safe access.
type ConfigManager struct {
	mu      sync.RWMutex
	config  *config.Config
	path    string
	watcher *watcher.ConfigWatcher
	logger  *log.Logger
}

// NewConfigManager creates a new ConfigManager with initial config.
func NewConfigManager(path string, initialConfig *config.Config) (*ConfigManager, error) {
	cm := &ConfigManager{
		config: initialConfig,
		path:   path,
		logger: log.Default(),
	}

	// Create the watcher with Reload as the callback
	w, err := watcher.NewConfigWatcher(path, cm.Reload)
	if err != nil {
		return nil, err
	}
	cm.watcher = w

	return cm, nil
}

// GetConfig returns the current configuration (thread-safe read).
func (cm *ConfigManager) GetConfig() *config.Config {
	cm.mu.RLock()
	defer cm.mu.RUnlock()
	return cm.config
}

// Reload attempts to reload configuration from file.
// Returns error if parsing fails, but keeps the old config.
func (cm *ConfigManager) Reload() {
	newConfig, err := config.LoadConfig(cm.path)
	if err != nil {
		cm.logger.Printf("[ERROR] %s Failed to reload configuration: %v",
			time.Now().Format("2006-01-02 15:04:05"), err)
		return
	}

	cm.mu.Lock()
	cm.config = newConfig
	cm.mu.Unlock()

	cm.logger.Printf("[INFO] %s Configuration reloaded successfully",
		time.Now().Format("2006-01-02 15:04:05"))
}

// StartWatching begins file system monitoring.
func (cm *ConfigManager) StartWatching() error {
	return cm.watcher.Start()
}

// StopWatching stops file system monitoring.
func (cm *ConfigManager) StopWatching() error {
	return cm.watcher.Stop()
}
