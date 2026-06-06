import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readDockerfile(): string {
  return readFileSync(fileURLToPath(new URL('../Dockerfile', import.meta.url)), 'utf8');
}

describe('backend/Dockerfile', () => {
  it('is multi-stage (declares at least two build stages)', () => {
    const stages = readDockerfile().match(/^FROM /gm) ?? [];
    expect(stages.length).toBeGreaterThanOrEqual(2);
  });

  it('names a build stage with AS', () => {
    expect(readDockerfile()).toMatch(/^FROM .+ AS \w+/m);
  });

  it('runs as a non-root user', () => {
    const userMatch = readDockerfile().match(/^USER\s+(\S+)/m);
    expect(userMatch?.[1]).toBeDefined();
    expect(userMatch?.[1]).not.toBe('root');
    expect(userMatch?.[1]).not.toBe('0');
  });

  it('exposes the application port', () => {
    expect(readDockerfile()).toMatch(/^EXPOSE\s+\d+/m);
  });

  it('declares a HEALTHCHECK that runs the node health probe', () => {
    const dockerfile = readDockerfile();
    expect(dockerfile).toMatch(/^HEALTHCHECK\b/m);
    expect(dockerfile).toMatch(/HEALTHCHECK[\s\S]*?CMD[\s\S]*?healthcheck\.mjs/);
  });

  it('uses a node-based probe without curl or wget', () => {
    const dockerfile = readDockerfile();
    expect(dockerfile).toMatch(/HEALTHCHECK[\s\S]*?CMD[\s\S]*?node/);
    expect(dockerfile).not.toMatch(/\bcurl\b/);
    expect(dockerfile).not.toMatch(/\bwget\b/);
  });
});
