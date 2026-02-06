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
    setOpenState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderNode = (node: Category, depth: number) => {
    const isOpen = openState[node.id] ?? true;
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isActive = selectedCategoryId === node.id;

    return (
      <div key={node.id} className="border-x border-t border-dashed border-[#b7bcc2] bg-[#fdfbf5] last:border-b">
        <button
          type="button"
          onClick={() => {
            if (hasChildren) toggle(node.id);
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
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-400 text-[10px] text-slate-600">
                {isOpen ? "−" : "+"}
              </span>
            ) : (
              <span className="inline-block h-2 w-2 rounded-full border border-slate-400" />
            )}
            {node.name}
          </span>
        </button>

        {hasChildren && isOpen && (
          <div className="pb-1">
            {node.children?.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return <div>{categories.map((root) => renderNode(root, 0))}</div>;
}
