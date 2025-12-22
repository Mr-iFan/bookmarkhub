package service

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"bookmarkhub/internal/model"

	"github.com/PuerkitoBio/goquery"
	"gorm.io/gorm"
)

// FaviconService Favicon 抓取服务
type FaviconService struct {
	db     *gorm.DB
	client *http.Client
}

// NewFaviconService 创建 Favicon 服务
func NewFaviconService(db *gorm.DB) *FaviconService {
	return &FaviconService{
		db: db,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// FetchAllFavicons 抓取所有书签的 Favicon
func (s *FaviconService) FetchAllFavicons() {
	var bookmarks []model.Bookmark
	if err := s.db.Find(&bookmarks).Error; err != nil {
		return
	}

	for i := range bookmarks {
		if bookmarks[i].Icon == "" {
			go s.FetchFavicon(&bookmarks[i])
		}
	}
}

// FetchFavicon 抓取单个书签的 Favicon
func (s *FaviconService) FetchFavicon(bookmark *model.Bookmark) {
	// 如果用户已经指定了图标，直接使用
	if bookmark.Icon != "" {
		// 检查是否是本地路径或完整 URL
		if strings.HasPrefix(bookmark.Icon, "http://") || strings.HasPrefix(bookmark.Icon, "https://") {
			// 下载远程图标
			iconData, err := s.downloadIcon(bookmark.Icon)
			if err == nil {
				s.saveIcon(bookmark.ID, iconData)
			}
		} else if strings.HasPrefix(bookmark.Icon, "data:image") {
			// 已经是 base64，直接保存
			s.saveIconString(bookmark.ID, bookmark.Icon)
		}
		// 本地路径暂不处理
		return
	}

	// 尝试抓取 Favicon（只处理有URL的书签项）
	if bookmark.URL == nil {
		return // group节点没有URL，跳过
	}
	
	iconData, err := s.fetchFaviconFromURL(*bookmark.URL)
	if err != nil {
		// 记录错误日志
		logEntry := &model.SystemLog{
			Type:    model.LogTypeFavicon,
			Message: fmt.Sprintf("Failed to fetch favicon for %s: %v", *bookmark.URL, err),
			Level:   model.LogLevelWarn,
		}
		_ = s.db.Create(logEntry)
		return
	}

	if iconData != "" {
		s.saveIconString(bookmark.ID, iconData)
	}
}

// fetchFaviconFromURL 从 URL 抓取 Favicon
func (s *FaviconService) fetchFaviconFromURL(bookmarkURL string) (string, error) {
	parsedURL, err := url.Parse(bookmarkURL)
	if err != nil {
		return "", err
	}

	baseURL := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)

	// 策略1: 尝试从 HTML 中解析 <link rel="icon">
	iconURL, err := s.parseHTMLIcon(bookmarkURL)
	if err == nil && iconURL != "" {
		iconData, err := s.downloadIcon(iconURL)
		if err == nil {
			return iconData, nil
		}
	}

	// 策略2: 尝试 /favicon.ico
	faviconURL := baseURL + "/favicon.ico"
	iconData, err := s.downloadIcon(faviconURL)
	if err == nil {
		return iconData, nil
	}

	return "", fmt.Errorf("failed to fetch favicon")
}

// parseHTMLIcon 解析 HTML 中的图标链接
func (s *FaviconService) parseHTMLIcon(pageURL string) (string, error) {
	resp, err := s.client.Get(pageURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return "", err
	}

	// 查找各种可能的图标链接
	iconSelectors := []string{
		"link[rel='icon']",
		"link[rel='shortcut icon']",
		"link[rel='apple-touch-icon']",
		"link[rel='apple-touch-icon-precomposed']",
	}

	parsedURL, _ := url.Parse(pageURL)
	baseURL := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)

	var foundIconURL string
	for _, selector := range iconSelectors {
		doc.Find(selector).Each(func(i int, s *goquery.Selection) {
			if foundIconURL != "" {
				return // 已经找到，跳过
			}
			if href, exists := s.Attr("href"); exists {
				iconURL := href
				if !strings.HasPrefix(href, "http") {
					if strings.HasPrefix(href, "//") {
						iconURL = parsedURL.Scheme + ":" + href
					} else if strings.HasPrefix(href, "/") {
						iconURL = baseURL + href
					} else {
						iconURL = baseURL + "/" + href
					}
				}
				foundIconURL = iconURL
			}
		})
		if foundIconURL != "" {
			return foundIconURL, nil
		}
	}

	return "", fmt.Errorf("no icon found in HTML")
}

// downloadIcon 下载图标
func (s *FaviconService) downloadIcon(iconURL string) (string, error) {
	resp, err := s.client.Get(iconURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	// 限制图标大小（例如 1MB）
	limitReader := io.LimitReader(resp.Body, 1024*1024)
	data, err := io.ReadAll(limitReader)
	if err != nil {
		return "", err
	}

	// 检测 MIME 类型
	contentType := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(contentType, "image/") {
		return "", fmt.Errorf("not an image: %s", contentType)
	}

	// 转换为 base64
	base64Data := base64.StdEncoding.EncodeToString(data)
	mimeType := contentType
	if mimeType == "" {
		mimeType = "image/png"
	}

	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data), nil
}

// saveIcon 保存图标到数据库
func (s *FaviconService) saveIcon(bookmarkID uint, iconData string) {
	s.saveIconString(bookmarkID, iconData)
}

// saveIconString 保存图标字符串到数据库
func (s *FaviconService) saveIconString(bookmarkID uint, iconData string) {
	if err := s.db.Model(&model.Bookmark{}).Where("id = ?", bookmarkID).Update("icon", iconData).Error; err != nil {
		logEntry := &model.SystemLog{
			Type:    model.LogTypeFavicon,
			Message: fmt.Sprintf("Failed to save icon for bookmark %d: %v", bookmarkID, err),
			Level:   model.LogLevelError,
		}
		_ = s.db.Create(logEntry)
	}
}

