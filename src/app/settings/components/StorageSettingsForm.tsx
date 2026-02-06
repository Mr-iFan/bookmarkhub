"use client";

import { GithubSettings, StorageSettings, WebdavSettings } from "@/lib/config";

type StorageSettingsFormProps = {
  storageSettings: StorageSettings;
  webdavDraft: WebdavSettings;
  githubDraft: GithubSettings;
  loading: boolean;
  onWebdavFieldChange: (
    field: keyof NonNullable<StorageSettings["webdav"]>,
    value: string,
  ) => void;
  onGithubFieldChange: (
    field: keyof NonNullable<StorageSettings["github"]>,
    value: string,
  ) => void;
  onSaveWebdavConfig: () => void;
  onSaveGithubConfig: () => void;
};

export function StorageSettingsForm({
  storageSettings,
  webdavDraft,
  githubDraft,
  loading,
  onWebdavFieldChange,
  onGithubFieldChange,
  onSaveWebdavConfig,
  onSaveGithubConfig,
}: StorageSettingsFormProps) {
  return (
    <>
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
                onChange={(e) => onWebdavFieldChange("endpoint", e.target.value)}
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
                onChange={(e) => onWebdavFieldChange("remotePath", e.target.value)}
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
                onChange={(e) => onWebdavFieldChange("username", e.target.value)}
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
                onChange={(e) => onWebdavFieldChange("password", e.target.value)}
                placeholder="可选"
                disabled={loading}
              />
            </label>
          </div>
          <div className="mt-3 flex w-full flex-wrap items-center justify-end gap-3 text-xs text-slate-500">
            <button
              type="button"
              onClick={onSaveWebdavConfig}
              className="border border-dashed border-[#b7bcc2] bg-white px-3 py-1 text-sm text-slate-700 hover:bg-[#fdfbf5] disabled:opacity-60"
              disabled={loading}
            >
              保存
            </button>
          </div>
        </section>
      )}

      {storageSettings.kind === "github" && (
        <section className="border border-dashed border-[#b7bcc2] bg-white/90 p-4 text-sm text-slate-700">
          <div className="mb-3 text-xs uppercase tracking-[0.12em] text-slate-500">GitHub 设置</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Owner</span>
              <input
                type="text"
                className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-2 py-1 text-sm text-slate-800 focus:outline-none"
                value={githubDraft.owner}
                onChange={(e) => onGithubFieldChange("owner", e.target.value)}
                placeholder="your-name"
                disabled={loading}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Repo</span>
              <input
                type="text"
                className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-2 py-1 text-sm text-slate-800 focus:outline-none"
                value={githubDraft.repo}
                onChange={(e) => onGithubFieldChange("repo", e.target.value)}
                placeholder="bookmarkhub-configs"
                disabled={loading}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">分支</span>
              <input
                type="text"
                className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-2 py-1 text-sm text-slate-800 focus:outline-none"
                value={githubDraft.branch}
                onChange={(e) => onGithubFieldChange("branch", e.target.value)}
                placeholder="main"
                disabled={loading}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">存储目录（仓库内路径）</span>
              <input
                type="text"
                className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-2 py-1 text-sm text-slate-800 focus:outline-none"
                value={githubDraft.remotePath}
                onChange={(e) => onGithubFieldChange("remotePath", e.target.value)}
                placeholder="bookmarkhub"
                disabled={loading}
              />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs text-slate-500">Token（仅保存在本地浏览器，用于写入仓库）</span>
              <input
                type="password"
                className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-2 py-1 text-sm text-slate-800 focus:outline-none"
                value={githubDraft.token}
                onChange={(e) => onGithubFieldChange("token", e.target.value)}
                placeholder="ghp_xxx（需要 repo 权限）"
                disabled={loading}
              />
            </label>
          </div>
          <div className="mt-3 flex w-full flex-wrap items-center justify-end gap-3 text-xs text-slate-500">
            <button
              type="button"
              onClick={onSaveGithubConfig}
              className="border border-dashed border-[#b7bcc2] bg-white px-3 py-1 text-sm text-slate-700 hover:bg-[#fdfbf5] disabled:opacity-60"
              disabled={loading}
            >
              保存
            </button>
          </div>
        </section>
      )}
    </>
  );
}
