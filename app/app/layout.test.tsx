import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { vi } from "vitest";

import RootLayout from "@/app/layout";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

vi.mock("@/components/providers/ConvexClientProvider", () => ({
  ConvexClientProvider: (props: { children: ReactNode }) => (
    <div data-testid="convex-provider">{props.children}</div>
  ),
}));

describe("RootLayout", () => {
  it("renders children through ConvexClientProvider", () => {
    const markup = renderToStaticMarkup(
      RootLayout({ children: <div>App content</div> }),
    );

    expect(markup).toContain("convex-provider");
    expect(markup).toContain("App content");
  });

  it("drops malformed non-renderable children payloads safely", () => {
    const markup = renderToStaticMarkup(RootLayout({ children: { bad: true } }));

    expect(markup).toContain("convex-provider");
    expect(markup).not.toContain("bad");
  });

  it("keeps renderable entries from mixed child arrays", () => {
    const markup = renderToStaticMarkup(
      RootLayout({
        children: [<span key="ok">OK</span>, { bad: true }, "Tail"] as unknown,
      }),
    );

    expect(markup).toContain("OK");
    expect(markup).toContain("Tail");
    expect(markup).not.toContain("[object Object]");
  });
});
