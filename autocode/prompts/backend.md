## Backend (Java / Spring Boot) Conventions

You are implementing a backend issue. In addition to the universal TDD workflow above, follow these rules.

### Module boundaries (Spring Modulith)
- Source packages live under `io.interfero.<module>` (e.g. `io.interfero.auth`, `io.interfero.cluster`).
- Cross-module access goes through published API packages only. Never reach into another module's internal packages.
- If you need a new module, create it under `io.interfero.<name>` with `package-info.java` declaring `@ApplicationModule`.

### Tests
- **Unit tests** for pure logic — JUnit 5, AssertJ, no Spring context.
- **Integration tests** for anything touching Spring, persistence, or HTTP — `@SpringBootTest` or sliced annotations (`@WebMvcTest`, `@DataJpaTest`).
- Test classes live in `src/test/java/...` mirroring the production package. Naming: `<ClassUnderTest>Test` for unit, `<ClassUnderTest>IT` for integration.
- Use Testcontainers for Postgres/Pulsar integration tests when needed; never depend on a host-local service.

### Design
- **SOLID**, with a strong bias toward small, single-responsibility classes.
- **Constructor injection only.** No `@Autowired` on fields. No setter injection.
- **Immutable value objects** as `record` types. No Lombok `@Data`.
- **No static state**, no service locators, no singletons hand-rolled outside the Spring container.
- Public methods: verb + noun, no abbreviations (`findActiveClusters`, not `getActClus`).
- Avoid checked exceptions in business code; wrap them at the boundary.
- `@SuppressWarnings` requires a comment explaining the specific reason.

### Persistence
- Schema changes go in Liquibase changelogs named `db.changelog-v{major}.{minor}.yaml` under `src/main/resources/db/changelog/`.
- Never modify an already-released changelog — add a new one.
- JPA entities are mutable by necessity, but expose them only through repository/service boundaries; never return entities directly from controllers.

### HTTP
- Controllers under `<module>.api`. DTOs are records with explicit field validation (`@NotBlank`, `@Email`, etc.).
- Map exceptions to HTTP responses with `@RestControllerAdvice`, never throw raw `RuntimeException` from a controller.

### Build
- After implementation, run `./mvnw -pl <module> -am verify` (or the project-wide `./mvnw verify`) and ensure all tests pass.
