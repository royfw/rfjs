import { RouteHandlerMethod } from 'fastify/types/route';
import { datasetUsecases } from '@/infrastructures/datasource';

export const listDatasetsHandler: RouteHandlerMethod = async (_req, reply) => {
  reply.send(await datasetUsecases.list());
};

export const getDatasetHandler: RouteHandlerMethod = async (req, reply) => {
  const { id } = req.params as { id: string };
  const found = await datasetUsecases.get(id);
  if (!found) return reply.notFound(`dataset ${id} not found`);
  reply.send(found);
};

export const createDatasetHandler: RouteHandlerMethod = async (req, reply) => {
  const created = await datasetUsecases.create(req.body);
  reply.code(201).send(created);
};

export const searchDatasetsHandler: RouteHandlerMethod = async (req, reply) => {
  reply.send(await datasetUsecases.search(req.body));
};
