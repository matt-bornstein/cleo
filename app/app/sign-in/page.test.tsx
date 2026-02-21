import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import SignInPage from "@/app/sign-in/page";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const signInMock = vi.fn();
let mockedRouter: unknown = {
  push: pushMock,
  refresh: refreshMock,
};
let mockedSearchParams: unknown = {
  get: () => "/editor/doc-1",
};
let mockedConvexAuthState = {
  isAuthenticated: false,
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockedRouter,
  useSearchParams: () => mockedSearchParams,
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({
    signIn: signInMock,
  }),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => mockedConvexAuthState,
}));

describe("SignInPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    signInMock.mockReset();
    mockedRouter = {
      push: pushMock,
      refresh: refreshMock,
    };
    mockedSearchParams = {
      get: () => "/editor/doc-1",
    };
    mockedConvexAuthState = {
      isAuthenticated: false,
    };
  });

  it("starts Google sign-in with sanitized next path", async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue(undefined);

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(signInMock).toHaveBeenCalledWith("google", {
      redirectTo: "/editor/doc-1",
    });
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("falls back to /editor when search params payload is malformed", async () => {
    const user = userEvent.setup();
    mockedSearchParams = 123;
    signInMock.mockResolvedValue(undefined);

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(signInMock).toHaveBeenCalledWith("google", {
      redirectTo: "/editor",
    });
  });

  it("shows error when google sign-in throws", async () => {
    const user = userEvent.setup();
    signInMock.mockRejectedValue(new Error("Sign in failed"));

    render(<SignInPage />);
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(screen.getByText("Sign in failed")).toBeInTheDocument();
    });
  });

  it("redirects already-authenticated users to next path", async () => {
    mockedConvexAuthState = {
      isAuthenticated: true,
    };

    render(<SignInPage />);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/editor/doc-1");
    });
    expect(refreshMock).toHaveBeenCalled();
  });
});
