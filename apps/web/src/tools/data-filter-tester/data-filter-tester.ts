import { matchQuery, type FilterMatchQuery } from "@rfjs/data-filter";

export type FilterTestResult =
  | { ok: true; output: string; count: number }
  | { ok: false; error: "invalidJson" | "notArray" | "queryFailed" };

export function runFilterTest(dataText: string, filterText: string): FilterTestResult {
  let data: unknown;
  let filter: unknown;
  try {
    data = JSON.parse(dataText);
    filter = JSON.parse(filterText);
  } catch {
    return { ok: false, error: "invalidJson" };
  }
  if (!Array.isArray(data)) {
    return { ok: false, error: "notArray" };
  }
  try {
    const matched = data.filter((item) => matchQuery(item, filter as FilterMatchQuery));
    return { ok: true, output: JSON.stringify(matched, null, 2), count: matched.length };
  } catch {
    return { ok: false, error: "queryFailed" };
  }
}
