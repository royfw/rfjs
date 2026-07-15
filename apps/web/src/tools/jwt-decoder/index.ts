import type { ToolModule } from "@/tools/types";

import { JwtDecoder } from "./ui";

export const tool: ToolModule = { id: "jwt-decoder", Component: JwtDecoder };
