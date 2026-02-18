"use client";

import { useState } from "react";
import { isValidElement } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type EditorLayoutProps = {
  editorPanel: unknown;
  aiPanel: unknown;
};

export function EditorLayout({ editorPanel, aiPanel }: EditorLayoutProps) {
  const normalizedEditorPanel = toRenderableNode(editorPanel);
  const normalizedAiPanel = toRenderableNode(aiPanel);
  const [mobileAiOpen, setMobileAiOpen] = useState(false);

  return (
    <div className="relative grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-3">
      <section className="min-h-0 overflow-hidden border-b border-slate-200 bg-white lg:col-span-2 lg:border-b-0 lg:border-r">
        {normalizedEditorPanel}
      </section>
      <aside
        className={`min-h-0 overflow-hidden bg-slate-50 ${
          mobileAiOpen ? "block" : "hidden"
        } absolute inset-0 z-20 lg:static lg:col-span-1 lg:block`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-end border-b border-slate-200 p-2 lg:hidden">
            <Button variant="secondary" size="sm" onClick={() => setMobileAiOpen(false)}>
              Close AI
            </Button>
          </div>
          <div className="min-h-0 flex-1">{normalizedAiPanel}</div>
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

function toRenderableNode(value: unknown): ReactNode {
  if (value === null || value === undefined || typeof value === "boolean") {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (isValidElement(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => (
      <span key={`layout-node-${index}`}>{toRenderableNode(item)}</span>
    ));
  }

  return null;
}
