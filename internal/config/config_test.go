package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGenerateTemplate(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir, err := os.MkdirTemp("", "config-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	templatePath := filepath.Join(tmpDir, "config.template.yaml")

	// Test generating template
	err = GenerateTemplate(templatePath)
	if err != nil {
		t.Fatalf("GenerateTemplate failed: %v", err)
	}

	// Verify file exists
	if !ConfigExists(templatePath) {
		t.Fatal("Template file was not created")
	}

	// Read and verify content
	content, err := os.ReadFile(templatePath)
	if err != nil {
		t.Fatalf("Failed to read template file: %v", err)
	}

	contentStr := string(content)

	// Verify template contains required elements (Requirements 7.1, 7.2)
	requiredElements := []string{
		"bookmark:",   // Root key
		"name:",       // Group name field
		"url:",        // URL field
		"items:",      // Items field
		"groups:",     // Nested groups field
		"icon:",       // Optional icon field
		"# ",          // Comments
		"config.yaml", // Instructions to rename
	}

	for _, elem := range requiredElements {
		if !strings.Contains(contentStr, elem) {
			t.Errorf("Template missing required element: %s", elem)
		}
	}

	// Verify the generated template can be parsed as valid YAML
	cfg, err := LoadConfig(templatePath)
	if err != nil {
		t.Fatalf("Generated template is not valid YAML: %v", err)
	}

	// Verify template has example bookmark groups
	if len(cfg.Bookmark) == 0 {
		t.Error("Template should contain example bookmark groups")
	}
}
