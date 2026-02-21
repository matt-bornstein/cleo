"use client";

import { createContext, useContext, useRef, useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";

interface EditorContextType {
  setEditor: (editor: Editor | null) => void;
  getEditorHtml: () => string | null;
  getEditorJson: () => string | null;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
}

const EditorContext = createContext<EditorContextType>({
  setEditor: () => {},
  getEditorHtml: () => null,
  getEditorJson: () => null,
  isSaving: false,
  setIsSaving: () => {},
});

export function EditorContextProvider({ children }: { children: React.ReactNode }) {
  const editorRef = useRef<Editor | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    <EditorContext.Provider value={{ setEditor, getEditorHtml, getEditorJson, isSaving, setIsSaving }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext() {
  return useContext(EditorContext);
}
