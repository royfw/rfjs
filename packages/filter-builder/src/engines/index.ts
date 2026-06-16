import { dataFilterEngine } from "./data-filter";
import { jsonbEngine } from "./jsonb";
import { pgFilterEngine } from "./pg-filter";
import type { Engine, EngineId } from "./types";

const ENGINES: Record<EngineId, Engine> = {
  jsonb: jsonbEngine,
  "data-filter": dataFilterEngine,
  "pg-filter": pgFilterEngine,
};

export const ENGINE_IDS: EngineId[] = ["jsonb", "data-filter", "pg-filter"];

export function getEngine(id: EngineId): Engine {
  return ENGINES[id];
}

export type {
  Engine,
  EngineId,
  OperatorSpec,
  OperatorArity,
  EngineOutput,
  CompileContext,
  CompileField,
} from "./types";
