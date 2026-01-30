import { Bookmark, Category, Module } from "@/types";

export const modules: Module[] = [
  {
    id: "productivity",
    name: "效率工作台",
    description: "日常协同与效率工具合集",
  },
  {
    id: "development",
    name: "开发工具箱",
    description: "面向工程师的常用资源",
  },
  {
    id: "discovery",
    name: "灵感探索",
    description: "设计灵感与学习资源",
  },
];

export const moduleCategories: Record<string, Category[]> = {
  productivity: [
    {
      id: "daily-tools",
      name: "日常工具",
      moduleId: "productivity",
      children: [
        { id: "reading", name: "阅读与稍后", moduleId: "productivity", parentId: "daily-tools" },
        { id: "time", name: "时间与日程", moduleId: "productivity", parentId: "daily-tools" },
      ],
    },
    {
      id: "cloud",
      name: "云端与存储",
      moduleId: "productivity",
      children: [
        { id: "drive", name: "云盘", moduleId: "productivity", parentId: "cloud" },
        { id: "collab", name: "协作", moduleId: "productivity", parentId: "cloud" },
      ],
    },
  ],
  development: [
    {
      id: "frontend",
      name: "前端",
      moduleId: "development",
      children: [
        { id: "ui-kits", name: "组件库", moduleId: "development", parentId: "frontend" },
        { id: "perf", name: "性能调优", moduleId: "development", parentId: "frontend" },
      ],
    },
    {
      id: "backend",
      name: "后端",
      moduleId: "development",
      children: [
        { id: "api", name: "API 设计", moduleId: "development", parentId: "backend" },
        { id: "db", name: "数据库", moduleId: "development", parentId: "backend" },
      ],
    },
  ],
  discovery: [
    {
      id: "design",
      name: "设计灵感",
      moduleId: "discovery",
      children: [
        { id: "palette", name: "配色", moduleId: "discovery", parentId: "design" },
        { id: "gallery", name: "图形与图库", moduleId: "discovery", parentId: "design" },
      ],
    },
    {
      id: "learning",
      name: "学习资源",
      moduleId: "discovery",
      children: [
        { id: "courses", name: "课程", moduleId: "discovery", parentId: "learning" },
        { id: "community", name: "社区", moduleId: "discovery", parentId: "learning" },
      ],
    },
  ],
};

export const bookmarks: Bookmark[] = [
  {
    id: "notion",
    title: "Notion",
    url: "https://www.notion.so/",
    description: "一体化笔记与协作工作台，支持数据库与团队协作。",
    moduleId: "productivity",
    categoryId: "collab",
  },
  {
    id: "todoist",
    title: "Todoist",
    url: "https://todoist.com/",
    description: "轻量任务与日程管理，快速收集与安排待办。",
    moduleId: "productivity",
    categoryId: "time",
  },
  {
    id: "raindrop",
    title: "Raindrop.io",
    url: "https://raindrop.io/",
    description: "优雅的跨平台书签与阅读稍后工具。",
    moduleId: "productivity",
    categoryId: "reading",
  },
  {
    id: "google-drive",
    title: "Google Drive",
    url: "https://drive.google.com/",
    description: "云端文件存储与共享，实时协作编辑。",
    moduleId: "productivity",
    categoryId: "drive",
  },
  {
    id: "figma",
    title: "Figma",
    url: "https://www.figma.com/",
    description: "基于云端的协同设计工具，适合产品与设计团队。",
    moduleId: "development",
    categoryId: "ui-kits",
  },
  {
    id: "storybook",
    title: "Storybook",
    url: "https://storybook.js.org/",
    description: "组件开发与文档平台，支持 React、Vue 等前端框架。",
    moduleId: "development",
    categoryId: "ui-kits",
  },
  {
    id: "webpagetest",
    title: "WebPageTest",
    url: "https://www.webpagetest.org/",
    description: "页面性能检测与瀑布图分析，支持多节点测试。",
    moduleId: "development",
    categoryId: "perf",
  },
  {
    id: "postman",
    title: "Postman",
    url: "https://www.postman.com/",
    description: "API 调试与测试平台，支持协作与自动化。",
    moduleId: "development",
    categoryId: "api",
  },
  {
    id: "supabase",
    title: "Supabase",
    url: "https://supabase.com/",
    description: "开源后端即服务，提供数据库与认证能力。",
    moduleId: "development",
    categoryId: "db",
  },
  {
    id: "muzli",
    title: "Muzli",
    url: "https://muz.li/",
    description: "每日设计灵感聚合，涵盖 UI、品牌与案例。",
    moduleId: "discovery",
    categoryId: "gallery",
  },
  {
    id: "coolors",
    title: "Coolors",
    url: "https://coolors.co/",
    description: "快速生成配色方案，可导出调色板。",
    moduleId: "discovery",
    categoryId: "palette",
  },
  {
    id: "dribbble",
    title: "Dribbble",
    url: "https://dribbble.com/",
    description: "设计师作品社区，获取视觉与交互灵感。",
    moduleId: "discovery",
    categoryId: "gallery",
  },
  {
    id: "frontend-masters",
    title: "Frontend Masters",
    url: "https://frontendmasters.com/",
    description: "高质量前端课程平台，涵盖框架、性能与工程化。",
    moduleId: "discovery",
    categoryId: "courses",
  },
  {
    id: "devto",
    title: "DEV Community",
    url: "https://dev.to/",
    description: "开发者社区与文章平台，分享工程实践与案例。",
    moduleId: "discovery",
    categoryId: "community",
  },
];

export const allCategories = Object.values(moduleCategories).flat();
