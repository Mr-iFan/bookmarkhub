# 多阶段构建 - 构建阶段
FROM golang:1.24-alpine AS builder

# 安装必要的构建工具
RUN apk add --no-cache git

# 设置工作目录
WORKDIR /build

# 复制 go.mod 和 go.sum 先下载依赖（利用 Docker 缓存）
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 编译静态链接的可执行文件
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o bookmark-nav-generator .

# 多阶段构建 - 运行阶段（最小化镜像）
FROM alpine:latest

# 安装 ca-certificates 以支持 HTTPS
RUN apk --no-cache add ca-certificates

# 创建非 root 用户
RUN adduser -D -g '' appuser

# 设置工作目录
WORKDIR /app

# 从构建阶段复制可执行文件
COPY --from=builder /build/bookmark-nav-generator .

# 切换到非 root 用户
USER appuser

# 暴露默认端口
EXPOSE 8080

# 默认启动 Web 服务
ENTRYPOINT ["./bookmark-nav-generator"]
CMD ["serve", "--port", "8080"]
