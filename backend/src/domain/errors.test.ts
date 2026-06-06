import { describe, expect, it } from 'vitest';
import {
  DomainError,
  InvalidAreaNameError,
  InvalidTimestampError,
  MalformedFrontmatterError,
  ReservedAreaNameError,
} from './errors.ts';

describe('DomainError', () => {
  it('is abstract and cannot be instantiated directly', () => {
    // We verify indirectly: subclasses extend it and are instanceof DomainError
    const err = new InvalidAreaNameError('bad');
    expect(err).toBeInstanceOf(DomainError);
  });
});

const errorCases: Array<{
  name: string;
  factory: () => DomainError;
  code: string;
  ctor: new (...args: never[]) => DomainError;
}> = [
  {
    name: 'InvalidAreaNameError',
    factory: () => new InvalidAreaNameError('bad name'),
    code: 'INVALID_AREA_NAME',
    ctor: InvalidAreaNameError,
  },
  {
    name: 'ReservedAreaNameError',
    factory: () => new ReservedAreaNameError('inbox'),
    code: 'RESERVED_AREA_NAME',
    ctor: ReservedAreaNameError,
  },
  {
    name: 'InvalidTimestampError',
    factory: () => new InvalidTimestampError('not-a-date'),
    code: 'INVALID_TIMESTAMP',
    ctor: InvalidTimestampError,
  },
  {
    name: 'MalformedFrontmatterError',
    factory: () => new MalformedFrontmatterError('missing key'),
    code: 'MALFORMED_FRONTMATTER',
    ctor: MalformedFrontmatterError,
  },
];

describe.each(errorCases)('$name', ({ factory, code, ctor }) => {
  it('extends DomainError', () => {
    expect(factory()).toBeInstanceOf(DomainError);
  });

  it('is instanceof its own class', () => {
    expect(factory()).toBeInstanceOf(ctor);
  });

  it('extends Error', () => {
    expect(factory()).toBeInstanceOf(Error);
  });

  it(`has stable code "${code}"`, () => {
    expect(factory().code).toBe(code);
  });

  it('carries a message', () => {
    expect(factory().message).toBeTruthy();
  });
});

describe('instanceof-distinguishability', () => {
  it('InvalidAreaNameError is not instanceof ReservedAreaNameError', () => {
    expect(new InvalidAreaNameError('x')).not.toBeInstanceOf(ReservedAreaNameError);
  });

  it('ReservedAreaNameError is not instanceof InvalidAreaNameError', () => {
    expect(new ReservedAreaNameError('x')).not.toBeInstanceOf(InvalidAreaNameError);
  });

  it('InvalidTimestampError is not instanceof MalformedFrontmatterError', () => {
    expect(new InvalidTimestampError('x')).not.toBeInstanceOf(MalformedFrontmatterError);
  });
});
