"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import BookmarkCard from "@/components/BookmarkCard";
import SidebarTree from "@/components/SidebarTree";
import { createStorage, defaultConfig, loadStorageSettings } from "@/lib/config";
import { AppConfig, Category } from "@/types";

const buildCategoryTree = (categories: Category[], parentId?: string): Category[] => {
  return categories
    .filter((item) => item.parentId === parentId)
    .map((item) => ({ ...item, children: buildCategoryTree(categories, item.id) }));
};

export default function Home() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const settings = loadStorageSettings();
    const storage = createStorage(settings);

    storage
      .loadActiveConfig()
      .then(({ activeConfig }) => {
        if (cancelled) return;
        setConfig(activeConfig);
        if (activeConfig.modules.length > 0) {
          setSelectedModule(activeConfig.modules[0].id);
        }
      })
      .catch((error) => {
        console.error(error);
        if (cancelled) return;
        setConfig(defaultConfig);
        if (defaultConfig.modules.length > 0) {
          setSelectedModule(defaultConfig.modules[0].id);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryTree = useMemo(() => {
    if (!config) return [];
    const moduleCategories = config.categories.filter((item) => item.moduleId === selectedModule);
    return buildCategoryTree(moduleCategories);
  }, [config, selectedModule]);

  const categoryNameMap = useMemo(() => {
    if (!config) return new Map<string, string>();
    return new Map(config.categories.map((category) => [category.id, category.name]));
  }, [config]);

  const moduleNameMap = useMemo(() => {
    if (!config) return new Map<string, string>();
    return new Map(config.modules.map((module) => [module.id, module.name]));
  }, [config]);

  const moduleCategories = useMemo(() => {
    if (!config) return [] as Category[];
    return config.categories.filter((item) => item.moduleId === selectedModule);
  }, [config, selectedModule]);

  const parentMap = useMemo(() => {
    const map = new Map<string, string | undefined>();
    moduleCategories.forEach((item) => {
      map.set(item.id, item.parentId);
    });
    return map;
  }, [moduleCategories]);

  const getCategoryLineage = (categoryId: string) => {
    const lineage: string[] = [];
    let current: string | undefined = categoryId;
    while (current) {
      lineage.push(current);
      current = parentMap.get(current);
    }
    return lineage;
  };

  const moduleBookmarks = useMemo(() => {
    if (!config) return [];
    return config.bookmarks.filter((bookmark) => bookmark.moduleId === selectedModule);
  }, [config, selectedModule]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const isSearching = normalizedSearch.length > 0;

  const filteredBookmarks = useMemo(() => {
    if (isSearching) {
      return moduleBookmarks.filter((bookmark) => {
        const haystack = `${bookmark.title ?? ""} ${bookmark.url ?? ""} ${bookmark.description ?? ""}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    return moduleBookmarks;
  }, [isSearching, moduleBookmarks, normalizedSearch]);

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    if (!categoryId) return;

    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(categoryId) : categoryId.replace(/["\\]/g, "\\$&");
    const container = contentRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-category-match~="${escaped}"]`);

    if (container && target) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offset = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top: offset, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfbf5] text-slate-900">
      <div className="flex w-full max-w-none flex-col gap-6 min-h-screen">
        <section className="border border-dashed border-[#b7bcc2] bg-white/80 p-0">
          <div className="flex w-full flex-col items-stretch gap-2 px-0 py-0 md:flex-row md:items-center md:gap-0 md:px-0">
            <div className="order-1 flex flex-wrap items-center md:flex-nowrap">
              {config?.modules.map((module, index) => {
                const isActive = selectedModule === module.id;
                const isLast = index === (config?.modules.length ?? 0) - 1;

                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => {
                      setSelectedModule(module.id);
                      setSelectedCategory(null);
                    }}
                    className={`border-l border-dashed border-[#b7bcc2] px-4 py-2 text-sm text-left transition-colors ${
                      isLast ? "border-r" : "border-r-0"
                    } ${
                      isActive
                        ? "bg-[#fdfbf5] text-slate-900"
                        : "bg-white text-slate-700 hover:bg-[#fdfbf5]"
                    }`}
                  >
                    <div className="font-semibold">{module.name}</div>
                  </button>
                );
              })}
            </div>

            <div className="order-2 flex w-full flex-1 justify-center md:px-6">
              <div className="w-full max-w-[520px] md:max-w-[560px]">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="搜索名称、链接或描述"
                  className="w-full border-0 border-l border-r border-dashed border-[#b7bcc2] bg-white/90 px-4 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-[#f0e8d8]"
                />
              </div>
            </div>

            <Link
              href="/settings"
              className="order-3 ml-auto flex flex-none items-center gap-2 self-end border-l border-dashed border-[#b7bcc2] bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-[#fdfbf5] shrink-0"
            >
              <span>设置</span>
            </Link>
          </div>
        </section>

        <div className="grid flex-1 auto-rows-fr items-stretch gap-6 lg:grid-cols-12">
          <div className="lg:col-span-2 xl:col-span-2 flex h-wrap flex-col overflow-hidden ml-2 mb-4">
            <SidebarTree
              categories={categoryTree}
              selectedCategoryId={selectedCategory}
              onSelect={handleCategorySelect}
            />

          </div>
          <main className="col-span-10 flex h-wrap flex-col overflow-hidden border border-dashed border-[#b7bcc2] bg-white/90 mr-2 mb-4">
            <div
              ref={contentRef}
              className="flex h-full flex-col gap-4 overflow-y-auto bg-white/90 p-3"
            >
              {filteredBookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-6 py-10 text-center text-slate-600">
                  <p className="text-sm font-medium text-slate-800">
                    {isSearching ? "未找到匹配书签" : "暂无书签"}
                  </p>
                  <p className="text-sm">
                    {isSearching ? "换个关键词试试" : "尝试切换模块或分类看看"}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  {filteredBookmarks.map((bookmark) => {
                    const categoryName = categoryNameMap.get(bookmark.categoryId);
                    const moduleName = moduleNameMap.get(bookmark.moduleId);
                    const categoryLineage = getCategoryLineage(bookmark.categoryId);
                    return (
                      <div key={bookmark.id} data-category-match={categoryLineage.join(" ")}>
                        <BookmarkCard
                          bookmark={bookmark}
                          moduleName={moduleName}
                          categoryName={categoryName}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
