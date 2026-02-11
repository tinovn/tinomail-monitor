# Code Standards

## File Naming
- **kebab-case** for all files: `server-config.ts`, `email-event.ts`
- Descriptive names that are self-documenting for LLM tools

## File Size
- Target **under 200 lines** per file
- Split into focused modules when exceeding limit

## TypeScript
- Strict mode enabled globally
- Consistent type imports: `import type { ... }`
- Zod for runtime validation at boundaries

## Imports
- ESM throughout (`"type": "module"`)
- Use `.js` extensions in relative imports for ESM compat

## Naming Conventions
- Interfaces/Types: PascalCase (`SystemMetrics`, `EmailEvent`)
- Constants: SCREAMING_SNAKE for arrays, PascalCase for enums
- Functions/variables: camelCase
- Database columns: snake_case (Drizzle maps to camelCase)

## Error Handling
- Try-catch at API boundaries
- Zod validation for all external input
- Fastify error hooks for consistent error responses

## Testing
- Vitest for unit/integration tests
- Docker Compose for test environment (TimescaleDB + Redis)
- Focus on critical paths: auth, metrics ingestion, DNSBL
