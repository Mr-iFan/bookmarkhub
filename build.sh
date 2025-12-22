#!/bin/bash

set -e

echo "Building BookmarkHub..."

# 构建前端
echo "Building frontend..."
cd frontend
pnpm install
pnpm run build
cd ..

# 构建 Go 后端
echo "Building Go backend..."

# 编译当前系统版本
go build -o bookmarkhub main.go

echo "Build complete! Run ./bookmarkhub to start the server."

