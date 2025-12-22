# BookmarkHub

一个功能强大的书签管理系统，支持 YAML 配置驱动的书签同步、自动心跳检测、Favicon 抓取和现代化的 Web 界面。

## 功能特性

- 📝 **YAML 配置驱动**：使用 YAML 文件管理书签，支持配置继承和 include
- 🔄 **自动同步**：文件变更自动同步到数据库
- 💓 **心跳检测**：自动检测书签可用性，支持自定义检测频率
- 🎨 **Favicon 抓取**：自动抓取网站图标
- 🌐 **现代化 UI**：基于 Next.js 的响应式 Web 界面
- 🌙 **暗色模式**：支持明暗主题切换
- 🔍 **搜索功能**：支持按名称和 URL 搜索书签
- 📊 **状态监控**：实时显示书签在线状态、延迟和 HTTP 状态码

## 快速开始

### 1. 构建项目

```bash
./build.sh
```

### 2. 配置书签

创建 `config.yaml` 文件（参考 `config.yaml.example`）：

```yaml
settings:
  heartbeat: "0 */30 * * * *"
  
groups:
  - name: "我的书签"
    items:
      - name: "GitHub"
        url: "https://github.com"
```

### 3. 运行

```bash
./bookmarkhub
```

服务器将在 `http://localhost:8080` 启动。

## 配置说明

### 配置继承

BookmarkHub 支持三级配置继承：

1. **全局设置** (`settings`)：所有书签的默认配置
2. **组设置** (`groups` 中的配置)：组内书签的默认配置
3. **书签设置** (`items` 中的配置)：单个书签的配置

继承优先级：书签 > 组 > 全局

### 配置项说明

- `heartbeat`: Cron 表达式，定义心跳检测频率（默认：`"0 */30 * * * *"`）
- `proxy`: HTTP 代理地址（可选）
- `headers`: HTTP 请求头（Map 格式，支持 `false` 值禁用继承）

### Include 支持

支持通过 `include` 字段引入其他配置文件：

```yaml
groups:
  - name: "外部书签"
    include: "external-bookmarks.yaml"
```

最大 include 深度：3 层

## API 接口

- `GET /api/bookmarks` - 获取所有书签（扁平列表）
- `GET /api/bookmarks/tree` - 获取嵌套树形结构
- `GET /api/bookmarks/:id` - 获取单个书签详情
- `GET /api/health` - 系统健康检查

## 技术栈

- **后端**: Go 1.21+, Gin, GORM, SQLite
- **前端**: Next.js 14+, TailwindCSS, SWR
- **任务调度**: robfig/cron/v3
- **HTTP 客户端**: resty

## 许可证

MIT

