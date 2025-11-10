import { registerDecorator, ValidationOptions, ValidationArguments, isUUID } from 'class-validator';

// Prisma emits cuid identifiers (c + 24 lowercase base36 chars); we accept them alongside UUIDs for forward compatibility.
const CUID_REGEX = /^c[a-z0-9]{24}$/;

function isCuid(value: string): boolean {
  return CUID_REGEX.test(value);
}

export function IsUuidOrCuid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUuidOrCuid',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string' || value.trim() === '') {
            return false;
          }
          const normalized = value.trim();
          return isUUID(normalized, '4') || isCuid(normalized);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a UUID v4 or Prisma CUID`;
        },
      },
    });
  };
}
