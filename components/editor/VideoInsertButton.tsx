"use client";

import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Video, Upload, Link, Loader2 } from "lucide-react";

interface VideoInsertButtonProps {
  editor: Editor;
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(url);
}

function isVimeoUrl(url: string): boolean {
  return /vimeo\.com\/\d+/.test(url);
}

function vimeoToEmbed(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? `https://player.vimeo.com/video/${match[1]}` : null;
}

export function VideoInsertButton({ editor }: VideoInsertButtonProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);
  const getServingUrl = useMutation(api.storage.getServingUrl);

  const insertUploadedVideo = (src: string) => {
    console.log("[VideoInsert] inserting video node, src:", src);
    try {
      const result = editor.chain().focus().insertContent({
        type: "video",
        attrs: { src, controls: true, width: "100%" },
      }).run();
      console.log("[VideoInsert] insertContent result:", result);
      console.log("[VideoInsert] editor HTML after insert:", editor.getHTML().substring(0, 500));
    } catch (err) {
      console.error("[VideoInsert] insert error:", err);
    }
    setUrl("");
    setOpen(false);
  };

  const handleUrlInsert = () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    if (isYouTubeUrl(trimmed)) {
      editor.commands.setYoutubeVideo({ src: trimmed });
    } else if (isVimeoUrl(trimmed)) {
      const embedUrl = vimeoToEmbed(trimmed);
      if (embedUrl) {
        editor.chain().focus().insertContent({
          type: "youtube",
          attrs: { src: embedUrl },
        }).run();
      }
    } else {
      insertUploadedVideo(trimmed);
    }

    setUrl("");
    setOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Please select a video file.");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert("Video must be less than 100MB.");
      return;
    }

    setUploading(true);
    setOpen(false);

    const uploadId = `upload-${Date.now()}`;
    editor.chain().focus().insertContent({
      type: "video",
      attrs: { uploading: true, uploadId },
    }).run();

    try {
      const uploadUrl = await generateUploadUrl();

      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Upload failed");
      }

      const { storageId } = await result.json();
      const videoUrl = await getServingUrl({ storageId });

      if (!videoUrl) throw new Error("Failed to get serving URL");

      // Find the placeholder node and replace it with the real video
      const { state } = editor;
      let placeholderPos: number | null = null;
      state.doc.descendants((node, pos) => {
        if (node.type.name === "video" && node.attrs.uploadId === uploadId) {
          placeholderPos = pos;
          return false;
        }
      });

      if (placeholderPos !== null) {
        editor.chain().focus()
          .deleteRange({ from: placeholderPos, to: placeholderPos + 1 })
          .insertContentAt(placeholderPos, {
            type: "video",
            attrs: { src: videoUrl, controls: true, width: "100%" },
          })
          .run();
      }
    } catch (err) {
      console.error("Video upload failed:", err);
      // Remove the placeholder on error
      const { state } = editor;
      state.doc.descendants((node, pos) => {
        if (node.type.name === "video" && node.attrs.uploadId === uploadId) {
          editor.chain().deleteRange({ from: pos, to: pos + 1 }).run();
          return false;
        }
      });
      alert("Failed to upload video. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Video className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Insert Video</h4>

          {/* File upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload from computer
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-popover px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* URL input */}
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="YouTube, Vimeo, or video URL..."
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUrlInsert();
              }}
            />
            <Button
              size="sm"
              onClick={handleUrlInsert}
              disabled={!url.trim()}
            >
              <Link className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
