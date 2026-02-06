"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  WebdavSettings,
} from "@/lib/config";
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
  const [loading, setLoading] = useState(false);
  const { activeVersion } = useMemo(() => resolveActiveFromList(configs), [configs]);
  const { notice, showInfo, showWarn, showError } = useNotice();

  useEffect(() => {
    const settings = loadStorageSettings();
    setStorageSettings(settings);
    const draft = settings.webdav ?? defaultStorageSettings.webdav ?? {
      endpoint: "",
      username: "",
      password: "",
      remotePath: "",
    };
    setWebdavDraft(draft);
    refreshFromStorage(settings);
  }, []);

  const refreshFromStorage = async (settings: StorageSettings = storageSettings) => {
    setLoading(true);
    try {
      const storage = createStorage(settings);
      const { activeYaml, sorted } = await storage.loadActiveConfig();
      setYamlInput(activeYaml);
      setConfigs(sorted);
    } catch (error) {
      console.error(error);
      showError("加载配置失败，已回退到默认配置");
      setYamlInput(defaultConfigYaml);
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  };

  const requireWebdavReady = (settings: StorageSettings) => {
    if (settings.kind !== "webdav") return true;
    const { endpoint, remotePath } = settings.webdav ?? {};
    if (!endpoint || !remotePath) {
      showWarn("请填写 WebDAV 地址与存储路径");
      return false;
    }
    return true;
  };

  const handleAdd = async () => {
    const parsed = parseYamlToConfig(yamlInput);
    if (!parsed) {
      showError("YAML 解析失败，请检查格式");
      return;
    }
    if (!requireWebdavReady(storageSettings)) return;
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
    if (!requireWebdavReady(storageSettings)) return;
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
    if (!requireWebdavReady(storageSettings)) return;
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
    if (!requireWebdavReady(storageSettings)) return;
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
    if (kind === "webdav" && storageSettings.webdav) {
      setWebdavDraft(storageSettings.webdav);
    }
    const next: StorageSettings = { ...storageSettings, kind };
    setStorageSettings(next);
    saveStorageSettings(next);
    refreshFromStorage(next);
  };

  const handleWebdavFieldChange = (field: keyof NonNullable<StorageSettings["webdav"]>, value: string) => {
    const nextWebdav: WebdavSettings = {
      ...defaultStorageSettings.webdav,
      ...webdavDraft,
      [field]: value,
    };
    setWebdavDraft(nextWebdav);
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
      webdav: {
        ...webdavDraft,
        endpoint,
        remotePath,
      },
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
        console.log("WebDAV 配置已保存，正在刷新...");
        setStorageSettings(nextSettings);
        console.log("WebDAV 配置已生效，正在刷新...1");
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

  return (
    <div className="min-h-screen bg-[#fdfbf5] text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <NoticeBar notice={notice} />
        <header className="flex items-center justify-between border border-dashed border-[#b7bcc2] bg-white/80 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Settings</p>
            <h1 className="text-xl font-semibold text-slate-900">配置中心</h1>
          </div>
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

        {storageSettings.kind === "webdav" && (
          <section className="border border-dashed border-[#b7bcc2] bg-white/90 p-4 text-sm text-slate-700">
            <div className="mb-3 text-xs uppercase tracking-[0.12em] text-slate-500">WebDAV 设置</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">地址（Base URL 或完整文件 URL）</span>
                <input
                  type="text"
                  className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-2 py-1 text-sm text-slate-800 focus:outline-none"
                  value={webdavDraft.endpoint}
                  onChange={(e) => handleWebdavFieldChange("endpoint", e.target.value)}
                  placeholder="https://dav.example.com/"
                  disabled={loading}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">存储路径（目录）</span>
                <input
                  type="text"
                  className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-2 py-1 text-sm text-slate-800 focus:outline-none"
                  value={webdavDraft.remotePath}
                  onChange={(e) => handleWebdavFieldChange("remotePath", e.target.value)}
                  placeholder="bookmarkhub"
                  disabled={loading}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">用户名</span>
                <input
                  type="text"
                  className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-2 py-1 text-sm text-slate-800 focus:outline-none"
                  value={webdavDraft.username ?? ""}
                  onChange={(e) => handleWebdavFieldChange("username", e.target.value)}
                  placeholder="可选"
                  disabled={loading}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">密码</span>
                <input
                  type="password"
                  className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-2 py-1 text-sm text-slate-800 focus:outline-none"
                  value={webdavDraft.password ?? ""}
                  onChange={(e) => handleWebdavFieldChange("password", e.target.value)}
                  placeholder="可选"
                  disabled={loading}
                />
              </label>
            </div>
            <div className="mt-3 flex w-full flex-wrap items-center justify-end gap-3 text-xs text-slate-500">
              <button
                type="button"
                onClick={handleSaveWebdavConfig}
                className="border border-dashed border-[#b7bcc2] bg-white px-3 py-1 text-sm text-slate-700 hover:bg-[#fdfbf5] disabled:opacity-60"
                disabled={loading}
              >
                保存
              </button>
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 flex flex-col gap-3 border border-dashed border-[#b7bcc2] bg-white/90 p-4">
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
              className="h-[480px] w-full border border-dashed border-[#b7bcc2] bg-[#fdfbf5] p-3 font-mono text-sm text-slate-800 focus:outline-none"
              value={yamlInput}
              onChange={(e) => setYamlInput(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col gap-3 border border-dashed border-[#b7bcc2] bg-white/90 p-4">
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
