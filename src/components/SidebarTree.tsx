"use client";

import { useState } from "react";
import { Category } from "@/types";

type SidebarTreeProps = {
  categories: Category[];
  selectedCategoryId?: string | null;
  onSelect: (categoryId: string | null) => void;
};

export default function SidebarTree({ categories, selectedCategoryId, onSelect }: SidebarTreeProps) {
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setOpenState((prev) => {
      const current = prev[id] ?? true;
      return { ...prev, [id]: !current };
    });
  };

  const renderNode = (node: Category, depth: number, isLast: boolean) => {
    const isOpen = openState[node.id] ?? true;
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isActive = selectedCategoryId === node.id;

    const wrapperClasses = depth === 0
      ? "border-x border-t border-dashed border-[#b7bcc2] bg-[#fdfbf5] last:border-b"
      : "border-t border-dashed border-[#b7bcc2] bg-[#fdfbf5] last:border-b";

    return (
      <div key={node.id} className={wrapperClasses}>
        <button
          type="button"
          onClick={() => {
            onSelect(node.id);
          }}
          aria-expanded={hasChildren ? isOpen : undefined}
          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
            isActive ? "bg-white font-semibold text-slate-900" : "bg-white text-slate-800"
          }`}
          style={{ paddingLeft: 12 + depth * 12 }}
        >
          <span className="flex items-center gap-2">
            {hasChildren ? (
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded border border-dashed border-slate-400 text-[10px] text-slate-600"
                onClick={(event) => {
                  event.stopPropagation();
                  toggle(node.id);
                }}
                role="button"
                aria-label={isOpen ? "折叠" : "展开"}
              >
                {isOpen ? "−" : "+"}
              </span>
            ) : (
              <span className="inline-block h-2 w-2 rounded-full border border-slate-400" />
            )}
            {node.name}
          </span>
        </button>

        {hasChildren && isOpen && (
          <div className={isLast ? undefined : "pb-1"}>
            {node.children?.map((child, idx, arr) => renderNode(child, depth + 1, idx === arr.length - 1))}
          </div>
        )}
      </div>
    );
  };

  return <div>{categories.map((root, idx, arr) => renderNode(root, 0, idx === arr.length - 1))}</div>;
}
