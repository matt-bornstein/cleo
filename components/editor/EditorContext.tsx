"use client";

import { createContext, useContext, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";

interface EditorContextType {
  setEditor: (editor: Editor | null) => void;
  getEditorHtml: () => string | null;
  getEditorJson: () => string | null;
}

const EditorContext = createContext<EditorContextType>({
  setEditor: () => {},
  getEditorHtml: () => null,
  getEditorJson: () => null,
});

export function EditorContextProvider({ children }: { children: React.ReactNode }) {
  const editorRef = useRef<Editor | null>(null);

  const setEditor = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);

  const getEditorHtml = useCallback(() => {
    if (!editorRef.current || editorRef.current.isDestroyed) return null;
    return editorRef.current.getHTML();
  }, []);

  const getEditorJson = useCallback(() => {
    if (!editorRef.current || editorRef.current.isDestroyed) return null;
    return JSON.stringify(editorRef.current.getJSON());
  }, []);

  return (
    <EditorContext.Provider value={{ setEditor, getEditorHtml, getEditorJson }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext() {
  return useContext(EditorContext);
}
