import { Boxes, Database, LayoutDashboard } from "lucide-react";

export const NAV = [
  { key: "dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { key: "datasets", href: "/datasets", Icon: Database },
  { key: "apps", href: "/apps", Icon: Boxes },
] as const;
