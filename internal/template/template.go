// Package template provides HTML template rendering for the bookmark navigation generator.
package template

import (
	"embed"
	"fmt"
	"html/template"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"bookmarkhub/internal/config"
)

//go:embed templates/template.html
var embeddedTemplates embed.FS

// TemplateData holds the data passed to the HTML template for rendering.
type TemplateData struct {
	Title       string                 // Page title
	Groups      []config.BookmarkGroup // All bookmark groups (for navigation)
	ActiveGroup *config.BookmarkGroup  // Currently active group being displayed
	AllGroups   []config.BookmarkGroup // Flattened list of all groups
}

// Engine handles template loading and rendering.
type Engine struct {
	tmpl *template.Template
}

// SanitizeID converts a string into a valid HTML ID.
// It handles Chinese characters and special characters by URL-encoding them.
func SanitizeID(name string) string {
	// Trim whitespace
	name = strings.TrimSpace(name)
	if name == "" {
		return "section-unnamed"
	}
	// URL-encode the name to handle Chinese and special characters
	encoded := url.PathEscape(name)
	return "section-" + encoded
}

// templateFuncs returns the custom template functions.
func templateFuncs() template.FuncMap {
	return template.FuncMap{
		"sanitizeID": SanitizeID,
	}
}

// NewEngine creates a new template engine with the embedded template.
func NewEngine() (*Engine, error) {
	tmplContent, err := embeddedTemplates.ReadFile("templates/template.html")
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded template: %w", err)
	}

	tmpl, err := template.New("bookmark").Funcs(templateFuncs()).Parse(string(tmplContent))
	if err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}

	return &Engine{tmpl: tmpl}, nil
}

// Render renders the template with the given data to the provided writer.
func (e *Engine) Render(w io.Writer, data *TemplateData) error {
	if err := e.tmpl.Execute(w, data); err != nil {
		return fmt.Errorf("failed to render template: %w", err)
	}
	return nil
}

// RenderToFile renders the template with the given data to a file.
func (e *Engine) RenderToFile(path string, data *TemplateData) error {
	// Ensure the directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %w", path, err)
	}
	defer file.Close()

	return e.Render(file, data)
}
