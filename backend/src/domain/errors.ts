/**
 * Abstract base for all domain errors.
 * Each subclass carries a stable, string `code` for programmatic handling.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Restore prototype chain when targeting ES5 downlevel; safe no-op on ES2022+.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidAreaNameError extends DomainError {
  override readonly code = 'INVALID_AREA_NAME';

  constructor(name: string) {
    super(`Area name is invalid: "${name}"`);
  }
}

export class ReservedAreaNameError extends DomainError {
  override readonly code = 'RESERVED_AREA_NAME';

  constructor(name: string) {
    super(`Area name is reserved and cannot be used: "${name}"`);
  }
}

export class InvalidTimestampError extends DomainError {
  override readonly code = 'INVALID_TIMESTAMP';

  constructor(value: string) {
    super(`Timestamp value is not a valid ISO date: "${value}"`);
  }
}

export class MalformedFrontmatterError extends DomainError {
  override readonly code = 'MALFORMED_FRONTMATTER';

  constructor(detail: string) {
    super(`Frontmatter is malformed: ${detail}`);
  }
}
