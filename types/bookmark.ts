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