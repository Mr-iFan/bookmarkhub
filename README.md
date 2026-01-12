# Bookmark Nav Generator

书签导航网站生成器 - 一个基于 Go 语言的工具，能够解析 YAML 配置文件中的书签数据，使用 HTML 模板生成静态导航页面，同时支持启动 Web 服务实时预览。

## 功能特性

- 📖 解析 YAML 配置文件，支持嵌套书签分组
- 🌐 生成静态 HTML 导航页面
- 🚀 内置 Web 服务器，支持实时预览
- 📦 单一可执行文件，模板已嵌入
- 🐳 支持 Docker 容器化部署

## 安装

### 从源码编译

确保已安装 Go 1.24 或更高版本。

```bash
# 克隆项目
git clone https://github.com/your-username/bookmarkhub.git
cd bookmarkhub

# 编译
go build -o bookmarkhub .
```

### 使用 Docker

```bash
# 构建镜像
docker build -t bookmarkhub .

# 运行容器
docker run --name bookmarkhub -p 8080:8080 -v $(pwd)/config.yaml:/app/config.yaml bookmarkhub
```

## 使用方法

### 快速开始

1. 首次运行程序会自动生成配置模板：

```bash
./bookmarkhub
# 输出: 配置文件 config.yaml 不存在。
#       已生成配置模板文件 config.template.yaml，请根据需要修改后重命名为 config.yaml。
```

2. 将 `config.template.yaml` 重命名为 `config.yaml` 并编辑：

```bash
mv config.template.yaml config.yaml
```

3. 启动 Web 服务预览：

```bash
./bookmarkhub
# 或
./bookmarkhub serve
```

4. 访问 http://localhost:8080 查看导航页面

### 命令行参数

```bash
# 默认启动 Web 服务（端口 8080）
./bookmarkhub

# 指定端口启动 Web 服务
./bookmarkhub serve --port 3000
./bookmarkhub --port 3000

# 生成静态 HTML 文件到默认目录 ./output
./bookmarkhub generate

# 生成静态 HTML 文件到指定目录
./bookmarkhub generate --output ./dist
```

### 命令说明

| 命令 | 说明 |
|------|------|
| (无) | 默认启动 Web 服务 |
| `serve` | 启动 Web 服务 |
| `generate` | 生成静态 HTML 文件 |

### 参数说明

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--port` | `-p` | Web 服务端口 | 8080 |
| `--output` | `-o` | HTML 输出目录 | ./output |

## 配置文件格式

配置文件使用 YAML 格式，支持嵌套的书签分组结构。

### 基本结构

```yaml
bookmark:
  - name: "分组名称"
    items:
      - name: "书签名称"
        url: "https://example.com"
        icon: "https://example.com/favicon.ico"  # 可选
    groups:  # 可选，嵌套子分组
      - name: "子分组名称"
        items:
          - name: "子书签"
            url: "https://sub.example.com"
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bookmark` | 数组 | 是 | 顶级书签分组列表 |
| `name` | 字符串 | 是 | 分组或书签名称 |
| `url` | 字符串 | 是 | 书签链接地址 |
| `icon` | 字符串 | 否 | 书签图标 URL |
| `items` | 数组 | 否 | 分组下的书签项列表 |
| `groups` | 数组 | 否 | 嵌套的子分组列表 |

### 完整示例

```yaml
bookmark:
  # 开发工具分组
  - name: "开发工具"
    items:
      - name: "GitHub"
        url: "https://github.com"
        icon: "https://github.com/favicon.ico"
      - name: "GitLab"
        url: "https://gitlab.com"
      - name: "Stack Overflow"
        url: "https://stackoverflow.com"

  # 技术文档分组
  - name: "技术文档"
    items:
      - name: "MDN Web Docs"
        url: "https://developer.mozilla.org"
      - name: "Go 文档"
        url: "https://go.dev/doc"

  # 嵌套分组示例
  - name: "编程语言"
    items:
      - name: "Python 官网"
        url: "https://www.python.org"
      - name: "Go 官网"
        url: "https://go.dev"
    groups:
      - name: "Python 资源"
        items:
          - name: "PyPI"
            url: "https://pypi.org"
          - name: "Python 文档"
            url: "https://docs.python.org"
      - name: "Go 资源"
        items:
          - name: "Go 包仓库"
            url: "https://pkg.go.dev"
```

## 项目结构

```
bookmarkhub/
├── main.go                 # 程序入口
├── cmd/
│   └── root.go            # 命令行定义
├── internal/
│   ├── config/            # 配置解析
│   ├── generator/         # HTML 生成
│   ├── server/            # Web 服务
│   └── template/          # 模板处理
├── templates/
│   └── template.html      # HTML 模板
├── config.yaml            # 配置文件
├── Dockerfile
└── README.md
```

## 开发

### 运行测试

```bash
go test ./...
```

### 属性测试

项目使用 [gopter](https://github.com/leanovate/gopter) 进行属性测试：

```bash
go test -v ./internal/config/...
```

## License

MIT License
