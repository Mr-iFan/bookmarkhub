"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addConfigIfChanged, defaultConfigYaml, deleteConfigByVersion, loadActiveConfig, loadStoredConfigs, parseYamlToConfig, resolveActiveFromList } from "@/lib/config";
import { NoticeBar, useNotice } from "@/lib/notice";

export default function SettingsPage() {
  const [yamlInput, setYamlInput] = useState<string>(defaultConfigYaml);
  const [configs, setConfigs] = useState(() => loadStoredConfigs());
  const { activeVersion } = useMemo(() => resolveActiveFromList(configs), [configs]);
  const { notice, showInfo, showWarn, showError } = useNotice();
  const router = useRouter();

  useEffect(() => {
    const { activeYaml: latestYaml } = loadActiveConfig();
    setYamlInput(latestYaml);
    setConfigs(loadStoredConfigs());
  }, []);

  const handleAdd = () => {
    const parsed = parseYamlToConfig(yamlInput);
    if (!parsed) {
      showError("YAML 解析失败，请检查格式");
      return;
    }
    const result = addConfigIfChanged(yamlInput);
    if (result.added && result.newVersion) {
      setConfigs(result.stored);
      showInfo(`已添加版本 ${result.newVersion}`);
    } else {
      showWarn("内容与当前配置相同，无需添加");
    }
  };

  const handleDelete = (version: string) => {
    const { activeVersion: nextActive } = deleteConfigByVersion(version);
    setConfigs(loadStoredConfigs());
    showInfo(`已删除 ${version}，当前版本：${nextActive}`);
  };

  const handleUseDefault = () => {
    setYamlInput(defaultConfigYaml);
    setConfigs([]);
    localStorage.removeItem("bookmarkhub-yaml-configs");
    showInfo("已切换到默认配置");
  };

  const handleApply = () => {
    const parsed = parseYamlToConfig(yamlInput);
    if (!parsed) {
      showError("YAML 解析失败，请检查格式");
      return;
    }
    const result = addConfigIfChanged(yamlInput);
    if (result.added) {
      setConfigs(result.stored);
      showInfo(`已保存并生效：${result.newVersion}`);
    } else {
      showWarn("内容与当前配置相同，无需保存");
    }
  };

  const sortedConfigs = useMemo(() => {
    return [...configs].sort((a, b) => Number(b.version.replace(/\.yaml$/, "")) - Number(a.version.replace(/\.yaml$/, "")));
  }, [configs]);

  return (
    <div className="min-h-screen bg-[#fdfbf5] text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <NoticeBar notice={notice} />
        <header className="flex items-center justify-between border border-dashed border-[#b7bcc2] bg-white/80 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Settings</p>
            <h1 className="text-xl font-semibold text-slate-900">配置中心</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-3 py-1">当前版本：{activeVersion}</span>
            <button
              type="button"
              onClick={handleUseDefault}
              className="border border-dashed border-[#b7bcc2] bg-white px-3 py-1 text-sm text-slate-700 hover:bg-[#fdfbf5]"
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

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 flex flex-col gap-3 border border-dashed border-[#b7bcc2] bg-white/90 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">编辑 YAML</h2>
              <div className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={handleApply}
                  className="border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-3 py-1 text-slate-700 hover:bg-white"
                >
                  保存并应用
                </button>
                <button
                  type="button"
                  onClick={handleAdd}
                  className="border border-dashed border-[#b7bcc2] bg-white px-3 py-1 text-slate-700 hover:bg-[#fdfbf5]"
                >
                  添加为新版本
                </button>
              </div>
            </div>
            <textarea
              className="h-[480px] w-full border border-dashed border-[#b7bcc2] bg-[#fdfbf5] p-3 font-mono text-sm text-slate-800 focus:outline-none"
              value={yamlInput}
              onChange={(e) => setYamlInput(e.target.value)}
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
                        >
                          查看
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(config.version)}
                          className="border border-dashed border-[#b7bcc2] bg-white px-2 py-1 text-xs text-red-600 hover:bg-[#fdfbf5]"
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
