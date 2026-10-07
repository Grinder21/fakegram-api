import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerDecorator, type ValidationOptions } from 'class-validator';

const COMMON_PASSWORDS = new Set(
  readFileSync(join(__dirname, 'common-passwords.txt'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean),
);

export function IsNotCommonPassword(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotCommonPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'string' ||
          !COMMON_PASSWORDS.has(value.toLowerCase()),
        defaultMessage: () => 'Password is too common',
      },
    });
  };
}
