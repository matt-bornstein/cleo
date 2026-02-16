"use client";

import { ReactNode } from "react";

interface EditorLayoutProps {
  editor: ReactNode;
  aiPanel: ReactNode;
}

export function EditorLayout({ editor, aiPanel }: EditorLayoutProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-2/3 flex-col border-r">{editor}</div>
      <div className="flex w-1/3 flex-col">{aiPanel}</div>
    </div>
  );
}
