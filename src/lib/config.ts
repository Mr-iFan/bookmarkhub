import YAML from "yaml";
import { AppConfig, Bookmark, Category, Module } from "@/types";
import { bookmarks, moduleCategories, modules } from "@/data/bookmarks";

type StoredConfig = {
  version: string;
  yaml: string;
};

type YamlLink = {
  title?: string;
  url?: string;
  description?: string;
};

type YamlCategory = {
  name?: string;
  urls?: YamlLink[];
  children?: YamlCategory[];
};

type YamlModule = {
  name?: string;
  description?: string;
  categories?: YamlCategory[];
  urls?: YamlLink[];
};

type BookmarkhubRoot = {
  bookmarkhub?: YamlModule[];
};

const STORAGE_KEY = "bookmarkhub-yaml-configs";

const slugify = (value: string) => {
  return value
    .normalize("NFKD")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    || "item";
};

const uniqueId = (base: string, used: Set<string>) => {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let counter = 2;
  let next = `${base}-${counter}`;
  while (used.has(next)) {
    counter += 1;
    next = `${base}-${counter}`;
  }
  used.add(next);
  return next;
};

const buildAppConfigFromBookmarkhub = (data: BookmarkhubRoot): AppConfig | null => {
  if (!data || !Array.isArray(data.bookmarkhub)) return null;

  const modulesList: Module[] = [];
  const categoriesList: Category[] = [];
  const bookmarksList: Bookmark[] = [];

  const usedModuleIds = new Set<string>();
  const usedCategoryIds = new Set<string>();
  const usedBookmarkIds = new Set<string>();

  const addBookmarks = (params: {
    links?: YamlLink[];
    moduleId: string;
    categoryId: string;
    path: string[];
  }) => {
    const { links, moduleId, categoryId, path } = params;
    if (!Array.isArray(links)) return;

    links.forEach((link, index) => {
      if (!link?.title || !link?.url) return;
      const linkSlug = slugify(link.title) || `url-${index + 1}`;
      const bookmarkBase = [...path, linkSlug].join("__");
      const bookmarkId = uniqueId(bookmarkBase, usedBookmarkIds);

      bookmarksList.push({
        id: bookmarkId,
        title: link.title,
        url: link.url,
        description: link.description ?? "",
        moduleId,
        categoryId,
      });
    });
  };

  const walkCategory = (node: YamlCategory, ctx: { moduleId: string; parentId?: string; path: string[] }) => {
    if (!node?.name) return;
    const slug = slugify(node.name);
    const currentPath = [...ctx.path, slug];
    const categoryBase = currentPath.join("__");
    const categoryId = uniqueId(categoryBase, usedCategoryIds);

    categoriesList.push({
      id: categoryId,
      name: node.name,
      moduleId: ctx.moduleId,
      parentId: ctx.parentId,
    });

    addBookmarks({ links: node.urls, moduleId: ctx.moduleId, categoryId, path: currentPath });

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => {
        walkCategory(child, { moduleId: ctx.moduleId, parentId: categoryId, path: currentPath });
      });
    }
  };

  data.bookmarkhub.forEach((moduleNode) => {
    if (!moduleNode?.name) return;
    const moduleSlug = slugify(moduleNode.name);
    const moduleId = uniqueId(moduleSlug, usedModuleIds);

    modulesList.push({
      id: moduleId,
      name: moduleNode.name,
      description: moduleNode.description,
    });

    // 允许模块直接挂 urls（较少见，但保持兼容）
    addBookmarks({ links: moduleNode.urls, moduleId, categoryId: moduleId, path: [moduleSlug] });

    if (Array.isArray(moduleNode.categories)) {
      moduleNode.categories.forEach((cat) => {
        walkCategory(cat, { moduleId, path: [moduleSlug] });
      });
    }
  });

  if (modulesList.length === 0) return null;

  return {
    modules: modulesList,
    categories: categoriesList,
    bookmarks: bookmarksList,
  };
};

const buildAppConfigFromFlat = (parsed: Partial<AppConfig>): AppConfig | null => {
  const { modules: parsedModules, categories: parsedCategories, bookmarks: parsedBookmarks } = parsed;
  if (!Array.isArray(parsedModules) || !Array.isArray(parsedCategories) || !Array.isArray(parsedBookmarks)) {
    return null;
  }
  return {
    modules: parsedModules,
    categories: parsedCategories,
    bookmarks: parsedBookmarks,
  };
};

const buildDefaultBookmarkhub = (): BookmarkhubRoot => {
  const rootModules = modules.map<YamlModule>((mod) => ({
    name: mod.name,
    description: mod.description,
    categories: [],
  }));

  const moduleIndex = Object.fromEntries(rootModules.map((mod, idx) => [modules[idx].id, mod]));

  Object.entries(moduleCategories).forEach(([moduleId, roots]) => {
    const targetModule = moduleIndex[moduleId];
    if (!targetModule) return;

    const categoryMap: Record<string, YamlCategory> = {};

    const cloneCategory = (cat: Category): YamlCategory => {
      const node: YamlCategory = { name: cat.name };
      categoryMap[cat.id] = node;
      if (cat.children?.length) {
        node.children = cat.children.map(cloneCategory);
      }
      return node;
    };

    targetModule.categories = roots.map(cloneCategory);

    const moduleBookmarks = bookmarks.filter((b) => b.moduleId === moduleId);
    moduleBookmarks.forEach((bm) => {
      const targetCategory = categoryMap[bm.categoryId];
      if (!targetCategory) return;
      if (!Array.isArray(targetCategory.urls)) targetCategory.urls = [];
      targetCategory.urls.push({ title: bm.title, url: bm.url, description: bm.description });
    });
  });

  return { bookmarkhub: rootModules };
};

const defaultBookmarkhub = buildDefaultBookmarkhub();
const defaultAppConfig = buildAppConfigFromBookmarkhub(defaultBookmarkhub);
const legacyCategories = Object.values(moduleCategories).flatMap((roots) => {
  return roots.flatMap((root) => {
    const { children, ...rootRest } = root;
    const childEntries = root.children?.map(({ children: _ignored, ...childRest }) => childRest) ?? [];
    return [rootRest, ...childEntries];
  });
});

export const defaultConfig: AppConfig = defaultAppConfig ?? {
  modules,
  categories: legacyCategories,
  bookmarks,
};

export const defaultConfigYaml = YAML.stringify(defaultBookmarkhub);

const parseTimestampFromVersion = (version: string): number => {
  const numeric = version.replace(/\.yaml$/i, "");
  const parsed = Number.parseInt(numeric, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sortConfigsDesc = (configs: StoredConfig[]) => {
  return [...configs].sort((a, b) => parseTimestampFromVersion(b.version) - parseTimestampFromVersion(a.version));
};

export const timestampVersion = () => {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.yaml`;
};

export const parseYamlToConfig = (yamlText: string): AppConfig | null => {
  try {
    const parsed = YAML.parse(yamlText);
    if (!parsed || typeof parsed !== "object") return null;
    const newFormat = buildAppConfigFromBookmarkhub(parsed as BookmarkhubRoot);
    if (newFormat) return newFormat;

    const legacy = buildAppConfigFromFlat(parsed as Partial<AppConfig>);
    if (legacy) return legacy;

    return null;
  } catch (error) {
    console.error("Failed to parse YAML", error);
    return null;
  }
};

export const loadStoredConfigs = (): StoredConfig[] => {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredConfig => {
      return typeof item?.version === "string" && typeof item?.yaml === "string";
    });
  } catch (error) {
    console.error("Failed to load stored configs", error);
    return [];
  }
};

export const saveStoredConfigs = (configs: StoredConfig[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
};

export const resolveActiveFromList = (configs: StoredConfig[]) => {
  const sorted = sortConfigsDesc(configs);
  const latest = sorted[0];

  if (!latest) {
    return {
      activeVersion: "default",
      activeYaml: defaultConfigYaml,
      activeConfig: defaultConfig,
      sorted,
    };
  }

  const parsedConfig = parseYamlToConfig(latest.yaml);
  if (!parsedConfig) {
    return {
      activeVersion: "default",
      activeYaml: defaultConfigYaml,
      activeConfig: defaultConfig,
      sorted,
    };
  }

  return {
    activeVersion: latest.version,
    activeYaml: latest.yaml,
    activeConfig: parsedConfig,
    sorted,
  };
};

export const loadActiveConfig = () => {
  const stored = loadStoredConfigs();
  return resolveActiveFromList(stored);
};

export const addConfigIfChanged = (yamlText: string) => {
  const stored = loadStoredConfigs();
  const { activeYaml } = resolveActiveFromList(stored);
  if (yamlText.trim() === activeYaml.trim()) {
    return { added: false, stored };
  }

  const parsed = parseYamlToConfig(yamlText);
  if (!parsed) {
    return { added: false, stored };
  }

  const version = timestampVersion();
  const nextConfigs = [...stored, { version, yaml: yamlText }];
  saveStoredConfigs(nextConfigs);
  return { added: true, stored: sortConfigsDesc(nextConfigs), newVersion: version };
};

export const deleteConfigByVersion = (version: string) => {
  const stored = loadStoredConfigs();
  const nextConfigs = stored.filter((item) => item.version !== version);
  saveStoredConfigs(nextConfigs);
  return resolveActiveFromList(nextConfigs);
};

export type { AppConfig, StoredConfig };
