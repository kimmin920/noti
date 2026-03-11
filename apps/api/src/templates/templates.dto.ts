import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ enum: ['SMS', 'ALIMTALK'] })
  @IsEnum(['SMS', 'ALIMTALK'])
  channel!: 'SMS' | 'ALIMTALK';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;
}

export class UpdateTemplateDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  body?: string;
}

export class PreviewTemplateDto {
  @ApiProperty({ example: { username: '민우' } })
  @IsObject()
  variables!: Record<string, string | number>;
}
