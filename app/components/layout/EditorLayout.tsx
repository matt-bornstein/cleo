import type { ReactNode } from "react";

type EditorLayoutProps = {
  editorPanel: ReactNode;
  aiPanel: ReactNode;
};

export function EditorLayout({ editorPanel, aiPanel }: EditorLayoutProps) {
  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-3">
      <section className="border-b border-slate-200 bg-white lg:col-span-2 lg:border-b-0 lg:border-r">
        {editorPanel}
      </section>
      <aside className="bg-slate-50 lg:col-span-1">{aiPanel}</aside>
    </div>
  );
}
