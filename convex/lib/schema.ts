/**
 * Server-side ProseMirror schema for use in Convex actions.
 * Uses getSchema from @tiptap/core with the same extensions as the client editor.
 * None of these extensions require DOM — they only define schema specs.
 */
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";

// Same extensions as the client, minus any that require DOM (like Placeholder)
const serverExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Table.configure({ resizable: false }), // No DOM resize handles on server
  TableRow,
  TableCell,
  TableHeader,
  TaskList,
  TaskItem.configure({ nested: true }),
  Image.configure({ inline: false, allowBase64: true }),
];

let _schema: ReturnType<typeof getSchema> | null = null;

/**
 * Get the ProseMirror schema. Lazily initialized and cached.
 */
export function getServerSchema() {
  if (!_schema) {
    _schema = getSchema(serverExtensions);
  }
  return _schema;
}
