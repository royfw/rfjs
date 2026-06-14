export type Dataset = { id: string; name: string; description: string | null };

/**
 * Distinguishes a reachable-but-empty API (`ok: true, datasets: []`) from an
 * unreachable/erroring one (`ok: false`) so the page can show different states.
 */
export type DatasetsResult = { ok: true; datasets: Dataset[] } | { ok: false };

export async function fetchDatasets(): Promise<DatasetsResult> {
  const base = process.env.API_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/datasets`, { cache: "no-store" });
    if (!res.ok) return { ok: false };
    return { ok: true, datasets: (await res.json()) as Dataset[] };
  } catch {
    return { ok: false };
  }
}
