export type Role = "owner" | "editor" | "commenter" | "viewer";

export type ThemeSetting = "light" | "dark" | "system";

export type AppUserSettings = {
  theme?: ThemeSetting;
  defaultModel?: string;
  editorFontSize?: number;
  editorLineSpacing?: number;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  settings?: AppUserSettings;
};

export type AppDocument = {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  lastDiffAt?: number;
  chatClearedAt?: number;
  aiLockedBy?: string;
  aiLockedAt?: number;
};

export type Permission = {
  id: string;
  documentId: string;
  userId: string;
  role: Role;
};

export type DiffSource = "ai" | "manual" | "created";

export type DiffRecord = {
  id: string;
  documentId: string;
  userId: string;
  patch: string;
  snapshotAfter: string;
  source: DiffSource;
  aiPrompt?: string;
  aiModel?: string;
  createdAt: number;
};

export type PresenceRecord = {
  id: string;
  documentId: string;
  visitorId: string;
  userId: string;
  data: unknown;
  updatedAt: number;
};

export type CommentRecord = {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  anchorFrom: number;
  anchorTo: number;
  anchorText: string;
  lastRemapVersion?: number;
  orphaned?: boolean;
  resolved: boolean;
  parentCommentId?: string;
  createdAt: number;
  updatedAt: number;
};

export type AIMessage = {
  id: string;
  documentId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  diffId?: string;
  createdAt: number;
};

