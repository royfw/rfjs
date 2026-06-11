/** Strip `[`, `]`, and `.` from a path so it can be used as a template variable. */
export function normalizeKey(path: string): string {
  return path.replace(/[[\].]/g, '');
}
