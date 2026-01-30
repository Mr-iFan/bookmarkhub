"use client";

import { useState } from "react";
import { Category } from "@/types";

type SidebarTreeProps = {
  categories: Category[];
  selectedCategoryId?: string | null;
  onSelect: (categoryId: string | null) => void;
};

export default function SidebarTree({
  categories,
  selectedCategoryId,
  onSelect,
}: SidebarTreeProps) {
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setOpenState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      {categories.map((root) => {
        const isOpen = openState[root.id] ?? true;

        return (
          <div
            key={root.id}
            className="border-x border-t border-dashed border-[#b7bcc2] bg-[#fdfbf5] last:border-b"
          >
            <button
              type="button"
              onClick={() => toggle(root.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between bg-white px-3 py-2 text-left text-sm font-semibold text-slate-800"
            >
              <span className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full border border-slate-400" />
                {root.name}
              </span>
              <span className="text-xs text-slate-500">{isOpen ? "−" : "+"}</span>
            </button>

            {isOpen && (
              <div className="px-3 py-2">
                {root.children?.map((child) => {
                  const isActive = selectedCategoryId === child.id;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onSelect(child.id)}
                      className={`flex w-full items-center justify-between border-x border-t border-dashed px-3 py-2 text-left text-sm transition-colors last:border-b ${
                        isActive
                          ? "border-[#8d939b] bg-white text-slate-900"
                          : "border-[#b7bcc2] bg-[#fdfbf5] text-slate-700 hover:bg-white"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-px w-4 bg-slate-300" aria-hidden />
                        {child.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
