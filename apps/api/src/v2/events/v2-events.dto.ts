import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertV2PublEventKakaoBindingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventKey!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  providerTemplateId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  kakaoTemplateCatalogId?: string;

  @ApiProperty({ enum: ['DEFAULT', 'CUSTOM'], required: false })
  @IsEnum(['DEFAULT', 'CUSTOM'])
  @IsOptional()
  templateBindingMode?: 'DEFAULT' | 'CUSTOM';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senderProfileId!: string;
}
