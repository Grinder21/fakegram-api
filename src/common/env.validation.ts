import { plainToInstance, Type } from 'class-transformer';
import { IsInt, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS!: number;
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
