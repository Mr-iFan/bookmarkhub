"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createStorage,
  defaultConfigYaml,
  defaultStorageSettings,
  loadStorageSettings,
  parseYamlToConfig,
  resolveActiveFromList,
  saveStorageSettings,
  StoredConfig,
  StorageKind,
  StorageSettings,
  GithubSettings,
  WebdavSettings,
} from "@/lib/config";
import { StorageSettingsForm } from "./components/StorageSettingsForm";
import { NoticeBar, useNotice } from "@/lib/notice";

export default function SettingsPage() {
  const [yamlInput, setYamlInput] = useState<string>(defaultConfigYaml);
  const [configs, setConfigs] = useState<StoredConfig[]>([]);
  const [storageSettings, setStorageSettings] = useState<StorageSettings>(defaultStorageSettings);
  const [webdavDraft, setWebdavDraft] = useState<WebdavSettings>(() => defaultStorageSettings.webdav ?? {
    endpoint: "",
    username: "",
    password: "",
    remotePath: "",
  });
  const [githubDraft, setGithubDraft] = useState<GithubSettings>(() => defaultStorageSettings.github ?? {
    owner: "",
    repo: "",
    branch: "",
    token: "",
    remotePath: "",
  });
  const [loading, setLoading] = useState(false);
  const { activeVersion } = useMemo(() => resolveActiveFromList(configs), [configs]);
  const { notice, showInfo, showWarn, showError } = useNotice();

   // stabilize notice functions for callbacks to avoid dependency churn
  const showErrorRef = useRef(showError);
  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  const refreshFromStorage = useCallback(async (settings: StorageSettings) => {
    setLoading(true);
    try {
      const storage = createStorage(settings);
      const { activeYaml, sorted } = await storage.loadActiveConfig();
      setYamlInput(activeYaml);
      setConfigs(sorted);
    } catch (error) {
      console.error(error);
      showErrorRef.current?.("加载配置失败，已回退到默认配置");
      setYamlInput(defaultConfigYaml);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const settings = loadStorageSettings();
    setStorageSettings(settings);
    setWebdavDraft(normalizeWebdav(settings.webdav));
    setGithubDraft(normalizeGithub(settings.github));
    refreshFromStorage(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizeWebdav = (value?: WebdavSettings): WebdavSettings => ({
    endpoint: value?.endpoint ?? defaultStorageSettings.webdav?.endpoint ?? "",
    username: value?.username ?? defaultStorageSettings.webdav?.username ?? "",
    password: value?.password ?? defaultStorageSettings.webdav?.password ?? "",
    remotePath: value?.remotePath ?? defaultStorageSettings.webdav?.remotePath ?? "",
  });

  const normalizeGithub = (value?: GithubSettings): GithubSettings => ({
    owner: value?.owner ?? defaultStorageSettings.github?.owner ?? "",
    repo: value?.repo ?? defaultStorageSettings.github?.repo ?? "",
    branch: value?.branch ?? defaultStorageSettings.github?.branch ?? "",
    token: value?.token ?? defaultStorageSettings.github?.token ?? "",
    remotePath: value?.remotePath ?? defaultStorageSettings.github?.remotePath ?? "",
  });

  const requireStorageReady = (settings: StorageSettings) => {
    if (settings.kind === "webdav") {
      const { endpoint, remotePath } = settings.webdav ?? {};
      if (!endpoint || !remotePath) {
        showWarn("请填写 WebDAV 地址与存储路径");
        return false;
      }
      return true;
    }

    if (settings.kind === "github") {
      const { owner, repo, branch, token, remotePath } = settings.github ?? {};
      if (!owner || !repo || !branch || !remotePath || !token) {
        showWarn("请填写 GitHub 仓库信息（owner/repo/branch/token/目录）");
        return false;
      }
      return true;
    }

    return true;
  };

  const handleAdd = async () => {
    const parsed = parseYamlToConfig(yamlInput);
    if (!parsed) {
      showError("YAML 解析失败，请检查格式");
      return;
    }
    if (!requireStorageReady(storageSettings)) return;
    setLoading(true);
    try {
      const storage = createStorage(storageSettings);
      const result = await storage.addConfigIfChanged(yamlInput);
      if (result.added && result.newVersion) {
        setConfigs(result.stored);
        showInfo(`已添加版本 ${result.newVersion}`);
      } else {
        showWarn("内容与当前配置相同，无需添加");
      }
    } catch (error) {
      console.error(error);
      showError("保存到存储失败，请检查配置");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (version: string) => {
    if (!requireStorageReady(storageSettings)) return;
    setLoading(true);
    try {
      const storage = createStorage(storageSettings);
      const { activeVersion: nextActive, sorted } = await storage.deleteConfigByVersion(version);
      setConfigs(sorted);
      showInfo(`已删除 ${version}，当前版本：${nextActive}`);
    } catch (error) {
      console.error(error);
      showError("删除失败，请检查存储配置");
    } finally {
      setLoading(false);
    }
  };

  const handleUseDefault = async () => {
    if (!requireStorageReady(storageSettings)) return;
    setLoading(true);
    try {
      const storage = createStorage(storageSettings);
      await storage.saveStoredConfigs([]);
      setYamlInput(defaultConfigYaml);
      setConfigs([]);
      showInfo("已切换到默认配置");
    } catch (error) {
      console.error(error);
      showError("重置失败，请检查存储配置");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    const parsed = parseYamlToConfig(yamlInput);
    if (!parsed) {
      showError("YAML 解析失败，请检查格式");
      return;
    }
    if (!requireStorageReady(storageSettings)) return;
    setLoading(true);
    try {
      const storage = createStorage(storageSettings);
      const result = await storage.addConfigIfChanged(yamlInput);
      if (result.added) {
        setConfigs(result.stored);
        showInfo(result.newVersion ? `已保存并生效：${result.newVersion}` : "已保存并生效");
      } else {
        showWarn("内容与当前配置相同，无需保存");
      }
    } catch (error) {
      console.error(error);
      showError("保存失败，请检查存储配置");
    } finally {
      setLoading(false);
    }
  };

  const sortedConfigs = useMemo(() => {
    return [...configs].sort((a, b) => Number(b.version.replace(/\.yaml$/, "")) - Number(a.version.replace(/\.yaml$/, "")));
  }, [configs]);

  const handleStorageKindChange = (kind: StorageKind) => {
    if (kind === "webdav") {
      setWebdavDraft(normalizeWebdav(storageSettings.webdav));
    }
    if (kind === "github") {
      setGithubDraft(normalizeGithub(storageSettings.github));
    }

    const next: StorageSettings = {
      ...storageSettings,
      kind,
      webdav: normalizeWebdav(storageSettings.webdav),
      github: normalizeGithub(storageSettings.github),
    };
    setStorageSettings(next);
    saveStorageSettings(next);
    const shouldRefreshGithub =
      kind !== "github" ||
      Boolean(
        next.github?.owner &&
          next.github?.repo &&
          next.github?.branch &&
          next.github?.remotePath &&
          next.github?.token,
      );
    if (shouldRefreshGithub) {
      refreshFromStorage(next);
    }
  };

  const handleWebdavFieldChange = (field: keyof NonNullable<StorageSettings["webdav"]>, value: string) => {
    const nextWebdav: WebdavSettings = normalizeWebdav({
      ...webdavDraft,
      [field]: value,
    });
    setWebdavDraft(nextWebdav);
  };

  const handleGithubFieldChange = (field: keyof NonNullable<StorageSettings["github"]>, value: string) => {
    const nextGithub: GithubSettings = normalizeGithub({
      ...githubDraft,
      [field]: value,
    });
    setGithubDraft(nextGithub);
  };

  const handleSaveWebdavConfig = async () => {
    const endpoint = webdavDraft.endpoint?.trim();
    const remotePath = webdavDraft.remotePath?.trim();
    if (!endpoint || !remotePath) {
      showWarn("请填写 WebDAV 地址与目录");
      return;
    }

    const nextSettings: StorageSettings = {
      kind: "webdav",
      webdav: normalizeWebdav({
        ...webdavDraft,
        endpoint,
        remotePath,
      }),
      github: normalizeGithub(storageSettings.github),
    };

    const parsed = parseYamlToConfig(yamlInput);
    if (!parsed) {
      showError("YAML 解析失败，请检查格式");
      return;
    }

    setLoading(true);
    try {
      const storage = createStorage(nextSettings);
      const result = await storage.addConfigIfChanged(yamlInput);
      if (result.added) {
        saveStorageSettings(nextSettings);
        setStorageSettings(nextSettings);
        setWebdavDraft(nextSettings.webdav!);
        showInfo("WebDAV 配置已保存并生效");
        await refreshFromStorage(nextSettings);
      } else {
        showWarn("内容未变化，无需保存");
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "保存失败，请检查 WebDAV 配置";
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGithubConfig = async () => {
    const owner = githubDraft.owner?.trim();
    const repo = githubDraft.repo?.trim();
    const branch = githubDraft.branch?.trim();
    const token = githubDraft.token?.trim();
    const remotePath = githubDraft.remotePath?.trim();

    if (!owner || !repo || !branch || !remotePath || !token) {
      showWarn("请填写 GitHub 仓库、分支、Token 与目录");
      return;
    }

    const nextSettings: StorageSettings = {
      kind: "github",
      github: normalizeGithub({
        ...githubDraft,
        owner,
        repo,
        branch,
        token,
        remotePath,
      }),
      webdav: normalizeWebdav(storageSettings.webdav),
    };

    const parsed = parseYamlToConfig(yamlInput);
    if (!parsed) {
      showError("YAML 解析失败，请检查格式");
      return;
    }

    setLoading(true);
    try {
      const storage = createStorage(nextSettings);
      const result = await storage.addConfigIfChanged(yamlInput);
      if (result.added) {
        saveStorageSettings(nextSettings);
        setStorageSettings(nextSettings);
        setGithubDraft(nextSettings.github!);
        showInfo("GitHub 仓库存储已保存并生效");
        await refreshFromStorage(nextSettings);
      } else {
        showWarn("内容未变化，无需保存");
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "保存失败，请检查 GitHub 配置";
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf5] text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 min-h-screen">
        <NoticeBar notice={notice} />
        <header className="flex items-center justify-between border border-dashed border-[#b7bcc2] bg-white/80 px-4 py-3">
          <h1 className="text-xl font-semibold text-slate-900">配置中心</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-3 py-1">当前版本：{activeVersion}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">存储方式</span>
              <select
                className="border border-dashed border-[#b7bcc2] bg-white px-2 py-1 text-sm text-slate-700 hover:bg-[#fdfbf5]"
                value={storageSettings.kind}
                onChange={(e) => handleStorageKindChange(e.target.value as StorageKind)}
                disabled={loading}
              >
                <option value="browser">浏览器</option>
                <option value="webdav">WebDAV</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleUseDefault}
              className="border border-dashed border-[#b7bcc2] bg-white px-3 py-1 text-sm text-slate-700 hover:bg-[#fdfbf5]"
              disabled={loading}
            >
              使用默认配置
            </button>
            <Link
              href="/"
              className="border border-dashed border-[#b7bcc2] bg-white px-3 py-1 text-sm text-slate-700 hover:bg-[#fdfbf5]"
            >
              返回首页
            </Link>
          </div>
        </header>

        <StorageSettingsForm
          storageSettings={storageSettings}
          webdavDraft={webdavDraft}
          githubDraft={githubDraft}
          loading={loading}
          onWebdavFieldChange={handleWebdavFieldChange}
          onGithubFieldChange={handleGithubFieldChange}
          onSaveWebdavConfig={handleSaveWebdavConfig}
          onSaveGithubConfig={handleSaveGithubConfig}
        />

        <section className="grid flex-1 auto-rows-fr items-stretch gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 flex h-full flex-col gap-3 border border-dashed border-[#b7bcc2] bg-white/90 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">编辑 YAML</h2>
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={handleApply}
                  className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-3 py-1 text-slate-700 hover:bg-white"
                  disabled={loading}
                >
                  保存并应用
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="border border-dashed border-[#b7bcc2] bg-white px-3 py-1 text-slate-700 hover:bg-[#fdfbf5]"
                  disabled={loading}
                >
                  添加为新版本
                </button>
              </div>
            </div>
            <textarea
              className="flex-1 min-h-[480px] w-full border border-dashed border-[#b7bcc2] bg-[#fdfbf5] p-3 font-mono text-sm text-slate-800 focus:outline-none"
              value={yamlInput}
              onChange={(e) => setYamlInput(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="lg:col-span-5 flex h-full flex-col gap-3 border border-dashed border-[#b7bcc2] bg-white/90 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">历史配置</h2>
              <span className="text-xs text-slate-500">点击删除会回退到最新可用</span>
            </div>
            <div className="flex flex-col divide-y divide-dashed divide-[#e0e4e8] border border-dashed border-[#b7bcc2] bg-[#fdfbf5]">
              {sortedConfigs.length === 0 ? (
                <div className="px-3 py-6 text-sm text-slate-600">暂无历史配置，使用默认配置</div>
              ) : (
                sortedConfigs.map((config) => {
                  const created = config.version.replace(/\.yaml$/, "");
                  return (
                    <div key={config.version} className="flex items-center justify-between px-3 py-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800">版本 {created}</p>
                        <p className="text-xs text-slate-500 break-all">{config.version}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setYamlInput(config.yaml)}
                          className="border border-dashed border-[#b7bcc2] bg-white px-2 py-1 text-xs text-slate-700 hover:bg-[#fdfbf5]"
                          disabled={loading}
                        >
                          查看
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(config.version)}
                          className="border border-dashed border-[#b7bcc2] bg-white px-2 py-1 text-xs text-red-600 hover:bg-[#fdfbf5]"
                          disabled={loading}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
