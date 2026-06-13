import { renderWordmarkIcon } from "../_pwa/icon";

export const dynamic = "force-static";

export function GET() {
  return renderWordmarkIcon(192);
}
