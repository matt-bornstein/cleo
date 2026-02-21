"use client";

import { createContext, useContext, useRef, useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";

interface EditorContextType {
  setEditor: (editor: Editor | null) => void;
  getEditorHtml: () => string | null;
  getEditorJson: () => string | null;
  refreshDecorations: () => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  diffCount: number;
  setDiffCount: (count: number) => void;
}

const EditorContext = createContext<EditorContextType>({
  setEditor: () => {},
  getEditorHtml: () => null,
  getEditorJson: () => null,
  refreshDecorations: () => {},
  isSaving: false,
  setIsSaving: () => {},
  diffCount: 0,
  setDiffCount: () => {},
});

export function EditorContextProvider({ children }: { children: React.ReactNode }) {
  const editorRef = useRef<Editor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [diffCount, setDiffCount] = useState(0);

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

  const refreshDecorations = useCallback(() => {
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed) {
      const tr = editor.state.tr.setMeta("decorationRefresh", true);
      editor.view.dispatch(tr);
    }
  }, []);

  return (
    <EditorContext.Provider value={{ setEditor, getEditorHtml, getEditorJson, refreshDecorations, isSaving, setIsSaving, diffCount, setDiffCount }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext() {
  return useContext(EditorContext);
}
