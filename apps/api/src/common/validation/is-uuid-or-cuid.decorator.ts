import { buildMessage, isUUID, ValidateBy, ValidationOptions } from 'class-validator';

// Prisma emits cuid identifiers (c + 24 lowercase base36 chars); allow case-insensitive match in case upstream normalizes.
const CUID_REGEX = /^c[a-z0-9]{24}$/;

function isCuid(value: string): boolean {
  return CUID_REGEX.test(value);
}

function isUuidOrCuid(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }
  if (isUUID(normalized, '4')) {
    return true;
  }
  return isCuid(normalized.toLowerCase());
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

