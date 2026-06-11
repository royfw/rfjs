/** True when a metadata slot string is a computed expression (starts with '='). */
export function isExpression(slot: string): boolean {
  return slot.startsWith('=');
}

/** Remove exactly one leading '=' so the remainder can be compiled. */
export function stripExpressionPrefix(slot: string): string {
  return slot.startsWith('=') ? slot.slice(1) : slot;
}
