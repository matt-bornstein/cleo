"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { Authenticated, Unauthenticated, AuthLoading, useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/components/layout/Toolbar";
import { EditorPanel } from "@/components/editor/EditorPanel";
import { AIPanel } from "@/components/ai/AIPanel";
import { CommentsSidebar } from "@/components/comments/CommentsSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  EditorContextProvider,
  useEditorContext,
} from "@/components/editor/EditorContext";
import { Input } from "@/components/ui/input";

function RedirectToSignIn() {
  const router = useRouter();
  useEffect(() => { router.push("/sign-in"); }, [router]);
  return null;
}

function AuthenticatedEditorPage({ documentId }: { documentId: Id<"documents"> }) {
  const document = useQuery(api.documents.get, { id: documentId });

  if (document === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (document === null) {
    return (
      <div className="flex min-h-screen flex-col">
        <Toolbar />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">
            Document not found or you don&apos;t have access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <EditorContextProvider>
      <EditorPageContent
        document={document}
        documentId={documentId}
      />
    </EditorContextProvider>
  );
}

export default function EditorPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = use(params);

  return (
    <>
      <AuthLoading>
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
      <Authenticated>
        <AuthenticatedEditorPage documentId={documentId as Id<"documents">} />
      </Authenticated>
    </>
  );
}

function EditorPageContent({
  document,
  documentId,
}: {
  document: {
    _id: Id<"documents">;
    title: string;
    titleSet?: boolean;
    content: string;
    myRole: string;
  };
  documentId: Id<"documents">;
}) {
  useEffect(() => {
    const title = document.title || "Untitled";
    const truncated = title.length > 40 ? title.substring(0, 40) + "…" : title;
    window.document.title = truncated;
  }, [document.title]);

  const [showComments, setShowComments] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [mobilePanelPercent, setMobilePanelPercent] = useState(48);
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== "undefined" ? Math.round(window.innerWidth / 4) : 400
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(document.title || "");
  const { getEditorHtml, getEditorJson, isSaving } = useEditorContext();
  const updateTitle = useMutation(api.documents.updateTitle);

  // Drag resize logic
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    window.document.body.style.cursor = "col-resize";
    window.document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      setPanelWidth(Math.max(280, Math.min(newWidth, containerRect.width * 0.6)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.document.body.style.cursor = "";
      window.document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, []);

  const handleMobileResizeStart = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (window.matchMedia("(min-width: 1024px)").matches) return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      window.document.body.style.cursor = "row-resize";
      window.document.body.style.userSelect = "none";

      const handlePointerMove = (event: PointerEvent) => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();
        const newHeight = containerRect.bottom - event.clientY;
        const nextPercent = (newHeight / containerRect.height) * 100;
        setMobilePanelPercent(Math.max(38, Math.min(nextPercent, 70)));
      };

      const handlePointerUp = () => {
        window.document.body.style.cursor = "";
        window.document.body.style.userSelect = "";
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
    },
    []
  );

  const handleMobileResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (window.matchMedia("(min-width: 1024px)").matches) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;

      e.preventDefault();
      const delta = e.key === "ArrowUp" ? 5 : -5;
      setMobilePanelPercent((current) =>
        Math.max(38, Math.min(current + delta, 70))
      );
    },
    []
  );

  const handleTitleSave = async () => {
    if (editTitle.trim()) {
      await updateTitle({ id: document._id, title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Toolbar
        documentId={document._id}
        documentTitle={document.title}
        documentContent={document.content}
        onToggleComments={() => setShowComments(!showComments)}
        showComments={showComments}
        onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
        showRightPanel={showRightPanel}
        getEditorHtml={getEditorHtml}
      />
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row"
      >
        {/* Editor panel — top pane on mobile, fills remaining width on desktop */}
        <div
          className={`flex min-h-0 min-w-0 flex-col lg:basis-auto lg:flex-1 ${
            showRightPanel
              ? "basis-[var(--mobile-editor-height)]"
              : "flex-1"
          }`}
          style={{
            "--mobile-editor-height": `${100 - mobilePanelPercent}%`,
          } as React.CSSProperties}
        >
          <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 sm:h-11 sm:px-4">
            <div className="flex-1 min-w-0 mr-4">
              {isEditingTitle ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  className="h-8 w-full text-lg font-semibold"
                  autoFocus
                />
              ) : (
                <button
                  className="block max-w-full truncate text-left text-base font-semibold text-foreground hover:text-muted-foreground sm:text-lg"
                  onClick={() => {
                    let title = document.title || "";
                    // Auto-populate from first line if title hasn't been set yet
                    if (!document.titleSet) {
                      try {
                        const json = getEditorJson();
                        if (json) {
                          const doc = JSON.parse(json);
                          const firstNode = doc.content?.[0];
                          if (firstNode) {
                            const extractText = (node: any): string => {
                              if (node.text) return node.text;
                              return (node.content || []).map(extractText).join("");
                            };
                            const firstLine = extractText(firstNode).trim();
                            if (firstLine) {
                              title = firstLine.substring(0, 180);
                            }
                          }
                        }
                      } catch {
                        // Ignore — keep existing title
                      }
                    }
                    setEditTitle(title);
                    setIsEditingTitle(true);
                  }}
                >
                  {document.title || "Untitled"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {isSaving ? "Saving..." : "Saved"}
              </span>
            </div>
          </div>
          <EditorPanel
            documentId={document._id}
            initialContent={document.content}
          />
        </div>

        {/* AI panel — bottom pane on mobile, resizable side pane on desktop */}
        {showRightPanel && (
          <>
            {/* Desktop drag handle */}
            <div
              className="hidden w-1.5 cursor-col-resize items-center justify-center border-x bg-muted/30 transition-colors hover:bg-muted lg:flex"
              onMouseDown={handleMouseDown}
            >
              <div className="h-8 w-0.5 rounded-full bg-muted-foreground/30" />
            </div>
            <div
              className="flex min-h-0 min-w-0 basis-[var(--mobile-panel-height)] flex-col border-t lg:w-[var(--desktop-panel-width)] lg:min-w-[280px] lg:shrink-0 lg:basis-auto lg:border-t-0"
              style={{
                "--desktop-panel-width": `${panelWidth}px`,
                "--mobile-panel-height": `${mobilePanelPercent}%`,
              } as React.CSSProperties}
            >
              {showComments ? (
                <div className="flex h-full min-h-0 flex-col">
                  <ScrollArea className="h-1/2 border-b">
                    <CommentsSidebar documentId={document._id} />
                  </ScrollArea>
                  <div className="h-1/2">
                    <AIPanel
                      documentId={document._id}
                      onHide={() => setShowRightPanel(false)}
                      mobileResizeHandle={{
                        onPointerDown: handleMobileResizeStart,
                        onKeyDown: handleMobileResizeKeyDown,
                        valueNow: mobilePanelPercent,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <AIPanel
                  documentId={document._id}
                  onHide={() => setShowRightPanel(false)}
                  mobileResizeHandle={{
                    onPointerDown: handleMobileResizeStart,
                    onKeyDown: handleMobileResizeKeyDown,
                    valueNow: mobilePanelPercent,
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
