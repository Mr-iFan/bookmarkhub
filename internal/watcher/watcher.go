// Package watcher provides file system monitoring for configuration files.
package watcher

import (
	"log"
	"path/filepath"
	"sync"

	"github.com/fsnotify/fsnotify"
)

// ConfigWatcher monitors a configuration file for changes.
type ConfigWatcher struct {
	watcher  *fsnotify.Watcher
	path     string
	onChange func()
	done     chan struct{}
	logger   *log.Logger
	mu       sync.Mutex
	running  bool
}

// NewConfigWatcher creates a new file watcher for the given path.
func NewConfigWatcher(path string, onChange func()) (*ConfigWatcher, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	return &ConfigWatcher{
		watcher:  watcher,
		path:     absPath,
		onChange: onChange,
		done:     make(chan struct{}),
		logger:   log.Default(),
	}, nil
}

// Start begins watching the file for changes.
func (cw *ConfigWatcher) Start() error {
	cw.mu.Lock()
	if cw.running {
		cw.mu.Unlock()
		return nil
	}
	cw.running = true
	cw.mu.Unlock()

	// Watch the directory containing the config file
	dir := filepath.Dir(cw.path)
	if err := cw.watcher.Add(dir); err != nil {
		return err
	}

	go cw.watch()
	return nil
}

// watch handles file system events in a goroutine.
func (cw *ConfigWatcher) watch() {
	for {
		select {
		case event, ok := <-cw.watcher.Events:
			if !ok {
				return
			}
			// Check if the event is for our config file
			absEventPath, _ := filepath.Abs(event.Name)
			if absEventPath == cw.path {
				if event.Op&fsnotify.Write == fsnotify.Write {
					cw.logger.Printf("[INFO] Configuration file modified: %s", cw.path)
					if cw.onChange != nil {
						cw.onChange()
					}
				} else if event.Op&fsnotify.Remove == fsnotify.Remove {
					cw.logger.Printf("[WARN] Configuration file deleted: %s, continuing with current configuration", cw.path)
				}
			}
		case err, ok := <-cw.watcher.Errors:
			if !ok {
				return
			}
			cw.logger.Printf("[ERROR] Watcher error: %v", err)
		case <-cw.done:
			return
		}
	}
}

// Stop stops watching the file.
func (cw *ConfigWatcher) Stop() error {
	cw.mu.Lock()
	defer cw.mu.Unlock()

	if !cw.running {
		return nil
	}

	cw.running = false
	close(cw.done)
	return cw.watcher.Close()
}
