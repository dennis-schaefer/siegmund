import Fastify, { type FastifyInstance } from 'fastify';

export function buildServer(): FastifyInstance {
  const app = Fastify();

  app.get('/health', () => {
    return { status: 'ok' };
  });

  return app;
}
