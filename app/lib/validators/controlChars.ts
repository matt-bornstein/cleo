const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

export function hasControlChars(value: string) {
  return CONTROL_CHARS_REGEX.test(value);
}
