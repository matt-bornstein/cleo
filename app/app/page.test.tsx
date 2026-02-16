import { vi } from "vitest";

import HomePage from "@/app/page";

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

describe("HomePage", () => {
  beforeEach(() => {
    redirectMock.mockReset();
  });

  it("redirects root route to editor index", () => {
    HomePage();
    expect(redirectMock).toHaveBeenCalledWith("/editor");
  });
});
