// Package generator provides HTML file generation for the bookmark navigation generator.
package generator

import (
	"fmt"
	"os"
	"path/filepath"

	"bookmark-nav-generator/internal/config"
	"bookmark-nav-generator/internal/template"
)

// Generator coordinates configuration parsing and HTML file generation.
type Generator struct {
	config    *config.Config
	engine    *template.Engine
	outputDir string
}

// NewGenerator creates a new Generator with the given configuration and output directory.
func NewGenerator(cfg *config.Config, outputDir string) (*Generator, error) {
	engine, err := template.NewEngine()
	if err != nil {
		return nil, fmt.Errorf("failed to create template engine: %w", err)
	}

	return &Generator{
		config:    cfg,
		engine:    engine,
		outputDir: outputDir,
	}, nil
}

// Generate generates HTML files for all top-level bookmark groups.
// It creates the output directory if it doesn't exist.
func (g *Generator) Generate() error {
	// Create output directory if it doesn't exist (Requirement 2.5)
	if err := os.MkdirAll(g.outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory %s: %w", g.outputDir, err)
	}

	// Generate HTML file for each top-level bookmark group (Requirement 2.1)
	for i := range g.config.Bookmark {
		if err := g.GenerateGroup(&g.config.Bookmark[i]); err != nil {
			return err
		}
	}

	return nil
}

// GenerateGroup generates an HTML file for a single bookmark group.
// The output file is named after the group name (Requirement 2.3).
func (g *Generator) GenerateGroup(group *config.BookmarkGroup) error {
	// Build output file path: {outputDir}/{groupName}.html (Requirement 2.3)
	filename := fmt.Sprintf("%s.html", group.Name)
	outputPath := filepath.Join(g.outputDir, filename)

	// Prepare template data
	data := &template.TemplateData{
		Title:       group.Name,
		Groups:      g.config.Bookmark,
		ActiveGroup: group,
		AllGroups:   g.config.Bookmark,
	}

	// Render template to file
	if err := g.engine.RenderToFile(outputPath, data); err != nil {
		return fmt.Errorf("failed to generate HTML for group %s: %w", group.Name, err)
	}

	return nil
}
