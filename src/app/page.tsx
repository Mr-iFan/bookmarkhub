"use client";

import { useMemo, useState } from "react";
import BookmarkCard from "@/components/BookmarkCard";
import SidebarTree from "@/components/SidebarTree";
import { bookmarks, moduleCategories, modules } from "@/data/bookmarks";
import { Category } from "@/types";

const flattenCategories = (categories: Category[]): Category[] => {
  return categories.reduce<Category[]>((acc, current) => {
    return [
      ...acc,
      current,
      ...(current.children ? flattenCategories(current.children) : []),
    ];
  }, []);
};

export default function Home() {
  const [selectedModule, setSelectedModule] = useState<string>(modules[0].id);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoryTree = useMemo(() => {
    return moduleCategories[selectedModule] ?? [];
  }, [selectedModule]);

  const flatCategories = useMemo(
    () => flattenCategories(categoryTree),
    [categoryTree],
  );

  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((bookmark) => {
      const matchModule = bookmark.moduleId === selectedModule;
      const matchCategory = selectedCategory
        ? bookmark.categoryId === selectedCategory
        : true;
      return matchModule && matchCategory;
    });
  }, [selectedCategory, selectedModule]);

  return (
    <div className="min-h-screen bg-[#fdfbf5] text-slate-900">
      <div className="flex w-full max-w-none flex-col gap-6">
        <section className="border border-dashed border-[#b7bcc2] bg-white/80 p-0">
          <div className="flex flex-wrap gap-0">
            {modules.map((module, index) => {
              const isActive = selectedModule === module.id;
              const isFirst = index === 0;
              const isLast = index === modules.length - 1;
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
                  } ${
                    isFirst ? "ml-4" : ""
                  }`}
                >
                  <div className="font-semibold">{module.name}</div>
                </button>
              );
            })}
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
                    const moduleName = modules.find((m) => m.id === bookmark.moduleId)?.name;
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
