import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(256)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;
}
