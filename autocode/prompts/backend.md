## Backend (TypeScript / Fastify) Conventions

You are implementing a backend issue. In addition to the universal TDD workflow above, follow these rules.

### Module boundaries
- Source for each module lives under `src/<module>/` (e.g. `src/auth/`, `src/skills/`).
- Every module exposes its public surface through a single `index.ts` barrel. Cross-module access goes through that barrel only — never deep-import another module's internal files.
- If you need a new module, create `src/<name>/` with its own `index.ts` re-exporting only what other modules are allowed to use.

### Tests
- **Unit tests** for pure logic — Vitest, no Fastify app, no database.
- **Integration tests** for anything touching HTTP or persistence — build a real Fastify instance and drive it with `fastify.inject()`. Back it with an in-memory or temp-file SQLite database; never depend on a host-local service.
- Test files colocate next to the source. Naming: `<unit>.test.ts` for unit, `<unit>.integration.test.ts` for integration.

### Design
- **SOLID**, with a strong bias toward small, single-responsibility modules and functions.
- **Dependency injection by argument.** Pass collaborators in via constructor/factory parameters. No module-level mutable state, no hand-rolled singletons, no service locators.
- **Immutable value objects** as `readonly` types or `as const`. Don't mutate inputs.
- **No `any`.** Use `unknown` at boundaries and narrow before use. Strict null checks stay on; don't silence them with `!` unless a comment explains why the value cannot be null at that point.
- Public function names: verb + noun, no abbreviations (`findActiveClusters`, not `getActClus`).
- Errors are typed error classes thrown at the boundary, never raw `throw "string"` or bare `RuntimeError` strings.

### Persistence
- SQLite via `better-sqlite3`. Access the database only through repository/service functions — never return raw row objects from an HTTP handler.
- Schema changes go in numbered, forward-only SQL migrations named `migrations/NNNN_<description>.sql`.
- Never modify an already-released migration — add a new one.

### HTTP
- Register routes as Fastify plugins, one per module. Mount each module's plugin from a single app composition point.
- Validate request and response with JSON Schema / TypeBox (or Zod via a type provider) so the generated OpenAPI spec stays accurate — the frontend's Orval client is generated from it.
- Map errors to HTTP responses with a single `setErrorHandler`; never let a raw exception escape a route handler.

### Build
- After implementation, run `npm run typecheck` and `npm run test` (or the project equivalents) and ensure both pass.
