import { Bookmark } from "@/types";

type BookmarkCardProps = {
  bookmark: Bookmark;
  moduleName?: string;
  categoryName?: string;
};

export default function BookmarkCard({ bookmark, moduleName, categoryName }: BookmarkCardProps) {
  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full flex-col gap-3 border border-dashed border-[#b7bcc2] bg-[#fdfbf5] p-4 transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{moduleName ?? "模块"}</p>
          <h3 className="text-lg font-semibold text-slate-900">{bookmark.name}</h3>
        </div>
        {categoryName && (
          <span className="border border-dashed border-[#b7bcc2] bg-white px-3 py-1 text-xs text-slate-600">
            {categoryName}
          </span>
        )}
      </div>

      <p className="text-sm leading-6 text-slate-600">{bookmark.description}</p>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-slate-400">{bookmark.url}</span>
      </div>
    </a>
  );
}
