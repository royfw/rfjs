import { Boxes, Database, Filter, LayoutDashboard } from "lucide-react";

export const NAV = [
  { key: "dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { key: "datasets", href: "/datasets", Icon: Database },
  { key: "explore", href: "/datasets/explore", Icon: Filter },
  { key: "apps", href: "/apps", Icon: Boxes },
] as const;
