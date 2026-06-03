/** Escape a string for use inside a jsonpath double-quoted token (member name
 *  or string literal): backslash first, then double quote. */
export function escapeJsonpathString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Escape POSIX ERE metacharacters so a value matches literally in like_regex. */
export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.^$*+?()[\]{}|\\]/g, '\\$&');
}
