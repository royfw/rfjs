import { dataFilterEngine } from "./data-filter";
import { jsonbEngine } from "./jsonb";
import type { Engine, EngineId } from "./types";

// Extension point for a mongo engine: add mongoEngine and register it here.
const ENGINES: Record<EngineId, Engine> = {
  jsonb: jsonbEngine,
  "data-filter": dataFilterEngine,
};

export const ENGINE_IDS: EngineId[] = ["jsonb", "data-filter"];

export function getEngine(id: EngineId): Engine {
  return ENGINES[id];
}

export type { Engine, EngineId, OperatorSpec, OperatorArity, EngineOutput } from "./types";
