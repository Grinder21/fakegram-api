import {
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePhotoDto {
  @IsUrl({}, { message: 'Неверный формат URL' })
  url!: string;

  @IsUUID()
  albumId!: string;

  @IsOptional()
  @MaxLength(300)
  @IsUrl({}, { message: 'Неверный формат URL' })
  thumbnailUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  caption?: string;
}
