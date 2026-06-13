export function packageSlug(name: string): string {
  return name.replace(/^@rfjs\//, "");
}
