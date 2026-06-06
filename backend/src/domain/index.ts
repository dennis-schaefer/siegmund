export {
  KNOWN_STATUSES,
  isKnownStatus,
  isKnownType,
} from './vocabulary.ts';
export type { EntryType, KnownStatus } from './vocabulary.ts';

export {
  DomainError,
  InvalidAreaNameError,
  InvalidTimestampError,
  MalformedFrontmatterError,
  ReservedAreaNameError,
} from './errors.ts';
