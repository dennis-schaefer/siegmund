import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

const probePath = fileURLToPath(new URL('../healthcheck.mjs', import.meta.url));

// Spawned asynchronously: a synchronous spawn would block this process's event
// loop, preventing the in-process server below from answering the probe.
function runProbe(port: number): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [probePath], {
      env: { ...process.env, PORT: String(port), HEALTHCHECK_HOST: '127.0.0.1' },
      stdio: 'ignore',
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

describe('Docker healthcheck probe', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it('exits 0 when the server answers /health with 200', async () => {
    app = buildServer();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    expect(await runProbe(port)).toBe(0);
  });

  it('exits non-zero when nothing is listening on the port', async () => {
    expect(await runProbe(58231)).not.toBe(0);
  });
});
