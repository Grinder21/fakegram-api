import {
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePhotoDto {
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Неверный формат URL' },
  )
  @MaxLength(2048)
  url!: string;

  @IsUUID()
  albumId!: string;

  @IsOptional()
  @MaxLength(2048)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Неверный формат URL' },
  )
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}
