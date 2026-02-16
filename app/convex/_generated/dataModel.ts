export type TableNames =
  | "users"
  | "documents"
  | "presence"
  | "permissions"
  | "diffs"
  | "comments"
  | "aiMessages";

export type Id<TableName extends TableNames> = string & { __tableName: TableName };

export type Doc<TableName extends TableNames> = Record<string, unknown> & {
  _id: Id<TableName>;
};
