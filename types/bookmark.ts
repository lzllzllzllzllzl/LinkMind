export interface ProcessResult {
  title: string;
  summary: string;
  outline: string[];
  tags: string[];
  content: string;
  url: string;
}

export interface SaveBookmarkInput {
  user_id?: string | null;
  title: string;
  url: string;
  content: string;
  summary: string;
  outline: string[];
  tags: string[];
}

export interface BookmarkRecord {
  id: string;
  user_id: string | null;
  title: string;
  url: string;
  content: string;
  summary: string;
  outline: string[];
  tags: string[];
  created_at: string;
}

/**
 * 列表场景使用的精简记录（不含正文 content）。
 * 正文可能长达数十 KB，列表接口不返回它以保证知识库页加载速度；
 * 详情页/追问仍通过 getBookmarkById 获取完整记录。
 */
export type BookmarkListItem = Omit<BookmarkRecord, "content">;