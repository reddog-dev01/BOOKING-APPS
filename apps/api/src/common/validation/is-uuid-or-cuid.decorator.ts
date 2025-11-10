import { buildMessage, isUUID, ValidateBy, ValidationOptions } from 'class-validator';

// Prisma emits cuid identifiers (c + 24 lowercase base36 chars).
const CUID_REGEX = /^c[a-z0-9]{24}$/;

export function normalizeQuoteIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (isUUID(trimmed, '4')) {
    // UUIDs are case-insensitive; normalize to lowercase for consistent storage/lookups.
    return trimmed.toLowerCase();
  }

  const lowered = trimmed.toLowerCase();
  if (CUID_REGEX.test(lowered)) {
    return lowered;
  }

  return undefined;
}

function isUuidOrCuid(value: unknown): boolean {
  return typeof normalizeQuoteIdentifier(value) === 'string';
}

export function IsUuidOrCuid(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isUuidOrCuid',
      validator: {
        validate: (value) => isUuidOrCuid(value),
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a UUID v4 or Prisma CUID`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

