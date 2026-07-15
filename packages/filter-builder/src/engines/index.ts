import { dataFilterEngine } from "./data-filter";
import { esQueryEngine } from "./es-query";
import { jsonbEngine } from "./jsonb";
import { mongoEngine } from "./mongo";
import { pgFilterEngine } from "./pg-filter";
import { sqlFilterEngine } from "./sql-filter";
import type { Engine, EngineId } from "./types";

const ENGINES: Record<EngineId, Engine> = {
  jsonb: jsonbEngine,
  "data-filter": dataFilterEngine,
  "pg-filter": pgFilterEngine,
  "sql-filter": sqlFilterEngine,
  mongo: mongoEngine,
  "es-query": esQueryEngine,
};

export const ENGINE_IDS: EngineId[] = ["jsonb", "data-filter", "pg-filter", "sql-filter", "mongo", "es-query"];

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
