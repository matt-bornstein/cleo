import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import SignInPage from "@/app/sign-in/page";

const pushMock = vi.fn();
const refreshMock = vi.fn();
let mockedSearchParams: unknown = {
  get: () => "/editor/doc-1",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
  useSearchParams: () => mockedSearchParams,
}));

describe("SignInPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
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

  it("shows error when sign-in response payload is malformed", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({} as Response);

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue (local auth)" }));

    await waitFor(() => {
      expect(screen.getByText("Unable to sign in.")).toBeInTheDocument();
    });
  });
});
