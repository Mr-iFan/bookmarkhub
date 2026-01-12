// Package server provides a Gin-based web server for the bookmark navigation generator.
package server

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"bookmarkhub/internal/config"
	"bookmarkhub/internal/manager"
	"bookmarkhub/internal/template"
)

// Server represents the web server for serving bookmark navigation pages.
type Server struct {
	configManager *manager.ConfigManager
	engine        *template.Engine
	router        *gin.Engine
	port          int
}

// NewServer creates a new Server with ConfigManager for hot reload support.
// If port is 0, the default port 8080 will be used (Requirement 3.3).
func NewServer(configManager *manager.ConfigManager, port int) (*Server, error) {
	if port == 0 {
		port = 8080
	}

	tmplEngine, err := template.NewEngine()
	if err != nil {
		return nil, fmt.Errorf("failed to create template engine: %w", err)
	}

	// Set Gin to release mode for cleaner output
	gin.SetMode(gin.ReleaseMode)

	router := gin.Default()

	s := &Server{
		configManager: configManager,
		engine:        tmplEngine,
		router:        router,
		port:          port,
	}

	s.setupRoutes()

	return s, nil
}

// Run starts the HTTP server on the configured port (Requirement 3.1, 3.2).
func (s *Server) Run() error {
	addr := fmt.Sprintf(":%d", s.port)
	fmt.Printf("Starting server on http://localhost%s\n", addr)
	return s.router.Run(addr)
}

// setupRoutes configures the HTTP routes for the server.
func (s *Server) setupRoutes() {
	// Root path shows all groups navigation page (Requirement 3.5)
	s.router.GET("/", s.handleIndex)

	// Individual group pages (Requirement 3.4)
	s.router.GET("/group/:name", s.handleGroup)

	// Support .html suffix for group pages (matches generated file names)
	s.router.GET("/:name", s.handleGroupHTML)
}

// handleIndex handles the root path request, displaying all groups.
func (s *Server) handleIndex(c *gin.Context) {
	cfg := s.configManager.GetConfig()

	// If there are bookmark groups, show the first one as active
	var activeGroup *config.BookmarkGroup
	if len(cfg.Bookmark) > 0 {
		activeGroup = &cfg.Bookmark[0]
	}

	data := &template.TemplateData{
		Title:       "书签导航",
		Groups:      cfg.Bookmark,
		ActiveGroup: activeGroup,
		AllGroups:   cfg.Bookmark,
	}

	s.renderTemplate(c, data)
}

// handleGroup handles requests for a specific bookmark group.
func (s *Server) handleGroup(c *gin.Context) {
	groupName := c.Param("name")
	s.renderGroup(c, groupName)
}

// handleGroupHTML handles requests for group pages with .html suffix.
// This matches the generated file naming convention (e.g., "技术博客.html").
func (s *Server) handleGroupHTML(c *gin.Context) {
	name := c.Param("name")
	// Remove .html suffix if present
	groupName := strings.TrimSuffix(name, ".html")
	s.renderGroup(c, groupName)
}

// renderGroup renders a specific bookmark group page.
func (s *Server) renderGroup(c *gin.Context, groupName string) {
	cfg := s.configManager.GetConfig()

	// Find the requested group
	var activeGroup *config.BookmarkGroup
	for i := range cfg.Bookmark {
		if cfg.Bookmark[i].Name == groupName {
			activeGroup = &cfg.Bookmark[i]
			break
		}
	}

	if activeGroup == nil {
		c.String(http.StatusNotFound, "Group not found: %s", groupName)
		return
	}

	data := &template.TemplateData{
		Title:       activeGroup.Name,
		Groups:      cfg.Bookmark,
		ActiveGroup: activeGroup,
		AllGroups:   cfg.Bookmark,
	}

	s.renderTemplate(c, data)
}

// renderTemplate renders the template and writes the response.
func (s *Server) renderTemplate(c *gin.Context, data *template.TemplateData) {
	c.Header("Content-Type", "text/html; charset=utf-8")
	if err := s.engine.Render(c.Writer, data); err != nil {
		c.String(http.StatusInternalServerError, "Failed to render template: %v", err)
		return
	}
}

// GetPort returns the configured port number.
func (s *Server) GetPort() int {
	return s.port
}

// GetRouter returns the underlying Gin router for testing purposes.
func (s *Server) GetRouter() *gin.Engine {
	return s.router
}

// StartWatching begins file system monitoring for configuration changes.
// This enables hot reload functionality (Requirement 1.1, 1.4).
func (s *Server) StartWatching() error {
	return s.configManager.StartWatching()
}

// StopWatching stops file system monitoring.
// Should be called during graceful shutdown (Requirement 1.4).
func (s *Server) StopWatching() error {
	return s.configManager.StopWatching()
}
