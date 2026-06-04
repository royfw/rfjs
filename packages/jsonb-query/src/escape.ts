/** Escape a string for use inside a jsonpath double-quoted token (member name
 *  or string literal): backslash first, then double quote, then control chars. */
export function escapeJsonpathString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Escape POSIX ERE metacharacters so a value matches literally in like_regex. */
export function escapeRegexLiteral(value: string): string {
  return value.replace(/[.^$*+?()[\]{}|\\]/g, '\\$&');
}
