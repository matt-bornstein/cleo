import { isValidEmail } from "@/lib/validators/email";

describe("isValidEmail", () => {
  it("accepts well-formed emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("first.last+tag@domain.co")).toBe(true);
  });

  it("rejects malformed emails", () => {
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("test@domain")).toBe(false);
    expect(isValidEmail("test @domain.com")).toBe(false);
  });
});
