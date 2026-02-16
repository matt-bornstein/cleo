import { vi } from "vitest";

import HomePage from "@/app/page";

const redirectMock = vi.fn();
let mockedRedirect: unknown = (...args: unknown[]) => redirectMock(...args);
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => {
    if (typeof mockedRedirect === "function") {
      return mockedRedirect(...args);
    }
    return undefined;
  },
}));

describe("HomePage", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    mockedRedirect = (...args: unknown[]) => redirectMock(...args);
  });

  it("redirects root route to editor index", () => {
    HomePage();
    expect(redirectMock).toHaveBeenCalledWith("/editor");
  });

  it("does not throw when redirect binding is malformed", () => {
    mockedRedirect = 123;
    expect(() => HomePage()).not.toThrow();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
