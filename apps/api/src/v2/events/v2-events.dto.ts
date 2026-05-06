import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senderProfileId!: string;
}
