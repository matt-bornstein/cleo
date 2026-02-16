"use client";

import { ReactNode } from "react";

interface EditorLayoutProps {
  editor: ReactNode;
  rightPanel: ReactNode;
}

export function EditorLayout({ editor, rightPanel }: EditorLayoutProps) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col border-r">{editor}</div>
      <div className="flex w-1/3 flex-col">{rightPanel}</div>
    </div>
  );
}
