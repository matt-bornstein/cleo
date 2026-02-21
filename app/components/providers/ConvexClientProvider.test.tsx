import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest";

import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";

const { convexReactClientMock, convexAuthProviderMock } = vi.hoisted(() => ({
  convexReactClientMock: vi.fn(),
  convexAuthProviderMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: function MockConvexReactClient(url: string) {
    convexReactClientMock(url);
    return { url };
  },
}));

vi.mock("@convex-dev/auth/nextjs", () => ({
  ConvexAuthNextjsProvider: (props: { children: ReactNode }) => {
    convexAuthProviderMock(props);
    return <div data-testid="convex-auth-provider">{props.children}</div>;
  },
}));

describe("ConvexClientProvider", () => {
  const originalConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  beforeEach(() => {
    convexReactClientMock.mockClear();
    convexAuthProviderMock.mockClear();
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_CONVEX_URL = originalConvexUrl;
  });

  it("shows auth configuration error when convex url is missing", () => {
    render(
      <ConvexClientProvider>
        <div>App content</div>
      </ConvexClientProvider>,
    );

    expect(
      screen.getByText(/Convex auth requires `NEXT_PUBLIC_CONVEX_URL`/),
    ).toBeInTheDocument();
    expect(screen.queryByText("App content")).not.toBeInTheDocument();
    expect(convexReactClientMock).not.toHaveBeenCalled();
  });

  it("uses convex auth provider when convex url is valid", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";

    render(
      <ConvexClientProvider>
        <div>Connected content</div>
      </ConvexClientProvider>,
    );

    expect(convexReactClientMock).toHaveBeenCalledWith("https://example.convex.cloud");
    expect(screen.getByTestId("convex-auth-provider")).toBeInTheDocument();
    expect(screen.getByText("Connected content")).toBeInTheDocument();
  });

  it("falls back safely when convex url is malformed", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example\n.convex.cloud";

    render(<ConvexClientProvider>{123}</ConvexClientProvider>);

    expect(
      screen.getByText(/Convex auth requires `NEXT_PUBLIC_CONVEX_URL`/),
    ).toBeInTheDocument();
    expect(screen.queryByText("123")).not.toBeInTheDocument();
    expect(convexReactClientMock).not.toHaveBeenCalled();
  });

  it("renders only valid entries from mixed children arrays", () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";

    render(
      <ConvexClientProvider>
        {[<span key="ok">OK</span>, { bad: true }, "Tail"] as unknown as ReactNode}
      </ConvexClientProvider>,
    );

    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText("Tail")).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });
});
