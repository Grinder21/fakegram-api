import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS!: number;

  @IsEnum(Environment)
  NODE_ENV!: Environment;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @Matches(/^postgres(ql)?:\/\//)
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @Matches(/^\d+(s|m|h|d)$/)
  ACCESS_TOKEN_TTL!: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  COOKIE_SECURE: boolean = false;

  @IsUrl({ require_tld: false })
  CLIENT_ORIGIN: string = 'http://localhost:5173';
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
