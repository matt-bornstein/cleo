import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { Geist, Geist_Mono } from "next/font/google";
import { isValidElement } from "react";
import type { ReactNode } from "react";

import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Collaborative Editor",
  description: "AI-powered collaborative rich text editor scaffold",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: unknown;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConvexAuthNextjsServerProvider>
          <ConvexClientProvider>{toRenderableChildren(children)}</ConvexClientProvider>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}

function toRenderableChildren(value: unknown): ReactNode {
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
    return value
      .map((item) => toRenderableChildren(item))
      .filter((item): item is Exclude<ReactNode, null> => item !== null);
  }

  return null;
}
