export type Module = {
  id: string;
  name: string;
  description?: string;
};

export type Category = {
  id: string;
  name: string;
  moduleId: string;
  parentId?: string;
  children?: Category[];
};

export type AppConfig = {
  modules: Module[];
  categories: Category[];
  bookmarks: Bookmark[];
};

export type Bookmark = {
  id: string;
  name: string;
  url: string;
  description: string;
  moduleId: string;
  categoryId: string;
};
