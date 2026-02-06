"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BookmarkCard from "@/components/BookmarkCard";
import SidebarTree from "@/components/SidebarTree";
import { loadActiveConfig } from "@/lib/config";
import { AppConfig, Category } from "@/types";

const buildCategoryTree = (categories: Category[], parentId?: string): Category[] => {
  return categories
    .filter((item) => item.parentId === parentId)
    .map((item) => ({ ...item, children: buildCategoryTree(categories, item.id) }));
};

const flattenCategories = (categories: Category[]): Category[] => {
  return categories.reduce<Category[]>((acc, current) => {
    return [...acc, current, ...(current.children ? flattenCategories(current.children) : [])];
  }, []);
};

export default function Home() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const { activeConfig } = loadActiveConfig();
    setConfig(activeConfig);
    if (activeConfig.modules.length > 0) {
      setSelectedModule(activeConfig.modules[0].id);
    }
  }, []);

  const categoryTree = useMemo(() => {
    if (!config) return [];
    const moduleCategories = config.categories.filter((item) => item.moduleId === selectedModule);
    return buildCategoryTree(moduleCategories);
  }, [config, selectedModule]);

  const flatCategories = useMemo(
    () => flattenCategories(categoryTree),
    [categoryTree],
  );

  const selectedCategorySet = useMemo(() => {
    if (!selectedCategory) return null;

    const collectIds = (nodes: Category[]): string[] => {
      return nodes.flatMap((node) => [node.id, ...(node.children ? collectIds(node.children) : [])]);
    };

    const stack: Category[] = [...categoryTree];
    let target: Category | undefined;
    while (stack.length) {
      const current = stack.pop();
      if (!current) break;
      if (current.id === selectedCategory) {
        target = current;
        break;
      }
      if (current.children) {
        stack.push(...current.children);
      }
    }

    if (!target) return null;
    return new Set<string>(collectIds([target]));
  }, [categoryTree, selectedCategory]);

  const filteredBookmarks = useMemo(() => {
    if (!config) return [];
    return config.bookmarks.filter((bookmark) => {
      const matchModule = bookmark.moduleId === selectedModule;
      const matchCategory = selectedCategorySet
        ? selectedCategorySet.has(bookmark.categoryId)
        : true;
      return matchModule && matchCategory;
    });
  }, [config, selectedCategorySet, selectedModule]);

  return (
    <div className="min-h-screen bg-[#fdfbf5] text-slate-900">
      <div className="flex w-full max-w-none flex-col gap-6">
        <section className="border border-dashed border-[#b7bcc2] bg-white/80 p-0">
          <div className="flex flex-wrap items-center justify-between">
            <div className="flex flex-wrap items-center gap-0">
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
            <Link
              href="/settings"
              className="flex items-center gap-2 border-l border-dashed border-[#b7bcc2] bg-white px-4 py-2 text-sm text-slate-700 shadow-sm hover:bg-[#fdfbf5] shrink-0"
            >
              <span>设置</span>
            </Link>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="h-screen lg:col-span-2 xl:col-span-2">
            <SidebarTree
              categories={categoryTree}
              selectedCategoryId={selectedCategory}
              onSelect={(id) => setSelectedCategory(id)}
            />

          </div>
          <main className="lg:col-span-10 xl:col-span-10">
            <div className="flex h-full flex-col gap-4 border border-dashed border-[#b7bcc2] bg-white/90 p-5">
              {filteredBookmarks.length === 0 ? (
                <div className="flex flex-col items-center justify-center border border-dashed border-[#b7bcc2] bg-[#fdfbf5] px-6 py-10 text-center text-slate-600">
                  <p className="text-sm font-medium text-slate-800">暂无书签</p>
                  <p className="text-sm">尝试切换模块或分类看看</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  {filteredBookmarks.map((bookmark) => {
                    const categoryName = flatCategories.find(
                      (c) => c.id === bookmark.categoryId,
                    )?.name;
                    const moduleName = config?.modules.find((m) => m.id === bookmark.moduleId)?.name;
                    return (

                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        moduleName={moduleName}
                        categoryName={categoryName}
                      />
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
