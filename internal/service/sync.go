package service

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"log"

	"bookmarkhub/internal/config"
	"bookmarkhub/internal/model"

	"gorm.io/gorm"
)

// SyncConfigToDB 将 YAML 配置同步到数据库
func SyncConfigToDB(db *gorm.DB, cfg *config.Config) error {
	// 在事务中执行同步
	return db.Transaction(func(tx *gorm.DB) error {
		// 使用map存储group路径到ID的映射
		type GroupKey struct {
			Name     string
			ParentID *uint
		}
		groupMap := make(map[GroupKey]*uint) // group标识 -> group节点ID

		// 递归创建group节点并返回其ID
		var createOrGetGroup func(group config.BookmarkGroup, parentID *uint) (*uint, error)
		createOrGetGroup = func(group config.BookmarkGroup, parentID *uint) (*uint, error) {
			key := GroupKey{Name: group.Name, ParentID: parentID}

			// 检查是否已存在
			if id, exists := groupMap[key]; exists {
				return id, nil
			}

			// 查找或创建group节点
			var groupNode model.Bookmark
			var err error
			if parentID == nil {
				err = tx.Where("name = ? AND url IS NULL AND parent_id IS NULL", group.Name).First(&groupNode).Error
			} else {
				err = tx.Where("name = ? AND url IS NULL AND parent_id = ?", group.Name, parentID).First(&groupNode).Error
			}

			if err == gorm.ErrRecordNotFound {
				// 创建新的group节点（URL为NULL）
				groupNode = model.Bookmark{
					Name:     group.Name,
					URL:      nil, // group节点URL为NULL
					Icon:     "",
					ParentID: parentID,
					Proxy:    "",
					Headers:  "",
				}
				if err := tx.Create(&groupNode).Error; err != nil {
					return nil, fmt.Errorf("failed to create group node %s: %w", group.Name, err)
				}
			} else if err != nil {
				return nil, fmt.Errorf("failed to query group node %s: %w", group.Name, err)
			}

			groupID := &groupNode.ID
			groupMap[key] = groupID

			// 递归处理子组
			if len(group.Groups) > 0 {
				for _, subGroup := range group.Groups {
					_, err := createOrGetGroup(subGroup, groupID)
					if err != nil {
						return nil, err
					}
				}
			}

			return groupID, nil
		}
		// 1. 创建所有group节点
		for _, group := range cfg.Groups {
			_, err := createOrGetGroup(group, nil)
			if err != nil {
				return err
			}
		}

		// 2. 收集所有item节点（书签）
		var allBookmarks []*model.Bookmark
		urlSet := make(map[string]bool)

		var collectItems func(groups []config.BookmarkGroup, parentID *uint) error
		collectItems = func(groups []config.BookmarkGroup, parentID *uint) error {
			for _, group := range groups {
				// 获取当前group的ID
				key := GroupKey{Name: group.Name, ParentID: parentID}
				groupID := groupMap[key]
				if groupID == nil {
					return fmt.Errorf("group %s not found", group.Name)
				}

				// 处理当前组的 items
				for _, item := range group.Items {
					effectiveConfig := cfg.GetEffectiveConfig(&item, &group)
					headersJSON, _ := config.HeadersToJSON(effectiveConfig.Headers)

					url := item.URL // 将string转换为*string
					bookmark := &model.Bookmark{
						Name:          item.Name,
						URL:           &url, // 书签项有实际URL
						Icon:          item.Icon,
						ParentID:      groupID, // items的parent指向group节点
						Proxy:         effectiveConfig.Proxy,
						Headers:       headersJSON,
						HeartbeatCron: effectiveConfig.Heartbeat,
					}
					allBookmarks = append(allBookmarks, bookmark)
					urlSet[item.URL] = true
				}

				// 递归处理子组
				if len(group.Groups) > 0 {
					if err := collectItems(group.Groups, groupID); err != nil {
						return err
					}
				}
			}
			return nil
		}

		if err := collectItems(cfg.Groups, nil); err != nil {
			return err
		}

		// 3. 获取数据库中现有的所有书签（有URL的，即URL不为NULL的）
		var existingBookmarks []model.Bookmark
		if err := tx.Debug().Where("url IS NOT NULL").Find(&existingBookmarks).Error; err != nil {
			return fmt.Errorf("failed to query existing bookmarks: %w", err)
		}
		// log.Printf("existingBookmarks: %v", existingBookmarks)
		existingURLSet := make(map[string]uint) // URL -> ID
		for _, bm := range existingBookmarks {
			if bm.URL != nil {
				// 不存在 urlset 中，删除
				if !urlSet[*bm.URL] {
					if err := deleteBookmarkCascade(tx, bm.ID); err != nil {
						return fmt.Errorf("failed to delete bookmark %s: %w", *bm.URL, err)
					}
				} else {
					existingURLSet[*bm.URL] = bm.ID
				}
			}
		}
		log.Printf("existingURLSet: %v", existingURLSet)

		// 4. 更新或创建书签
		for _, bm := range allBookmarks {
			if bm.URL == nil {
				continue // 跳过group节点，它们已经在步骤1中处理了
			}
			if existingID, exists := existingURLSet[*bm.URL]; exists {
				// 更新现有书签
				if err := tx.Model(&model.Bookmark{}).Where("id = ?", existingID).Updates(map[string]interface{}{
					"name":           bm.Name,
					"icon":           bm.Icon,
					"parent_id":      bm.ParentID,
					"proxy":          bm.Proxy,
					"headers":        bm.Headers,
					"heartbeat_cron": bm.HeartbeatCron,
				}).Error; err != nil {
					urlStr := ""
					if bm.URL != nil {
						urlStr = *bm.URL
					}
					return fmt.Errorf("failed to update bookmark %s: %w", urlStr, err)
				}
			} else {
				// 创建新书签
				if err := tx.Create(bm).Error; err != nil {
					urlStr := ""
					if bm.URL != nil {
						urlStr = *bm.URL
					}
					return fmt.Errorf("failed to create bookmark %s: %w", urlStr, err)
				}
			}
			// 添加到existingURLSet
			existingURLSet[*bm.URL] = bm.ID
		}

		// 5. 删除 YAML 中不存在的书签（只删除有URL的书签，不删除group节点）
		for _, existing := range existingBookmarks {
			if existing.URL == nil {
				continue // 跳过group节点
			}
			if !urlSet[*existing.URL] {
				// 级联删除子项
				if err := deleteBookmarkCascade(tx, existing.ID); err != nil {
					return fmt.Errorf("failed to delete bookmark %s: %w", *existing.URL, err)
				}
			}
		}

		// 6. 清理不再使用的group节点（没有子项的group节点）
		// TODO 需要查询三次，因为有多级菜单
		var orphanGroups []model.Bookmark
		// 遍历三次以清理所有孤立的 group 节点
		for i := 0; i < 3; i++ {
			orphanGroups = nil // 清空切片，防止累积之前的结果
			if err := tx.Where("url IS NULL AND id NOT IN (SELECT DISTINCT parent_id FROM bookmarks WHERE parent_id IS NOT NULL)").Find(&orphanGroups).Error; err == nil {
				if len(orphanGroups) == 0 {
					break
				}
				log.Printf("第%d次清理，找到 %d 个不存在的模块", i+1, len(orphanGroups))
				for _, group := range orphanGroups {
					log.Printf("Deleting orphan group: %s", group.Name)
					tx.Delete(&group)
				}
			}
		}

		// 7. 记录同步日志
		logEntry := &model.SystemLog{
			Type:    model.LogTypeSync,
			Message: fmt.Sprintf("Synced %d bookmarks", len(allBookmarks)),
			Level:   model.LogLevelInfo,
		}
		if err := tx.Create(logEntry).Error; err != nil {
			// 日志记录失败不影响主流程
			_ = err
		}

		return nil
	})
}

// deleteBookmarkCascade 级联删除书签及其子项
func deleteBookmarkCascade(tx *gorm.DB, bookmarkID uint) error {
	// 查找所有子项
	var children []model.Bookmark
	if err := tx.Where("parent_id = ?", bookmarkID).Find(&children).Error; err != nil {
		return err
	}

	// 递归删除子项
	for _, child := range children {
		if err := deleteBookmarkCascade(tx, child.ID); err != nil {
			return err
		}
	}

	// 删除当前书签
	return tx.Delete(&model.Bookmark{}, bookmarkID).Error
}

// GetBookmarkTaskID 获取书签的任务 ID
func GetBookmarkTaskID(url string) string {
	hash := md5.Sum([]byte(url))
	return fmt.Sprintf("bookmark_%s", hex.EncodeToString(hash[:]))
}
