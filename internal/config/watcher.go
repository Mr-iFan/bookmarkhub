package config

import (
	"path/filepath"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// Watcher 配置文件监控器
type Watcher struct {
	watcher   *fsnotify.Watcher
	configPath string
	callback   func()
	mu         sync.Mutex
	debounceTimer *time.Timer
	debounceDelay time.Duration
	stopChan      chan struct{}
}

// StartWatcher 启动文件监控
func StartWatcher(configPath string, callback func()) (*Watcher, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	w := &Watcher{
		watcher:      watcher,
		configPath:   configPath,
		callback:     callback,
		debounceDelay: 500 * time.Millisecond,
		stopChan:     make(chan struct{}),
	}

	// 监控配置文件
	if err := watcher.Add(configPath); err != nil {
		watcher.Close()
		return nil, err
	}

	// 监控配置文件所在目录（用于监控 include 文件）
	configDir := filepath.Dir(configPath)
	if err := watcher.Add(configDir); err != nil {
		watcher.Close()
		return nil, err
	}

	// 启动监控 goroutine
	go w.watch()

	return w, nil
}

// watch 监控文件变更
func (w *Watcher) watch() {
	for {
		select {
		case event, ok := <-w.watcher.Events:
			if !ok {
				return
			}
			// 只处理写入和创建事件
			if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create {
				w.debounceCallback()
			}
		case err, ok := <-w.watcher.Errors:
			if !ok {
				return
			}
			// 记录错误但不中断监控
			_ = err
		case <-w.stopChan:
			return
		}
	}
}

// debounceCallback 防抖回调
func (w *Watcher) debounceCallback() {
	w.mu.Lock()
	defer w.mu.Unlock()

	// 取消之前的定时器
	if w.debounceTimer != nil {
		w.debounceTimer.Stop()
	}

	// 创建新的定时器
	w.debounceTimer = time.AfterFunc(w.debounceDelay, func() {
		if w.callback != nil {
			w.callback()
		}
	})
}

// Close 关闭监控器
func (w *Watcher) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	close(w.stopChan)

	if w.debounceTimer != nil {
		w.debounceTimer.Stop()
	}

	return w.watcher.Close()
}

