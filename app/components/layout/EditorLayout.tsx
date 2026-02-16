"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type EditorLayoutProps = {
  editorPanel: ReactNode;
  aiPanel: ReactNode;
};

export function EditorLayout({ editorPanel, aiPanel }: EditorLayoutProps) {
  const [mobileAiOpen, setMobileAiOpen] = useState(false);

  return (
    <div className="relative grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-3">
      <section className="border-b border-slate-200 bg-white lg:col-span-2 lg:border-b-0 lg:border-r">
        {editorPanel}
      </section>
      <aside
        className={`bg-slate-50 ${
          mobileAiOpen ? "block" : "hidden"
        } absolute inset-0 z-20 lg:static lg:col-span-1 lg:block`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end border-b border-slate-200 p-2 lg:hidden">
            <Button variant="secondary" size="sm" onClick={() => setMobileAiOpen(false)}>
              Close AI
            </Button>
          </div>
          <div className="min-h-0 flex-1">{aiPanel}</div>
        </div>
      </aside>
      <div className="pointer-events-none absolute bottom-4 right-4 z-10 lg:hidden">
        <Button
          className="pointer-events-auto"
          size="sm"
          onClick={() => setMobileAiOpen(true)}
        >
          Open AI
        </Button>
      </div>
    </div>
  );
}
