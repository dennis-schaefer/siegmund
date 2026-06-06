import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readDeployFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../../deploy/${relativePath}`, import.meta.url)), 'utf8');
}

describe('deploy/README.md', () => {
  const readme = (): string => readDeployFile('README.md');

  it('explains pulling and running the GHCR backend image', () => {
    const doc = readme();
    expect(doc).toMatch(/ghcr\.io\/[^\s/]+\/siegmund-backend/);
    expect(doc).toMatch(/docker (pull|compose pull)/);
    expect(doc).toMatch(/docker (run|compose up)/);
  });

  it('documents the required secret environment variables', () => {
    const doc = readme();
    expect(doc).toContain('ANTHROPIC_API_KEY');
    expect(doc).toMatch(/OPENROUTER_API_KEY|OPENAI_API_KEY/);
  });

  it('states that secrets are provided only via environment variables', () => {
    expect(readme()).toMatch(/secret[\s\S]*environment variable|environment variable[\s\S]*secret/i);
  });

  it('documents the persistent volumes for SQLite state and the Vault working clone', () => {
    const doc = readme();
    expect(doc).toMatch(/sqlite/i);
    expect(doc).toMatch(/vault/i);
    expect(doc).toMatch(/volume/i);
  });

  it('explains how to update generically by pulling a new tag and recreating the container', () => {
    const doc = readme().toLowerCase();
    expect(doc).toContain('pull');
    expect(doc).toMatch(/tag/);
    expect(doc).toMatch(/recreate|up -d|docker run/);
  });

  it('does not reference Watchtower or auto-update tooling', () => {
    expect(readme()).not.toMatch(/watchtower/i);
    expect(readme()).not.toMatch(/auto-?update/i);
  });
});

describe('deploy/docker-compose.yaml', () => {
  const compose = (): string => readDeployFile('docker-compose.yaml');

  it('references the GHCR backend image', () => {
    expect(compose()).toMatch(/image:\s*ghcr\.io\/[^\s/]+\/siegmund-backend/);
  });

  it('maps a port', () => {
    expect(compose()).toMatch(/ports:/);
    expect(compose()).toMatch(/\d+:3000/);
  });

  it('declares a restart policy', () => {
    expect(compose()).toMatch(/restart:\s*\S+/);
  });

  it('declares a healthcheck', () => {
    expect(compose()).toMatch(/healthcheck:/);
  });

  it('mounts persistent volumes for SQLite state and the Vault working clone', () => {
    const doc = compose();
    expect(doc).toMatch(/volumes:/);
    expect(doc).toMatch(/sqlite|data/i);
    expect(doc).toMatch(/vault/i);
  });

  it('passes secrets through environment variables', () => {
    const doc = compose();
    expect(doc).toMatch(/environment:/);
    expect(doc).toContain('ANTHROPIC_API_KEY');
  });

  it('does not reference Watchtower or auto-update tooling', () => {
    expect(compose()).not.toMatch(/watchtower/i);
    expect(compose()).not.toMatch(/auto-?update/i);
  });
});
