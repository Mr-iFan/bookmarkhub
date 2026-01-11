# Implementation Plan: Bookmark Navigation UI

## Overview

基于现有HTML模板结构，更新书签导航UI实现模块化展示、层级导航和锚点定位功能。主要修改`internal/template/templates/template.html`模板文件。

## Tasks

- [x] 1. 更新Header模块Tab导航
  - [x] 1.1 修改header nav结构，为每个顶级bookmark生成模块Tab
    - 保持现有nav a样式
    - 使用.active类标记当前模块
    - _Requirements: 1.1, 1.4_

- [x] 2. 更新Sidebar层级导航
  - [x] 2.1 修改sidebar结构，显示当前模块(ActiveGroup)下的groups作为一级导航
    - 使用现有.tree-toggle类
    - 一级导航显示groups名称
    - _Requirements: 2.1, 2.3_
  - [x] 2.2 添加二级导航，显示一级groups下的嵌套groups
    - 使用现有.tree-link类
    - 二级导航链接到对应锚点
    - _Requirements: 3.1, 3.4_
  - [ ]* 2.3 编写属性测试验证侧边栏层级一致性
    - **Property 3: Sidebar Hierarchy Consistency**
    - **Validates: Requirements 1.3, 2.1, 3.1**

- [x] 3. 更新Content书签展示区
  - [x] 3.1 渲染模块直属书签（ActiveGroup.Items）
    - 使用现有.nav-grid和.nav-card样式
    - 添加section ID用于锚点定位
    - _Requirements: 1.2, 4.1_
  - [x] 3.2 渲染一级分组书签（ActiveGroup.Groups.Items）
    - 使用.category-title显示分组标题
    - 添加section ID用于锚点定位
    - _Requirements: 4.2_
  - [x] 3.3 渲染二级分组书签（嵌套Groups.Items）
    - 使用较小字号的标题区分层级
    - 添加section ID用于锚点定位
    - _Requirements: 4.2, 4.3_
  - [ ]* 3.4 编写属性测试验证书签完整渲染
    - **Property 2: Complete Bookmark Rendering**
    - **Validates: Requirements 1.2, 4.1**

- [ ] 4. Checkpoint - 验证模板渲染
  - 确保所有测试通过，如有问题请询问用户

- [x] 5. 实现锚点定位功能
  - [x] 5.1 为所有书签区块生成唯一ID
    - ID格式: section-{groupName}
    - 处理中文和特殊字符
    - _Requirements: 5.2_
  - [x] 5.2 添加平滑滚动JavaScript
    - 点击sidebar链接时平滑滚动到对应区域
    - _Requirements: 5.1_
  - [x] 5.3 添加滚动高亮JavaScript
    - 使用IntersectionObserver监听可见区域
    - 高亮对应的sidebar导航项
    - _Requirements: 5.3_
  - [ ]* 5.4 编写属性测试验证ID唯一性
    - **Property 8: Unique Section IDs**
    - **Validates: Requirements 5.2**

- [x] 6. 处理边界情况
  - [x] 6.1 处理模块只有items没有groups的情况
    - sidebar不显示导航
    - content直接显示书签
    - _Requirements: 2.2_
  - [x] 6.2 处理一级只有items没有嵌套groups的情况
    - 不显示二级导航
    - _Requirements: 3.4_
  - [ ]* 6.3 编写属性测试验证空导航处理
    - **Property 4: Empty Navigation Handling**
    - **Validates: Requirements 2.2, 3.4**

- [ ] 7. Checkpoint - 完整功能验证
  - 确保所有测试通过，如有问题请询问用户

- [x] 8. 添加导航高亮样式
  - [x] 8.1 添加.tree-link.active样式
    - 高亮当前可见区域对应的导航项
    - _Requirements: 5.3, 7.4_

- [ ] 9. Final Checkpoint - 最终验证
  - 确保所有测试通过，如有问题请询问用户

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 主要修改文件: `internal/template/templates/template.html`
- 复用现有CSS类，最小化样式修改
- Property tests使用gopter库（项目已配置）
