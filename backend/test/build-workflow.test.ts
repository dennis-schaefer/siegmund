import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readWorkflow(): string {
  return readFileSync(
    fileURLToPath(new URL('../../.github/workflows/build.yml', import.meta.url)),
    'utf8',
  );
}

describe('build.yml workflow', () => {
  it('triggers on push to main', () => {
    expect(readWorkflow()).toMatch(/on:[\s\S]*push:[\s\S]*branches:[\s\S]*main/);
  });

  it('has a changes job filtering backend, shared, Dockerfile and lockfile', () => {
    const workflow = readWorkflow();
    expect(workflow).toMatch(/^\s*changes:/m);
    expect(workflow).toContain('backend/**');
    expect(workflow).toContain('packages/shared/**');
    expect(workflow).toContain('backend/Dockerfile');
    expect(workflow).toContain('pnpm-lock.yaml');
  });

  it('gates the build on the reusable ci.yml tests', () => {
    const workflow = readWorkflow();
    expect(workflow).toContain('uses: ./.github/workflows/ci.yml');
    expect(workflow).toMatch(/needs:\s*\[changes, ci\]/);
  });

  it('skips the build when backend/shared did not change', () => {
    expect(readWorkflow()).toMatch(/if:\s*needs\.changes\.outputs\.\w+\s*==\s*'true'/);
  });

  it('pushes to the GHCR backend image with sha- and edge tags', () => {
    const workflow = readWorkflow();
    expect(workflow).toContain('ghcr.io/${{ github.repository_owner }}/siegmund-backend');
    expect(workflow).toContain('sha-');
    expect(workflow).toMatch(/value=edge|:edge/);
  });

  it('grants packages: write to the built-in GITHUB_TOKEN', () => {
    const workflow = readWorkflow();
    expect(workflow).toContain('packages: write');
    expect(workflow).toContain('secrets.GITHUB_TOKEN');
  });

  it('uses gha docker layer caching', () => {
    expect(readWorkflow()).toContain('type=gha');
  });

  it('also triggers on push of v* tags', () => {
    expect(readWorkflow()).toMatch(/tags:[\s\S]*?v\*/);
  });

  it('tags semver releases as a v-prefixed version', () => {
    expect(readWorkflow()).toMatch(/type=semver,pattern=v\{\{version\}\}/);
  });

  it('applies latest only on release tags via latest=auto', () => {
    expect(readWorkflow()).toContain('latest=auto');
  });

  it('builds releases even when the tagged commit did not touch backend paths', () => {
    expect(readWorkflow()).toMatch(/startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  });

  it('keeps edge bound to main pushes only, never to release tags', () => {
    expect(readWorkflow()).toMatch(
      /value=edge,enable=\$\{\{ github\.ref == 'refs\/heads\/main' \}\}/,
    );
  });
});
