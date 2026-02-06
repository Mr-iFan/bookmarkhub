import YAML from "yaml";
import { AppConfig, Bookmark, Category, Module } from "@/types";
import { bookmarks, moduleCategories, modules } from "@/data/bookmarks";

type StoredConfig = {
  version: string;
  yaml: string;
};

const STORAGE_KEY = "bookmarkhub-yaml-configs";

const flattenModuleCategories = (categoryMap: Record<string, Category[]>): Category[] => {
  return Object.values(categoryMap).flatMap((roots) => {
    return roots.flatMap((root) => {
      const { children, ...rootWithoutChildren } = root;
      const rootEntry: Category = rootWithoutChildren;
      const childEntries = root.children?.map((child) => {
        const { children: _ignored, ...childWithoutChildren } = child;
        return childWithoutChildren;
      });
      return [rootEntry, ...(childEntries ?? [])];
    });
  });
};

export const defaultConfig: AppConfig = {
  modules,
  categories: flattenModuleCategories(moduleCategories),
  bookmarks,
};

export const defaultConfigYaml = YAML.stringify(defaultConfig);

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
    const { modules: parsedModules, categories: parsedCategories, bookmarks: parsedBookmarks } = parsed as Partial<AppConfig>;
    if (!Array.isArray(parsedModules) || !Array.isArray(parsedCategories) || !Array.isArray(parsedBookmarks)) {
      return null;
    }
    return {
      modules: parsedModules,
      categories: parsedCategories,
      bookmarks: parsedBookmarks,
    };
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
