const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;
const DISALLOWED_TEXT_CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function hasControlChars(value: unknown) {
  if (typeof value !== "string") {
    return true;
  }
  return CONTROL_CHARS_REGEX.test(value);
}

export function hasDisallowedTextControlChars(value: unknown) {
  if (typeof value !== "string") {
    return true;
  }
  return DISALLOWED_TEXT_CONTROL_CHARS_REGEX.test(value);
}
