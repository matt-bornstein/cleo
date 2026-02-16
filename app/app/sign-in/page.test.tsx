import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import SignInPage from "@/app/sign-in/page";

const pushMock = vi.fn();
const refreshMock = vi.fn();
let mockedRouter: unknown = {
  push: pushMock,
  refresh: refreshMock,
};
let mockedSearchParams: unknown = {
  get: () => "/editor/doc-1",
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockedRouter,
  useSearchParams: () => mockedSearchParams,
}));

describe("SignInPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    mockedRouter = {
      push: pushMock,
      refresh: refreshMock,
    };
    mockedSearchParams = {
      get: () => "/editor/doc-1",
    };
    vi.restoreAllMocks();
  });

  it("posts local sign-in request and redirects to sanitized next path", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue (local auth)" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/local-signin",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ next: "/editor/doc-1" }),
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/editor/doc-1");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("falls back to /editor when search params payload is malformed", async () => {
    const user = userEvent.setup();
    mockedSearchParams = 123;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue (local auth)" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/local-signin",
      expect.objectContaining({
        body: JSON.stringify({ next: "/editor" }),
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/editor");
  });

  it("falls back to /editor when search params getter throws", async () => {
    const user = userEvent.setup();
    mockedSearchParams = {
      get: () => {
        throw new Error("search params unavailable");
      },
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue (local auth)" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/local-signin",
      expect.objectContaining({
        body: JSON.stringify({ next: "/editor" }),
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/editor");
  });

  it("falls back to /editor when search params get getter throws", async () => {
    const user = userEvent.setup();
    const malformedSearchParams = Object.create(null) as { get: unknown };
    Object.defineProperty(malformedSearchParams, "get", {
      get() {
        throw new Error("get getter failed");
      },
    });
    mockedSearchParams = malformedSearchParams;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue (local auth)" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/local-signin",
      expect.objectContaining({
        body: JSON.stringify({ next: "/editor" }),
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/editor");
  });

  it("shows error when sign-in response payload is malformed", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({} as Response);

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue (local auth)" }));

    await waitFor(() => {
      expect(screen.getByText("Unable to sign in.")).toBeInTheDocument();
    });
  });

  it("does not throw when router getters are malformed", async () => {
    const user = userEvent.setup();
    const malformedRouter = Object.create(null) as {
      push: unknown;
      refresh: unknown;
    };
    Object.defineProperty(malformedRouter, "push", {
      get() {
        throw new Error("push getter failed");
      },
    });
    Object.defineProperty(malformedRouter, "refresh", {
      get() {
        throw new Error("refresh getter failed");
      },
    });
    mockedRouter = malformedRouter;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue (local auth)" }));

    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Unable to sign in."),
    ).not.toBeInTheDocument();
  });
});
