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
const STORAGE_SETTINGS_KEY = "bookmarkhub-storage-settings";
const WEBDAV_INDEX_FILE = "bookmarkhub-index.json";
const WEBDAV_LEGACY_FILE = "bookmarkhub-configs.json";

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

export type StorageKind = "browser" | "webdav";

export type WebdavSettings = {
  endpoint: string;
  username?: string;
  password?: string;
  remotePath: string;
};

type WebdavIndexEntry = {
  version: string;
  file: string;
  mtime?: string;
  size?: number;
};

type WebdavIndex = {
  activeVersion?: string;
  entries: WebdavIndexEntry[];
};

export type StorageSettings = {
  kind: StorageKind;
  webdav?: WebdavSettings;
};

const defaultWebdavSettings: WebdavSettings = {
  endpoint: "",
  username: "",
  password: "",
  remotePath: "bookmarkhub",
};

export const defaultStorageSettings: StorageSettings = {
  kind: "browser",
  webdav: defaultWebdavSettings,
};

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

const encodeBasicAuth = (username?: string, password?: string) => {
  if (!username) return undefined;
  const token =
    typeof btoa !== "undefined"
      ? btoa(`${username}:${password ?? ""}`)
      : typeof Buffer !== "undefined"
        ? Buffer.from(`${username}:${password ?? ""}`).toString("base64")
        : undefined;
  return token ? `Basic ${token}` : undefined;
};

const joinRemotePath = (endpoint: string, remotePath: string) => {
  try {
    const url = new URL(remotePath, endpoint);
    return url.toString();
  } catch {
    const normalizedEndpoint = endpoint.replace(/\/+$/, "");
    const normalizedPath = remotePath.replace(/^\/+/, "");
    return `${normalizedEndpoint}/${normalizedPath}`;
  }
};

abstract class ConfigStorage {
  abstract loadStoredConfigs(): Promise<StoredConfig[]>;
  abstract saveStoredConfigs(configs: StoredConfig[]): Promise<void>;

  async loadActiveConfig() {
    const stored = await this.loadStoredConfigs();
    return resolveActiveFromList(stored);
  }

  async addConfigIfChanged(yamlText: string) {
    const stored = await this.loadStoredConfigs();
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
    await this.saveStoredConfigs(nextConfigs);
    return { added: true, stored: sortConfigsDesc(nextConfigs), newVersion: version };
  }

  async deleteConfigByVersion(version: string) {
    const stored = await this.loadStoredConfigs();
    const nextConfigs = stored.filter((item) => item.version !== version);
    await this.saveStoredConfigs(nextConfigs);
    return resolveActiveFromList(nextConfigs);
  }
}

class BrowserConfigStorage extends ConfigStorage {
  loadStoredConfigs(): Promise<StoredConfig[]> {
    if (typeof window === "undefined") return Promise.resolve([]);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return Promise.resolve([]);
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return Promise.resolve([]);
      return Promise.resolve(
        parsed.filter((item): item is StoredConfig => {
          return typeof item?.version === "string" && typeof item?.yaml === "string";
        }),
      );
    } catch (error) {
      console.error("Failed to load stored configs", error);
      return Promise.resolve([]);
    }
  }

  saveStoredConfigs(configs: StoredConfig[]): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    return Promise.resolve();
  }
}

class WebdavConfigStorage extends ConfigStorage {
  private settings: WebdavSettings;

  constructor(settings: WebdavSettings) {
    super();
    this.settings = settings;
  }

  private dirPath() {
    return this.settings.remotePath.replace(/\/+$/, "");
  }

  private indexUrl() {
    const dir = this.dirPath();
    const targetPath = dir ? `${dir}/${WEBDAV_INDEX_FILE}` : WEBDAV_INDEX_FILE;
    return joinRemotePath(this.settings.endpoint, targetPath);
  }

  private versionUrl(fileName: string) {
    const dir = this.dirPath();
    const targetPath = dir ? `${dir}/${fileName}` : fileName;
    return joinRemotePath(this.settings.endpoint, targetPath);
  }

  private legacyUrl() {
    return this.versionUrl(WEBDAV_LEGACY_FILE);
  }

  private authHeader(): Record<string, string> {
    const auth = encodeBasicAuth(this.settings.username, this.settings.password);
    return auth ? { Authorization: auth } : {};
  }

  private async ensureRemoteDirectory() {
    const dir = this.dirPath();
    if (!dir) return;

    const segments = dir.split("/").filter(Boolean);
    const headers = this.authHeader();

    let current = "";
    for (const segment of segments) {
      current = current ? `${current}/${segment}` : segment;
      const url = joinRemotePath(this.settings.endpoint, current);
      try {
        const response = await fetch(url, { method: "MKCOL", headers });
        if ([201, 301, 405, 409].includes(response.status)) {
          continue;
        }
        if (!response.ok) {
          throw new Error(`MKCOL failed: ${response.status}`);
        }
      } catch (error) {
        console.error("Failed to ensure WebDAV directory", current, error);
        throw error;
      }
    }
  }

  private async ensureIndexExists() {
    await this.ensureRemoteDirectory();
    const headers = { ...this.authHeader() };

    try {
      const headResponse = await fetch(this.indexUrl(), { method: "HEAD", headers });
      if (headResponse.ok) return;
    } catch (error) {
      console.error("HEAD index check failed", error);
    }

    const emptyIndex: WebdavIndex = { activeVersion: undefined, entries: [] };
    try {
      await this.putIndex(emptyIndex);
    } catch (error) {
      console.error("Failed to initialize WebDAV index", error);
      throw error;
    }
  }

  private sanitizeIndex(parsed: WebdavIndex): WebdavIndex {
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    const filtered = entries.filter((item): item is WebdavIndexEntry => {
      return typeof item?.version === "string" && typeof item?.file === "string";
    });
    return {
      activeVersion: typeof parsed?.activeVersion === "string" ? parsed.activeVersion : undefined,
      entries: filtered,
    };
  }

  private putIndexOnce(index: WebdavIndex) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.authHeader(),
    };

    return fetch(this.indexUrl(), {
      method: "PUT",
      headers,
      body: JSON.stringify(index),
    });
  }

  private putFileOnce(fileName: string, content: string) {
    const headers: Record<string, string> = {
      "Content-Type": "text/plain",
      ...this.authHeader(),
    };

    return fetch(this.versionUrl(fileName), {
      method: "PUT",
      headers,
      body: content,
    });
  }

  private async bootstrapRemote(index: WebdavIndex = { activeVersion: undefined, entries: [] }) {
    await this.ensureRemoteDirectory();
    const response = await this.putIndexOnce(index);
    if (!response.ok && response.status !== 409) {
      throw new Error(`WebDAV bootstrap failed: ${response.status}`);
    }
  }

  private async loadIndex(): Promise<WebdavIndex> {
    const url = this.indexUrl();
    try {
      const response = await fetch(url, { headers: this.authHeader() });
      if (response.status === 404) {
        await this.ensureIndexExists();
        return { activeVersion: undefined, entries: [] };
      }
      if (!response.ok) throw new Error(`WebDAV index load failed: ${response.status}`);
      const json = await response.json();
      return this.sanitizeIndex(json as WebdavIndex);
    } catch (error) {
      console.error("Failed to load WebDAV index", error);
      throw error;
    }
  }

  private async putIndex(index: WebdavIndex, retryOnMissing = true) {
    let response = await this.putIndexOnce(index);

    if (retryOnMissing && !response.ok && (response.status === 404 || response.status === 409)) {
      await this.bootstrapRemote(index);
      response = await this.putIndexOnce(index);
    }

    if (!response.ok) {
      throw new Error(`WebDAV index save failed: ${response.status}`);
    }
  }

  private async putFile(fileName: string, content: string) {
    let response = await this.putFileOnce(fileName, content);

    if (!response.ok && (response.status === 404 || response.status === 409)) {
      await this.bootstrapRemote();
      response = await this.putFileOnce(fileName, content);
    }

    if (!response.ok) {
      throw new Error(`WebDAV save failed: ${response.status}`);
    }
  }

  private async deleteFile(fileName: string) {
    const response = await fetch(this.versionUrl(fileName), {
      method: "DELETE",
      headers: this.authHeader(),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`WebDAV delete failed: ${response.status}`);
    }
  }

  private async loadConfigsFromIndex(index: WebdavIndex): Promise<StoredConfig[]> {
    const headers = this.authHeader();
    const results = await Promise.all(
      index.entries.map(async (entry) => {
        try {
          const response = await fetch(this.versionUrl(entry.file), { headers });
          if (!response.ok) throw new Error(`load ${entry.file} status ${response.status}`);
          const yaml = await response.text();
          return { version: entry.version, yaml } as StoredConfig;
        } catch (error) {
          console.error("Failed to load version", entry.version, error);
          return null;
        }
      }),
    );

    return results.filter((item): item is StoredConfig => Boolean(item));
  }

  private async loadLegacyConfigs(): Promise<StoredConfig[]> {
    const headers = this.authHeader();
    try {
      const response = await fetch(this.legacyUrl(), { headers });
      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`legacy load failed: ${response.status}`);
      const text = await response.text();
      if (!text) return [];
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is StoredConfig => {
        return typeof item?.version === "string" && typeof item?.yaml === "string";
      });
    } catch (error) {
      console.error("Failed to load legacy WebDAV configs", error);
      return [];
    }
  }

  private async loadIndexAndConfigs(): Promise<{ index: WebdavIndex; configs: StoredConfig[] }> {
    const index = await this.loadIndex();
    let configs = await this.loadConfigsFromIndex(index);
    if (configs.length === 0) {
      configs = await this.loadLegacyConfigs();
    }
    return { index, configs: sortConfigsDesc(configs) };
  }

  async loadStoredConfigs(): Promise<StoredConfig[]> {
    const { configs } = await this.loadIndexAndConfigs();
    return configs;
  }

  async loadActiveConfig() {
    const { index, configs } = await this.loadIndexAndConfigs();
    const sorted = sortConfigsDesc(configs);

    const activeFromIndex = index.activeVersion
      ? configs.find((item) => item.version === index.activeVersion)
      : undefined;
    const activeCandidate = activeFromIndex ?? sorted[0];

    if (!activeCandidate) {
      return {
        activeVersion: "default",
        activeYaml: defaultConfigYaml,
        activeConfig: defaultConfig,
        sorted,
      };
    }

    const parsed = parseYamlToConfig(activeCandidate.yaml);
    if (!parsed) {
      return {
        activeVersion: "default",
        activeYaml: defaultConfigYaml,
        activeConfig: defaultConfig,
        sorted,
      };
    }

    return {
      activeVersion: activeCandidate.version,
      activeYaml: activeCandidate.yaml,
      activeConfig: parsed,
      sorted,
    };
  }

  async addConfigIfChanged(yamlText: string) {
    const { index, configs } = await this.loadIndexAndConfigs();
    const baselineYaml = index.activeVersion
      ? configs.find((item) => item.version === index.activeVersion)?.yaml ?? resolveActiveFromList(configs).activeYaml
      : resolveActiveFromList(configs).activeYaml;

    if (yamlText.trim() === baselineYaml.trim()) {
      return { added: false, stored: sortConfigsDesc(configs) };
    }

    const parsed = parseYamlToConfig(yamlText);
    if (!parsed) {
      return { added: false, stored: configs };
    }

    const version = timestampVersion();
    const fileName = version;

    await this.putFile(fileName, yamlText);

    const entry: WebdavIndexEntry = {
      version,
      file: fileName,
      mtime: new Date().toISOString(),
      size: yamlText.length,
    };

    const nextIndex: WebdavIndex = {
      activeVersion: version,
      entries: [...index.entries.filter((item) => item.version !== version), entry],
    };

    await this.putIndex(nextIndex);

    const nextConfigs = sortConfigsDesc([...configs.filter((item) => item.version !== version), { version, yaml: yamlText }]);

    return { added: true, stored: nextConfigs, newVersion: version };
  }

  async deleteConfigByVersion(version: string) {
    const { index, configs } = await this.loadIndexAndConfigs();
    const target = index.entries.find((item) => item.version === version);

    if (target) {
      try {
        await this.deleteFile(target.file);
      } catch (error) {
        console.error("Failed to delete version file", version, error);
      }
    }

    const nextEntries = index.entries.filter((item) => item.version !== version);
    const remainingConfigs = configs.filter((item) => item.version !== version);
    const resolved = resolveActiveFromList(remainingConfigs);

    const nextIndex: WebdavIndex = {
      activeVersion: resolved.activeVersion === "default" ? undefined : resolved.activeVersion,
      entries: nextEntries,
    };

    await this.putIndex(nextIndex);
    return resolved;
  }

  async saveStoredConfigs(configs: StoredConfig[]): Promise<void> {
    await this.ensureIndexExists();
    if (configs.length === 0) {
      const index: WebdavIndex = { activeVersion: undefined, entries: [] };
      await this.putIndex(index);
      return;
    }

    const entries: WebdavIndexEntry[] = [];
    for (const config of configs) {
      await this.putFile(config.version, config.yaml);
      entries.push({
        version: config.version,
        file: config.version,
        mtime: new Date().toISOString(),
        size: config.yaml.length,
      });
    }

    const latest = resolveActiveFromList(configs);
    const index: WebdavIndex = {
      activeVersion: latest.activeVersion === "default" ? undefined : latest.activeVersion,
      entries,
    };
    await this.putIndex(index);
  }
}

export const loadStorageSettings = (): StorageSettings => {
  if (typeof window === "undefined") return defaultStorageSettings;
  const raw = window.localStorage.getItem(STORAGE_SETTINGS_KEY);
  if (!raw) return defaultStorageSettings;
  try {
    const parsed = JSON.parse(raw) as StorageSettings;
    if (!parsed || typeof parsed !== "object") return defaultStorageSettings;
    return {
      kind: parsed.kind === "webdav" ? "webdav" : "browser",
      webdav: {
        ...defaultWebdavSettings,
        ...(parsed.webdav ?? {}),
      },
    };
  } catch (error) {
    console.error("Failed to load storage settings", error);
    return defaultStorageSettings;
  }
};

export const saveStorageSettings = (settings: StorageSettings) => {
  if (typeof window === "undefined") return;
  const normalized: StorageSettings = {
    kind: settings.kind,
    webdav: {
      ...defaultWebdavSettings,
      ...(settings.webdav ?? {}),
    },
  };
  window.localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(normalized));
};

export const createStorage = (settings?: StorageSettings): ConfigStorage => {
  const current = settings ?? loadStorageSettings();
  if (current.kind === "webdav") {
    const webdavSettings = {
      ...defaultWebdavSettings,
      ...(current.webdav ?? {}),
    };
    if (webdavSettings.endpoint && webdavSettings.remotePath) {
      return new WebdavConfigStorage(webdavSettings);
    }
  }
  return new BrowserConfigStorage();
};

// 默认浏览器存储快捷方法，保持兼容
const defaultStorage = new BrowserConfigStorage();

export const loadStoredConfigs = () => defaultStorage.loadStoredConfigs();
export const saveStoredConfigs = (configs: StoredConfig[]) => defaultStorage.saveStoredConfigs(configs);
export const loadActiveConfig = () => defaultStorage.loadActiveConfig();
export const addConfigIfChanged = (yamlText: string) => defaultStorage.addConfigIfChanged(yamlText);
export const deleteConfigByVersion = (version: string) => defaultStorage.deleteConfigByVersion(version);

export type { AppConfig, StoredConfig };
