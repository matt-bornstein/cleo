import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";

const { convexReactClientMock, convexProviderMock } = vi.hoisted(() => ({
  convexReactClientMock: vi.fn(),
  convexProviderMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: function MockConvexReactClient(url: string) {
    convexReactClientMock(url);
    return { url };
  },
  ConvexProvider: (props: { children: ReactNode }) => {
    convexProviderMock(props);
    return <div data-testid="convex-provider">{props.children}</div>;
  },
}));

describe("ConvexClientProvider", () => {
  const originalConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  beforeEach(() => {
    convexReactClientMock.mockClear();
    convexProviderMock.mockClear();
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = originalConvexUrl;
  });

  it("shows local fallback banner when convex url is missing", () => {
    render(
      <ConvexClientProvider>
        <div>App content</div>
      </ConvexClientProvider>,
    );

    expect(
      screen.getByText(/Convex is not connected \(missing NEXT_PUBLIC_CONVEX_URL\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("App content")).toBeInTheDocument();
    expect(convexReactClientMock).not.toHaveBeenCalled();
  });

  it("uses convex provider when convex url is valid", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";

    render(
      <ConvexClientProvider>
        <div>Connected content</div>
      </ConvexClientProvider>,
    );

    expect(convexReactClientMock).toHaveBeenCalledWith("https://example.convex.cloud");
    expect(screen.getByTestId("convex-provider")).toBeInTheDocument();
    expect(screen.getByText("Connected content")).toBeInTheDocument();
  });

  it("falls back safely when convex url is malformed", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example\n.convex.cloud";

    render(<ConvexClientProvider>{123}</ConvexClientProvider>);

    expect(
      screen.getByText(/Convex is not connected \(missing NEXT_PUBLIC_CONVEX_URL\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(convexReactClientMock).not.toHaveBeenCalled();
  });
});
