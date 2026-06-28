import { setRequestLocale } from "next-intl/server";

import { CanvasPrototype } from "./canvas-prototype";

// Standalone evaluation route (no AppShell/sidebar) for the Direction C
// "2D free canvas" form-builder concept. Not registered as a tool — it's a
// throwaway prototype for picking a layout direction.
export default async function FormCanvasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CanvasPrototype />;
}
