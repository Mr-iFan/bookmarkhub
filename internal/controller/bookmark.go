package controller

import (
	"net/http"
	"strconv"

	"bookmarkhub/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// BookmarkController 书签控制器
type BookmarkController struct {
	db *gorm.DB
}

// NewBookmarkController 创建书签控制器
func NewBookmarkController(db *gorm.DB) *BookmarkController {
	return &BookmarkController{db: db}
}

// GetBookmarks 获取所有书签（扁平列表）
func (c *BookmarkController) GetBookmarks(ctx *gin.Context) {
	var bookmarks []model.Bookmark
	if err := c.db.Find(&bookmarks).Order("idx ASC").Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, bookmarks)
}

// GetBookmark 获取单个书签详情
func (c *BookmarkController) GetBookmark(ctx *gin.Context) {
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var bookmark model.Bookmark
	if err := c.db.Preload("Parent").Preload("Children").First(&bookmark, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "bookmark not found"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, bookmark)
}

// GetBookmarkTree 获取嵌套树形结构
func (c *BookmarkController) GetBookmarkTree(ctx *gin.Context) {
	var bookmarks []model.Bookmark
	if err := c.db.Where("parent_id IS NULL").Preload("Children").Order("idx ASC").Find(&bookmarks).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 递归加载所有子节点
	for i := range bookmarks {
		c.loadChildren(&bookmarks[i])
	}

	ctx.JSON(http.StatusOK, bookmarks)
}

// loadChildren 递归加载子节点
func (c *BookmarkController) loadChildren(bookmark *model.Bookmark) {
	var children []model.Bookmark
	c.db.Where("parent_id = ?", bookmark.ID).Order("idx ASC").Find(&children)

	bookmark.Children = children
	for i := range bookmark.Children {
		c.loadChildren(&bookmark.Children[i])
	}
}

// HealthCheck 系统健康检查
func (c *BookmarkController) HealthCheck(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "BookmarkHub is running",
	})
}
