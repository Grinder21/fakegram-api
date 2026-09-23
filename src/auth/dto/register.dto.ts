import {
  IsByteLength,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username!: string;

  @IsString()
  @MinLength(8)
  @IsByteLength(0, 72, { message: 'Password must be at most 72 bytes long' })
  @Matches(/^(?=.*\p{Ll})(?=.*\p{Lu})(?=.*\d)/u, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter and one digit',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;
}
