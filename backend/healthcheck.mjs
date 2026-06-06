const port = process.env.PORT ?? '3000';
const host = process.env.HEALTHCHECK_HOST ?? '127.0.0.1';

try {
  const response = await fetch(`http://${host}:${port}/health`);
  process.exit(response.ok ? 0 : 1);
} catch {
  process.exit(1);
}
