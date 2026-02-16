import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { isValidElement } from "react";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: unknown;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConvexClientProvider>{toRenderableChildren(children)}</ConvexClientProvider>
      </body>
    </html>
  );
}

function toRenderableChildren(value: unknown) {
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
      <span key={`layout-child-${index}`}>{toRenderableChildren(item)}</span>
    ));
  }

  return null;
}
