import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class BulkAlimtalkTemplateVariableMappingDto {
  @ApiProperty({ example: 'username' })
  @IsString()
  templateVariable!: string;

  @ApiProperty({ example: 'name' })
  @IsString()
  userFieldKey!: string;
}

export class CreateBulkAlimtalkCampaignDto {
  @ApiProperty({ required: false, example: '3월 회원 등급 안내' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ example: 'sender_profile_id' })
  @IsString()
  senderProfileId!: string;

  @ApiProperty({ required: false, example: 'provider_template_id' })
  @IsOptional()
  @IsString()
  providerTemplateId?: string;

  @ApiProperty({ required: false, example: 'GROUP' })
  @IsOptional()
  @IsString()
  templateSource?: string;

  @ApiProperty({ required: false, example: 'TPLWELCOME01' })
  @IsOptional()
  @IsString()
  templateCode?: string;

  @ApiProperty({ required: false, example: '수강 안내' })
  @IsOptional()
  @IsString()
  templateName?: string;

  @ApiProperty({ required: false, example: '안녕하세요 {{username}}님, 수강이 시작됩니다.' })
  @IsOptional()
  @IsString()
  templateBody?: string;

  @ApiProperty({ type: [String], example: ['managed_user_id_1', 'managed_user_id_2'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  userIds!: string[];

  @ApiProperty({
    required: false,
    type: [BulkAlimtalkTemplateVariableMappingDto],
    example: [
      { templateVariable: 'username', userFieldKey: 'name' },
      { templateVariable: 'ticketName', userFieldKey: 'segment' }
    ]
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkAlimtalkTemplateVariableMappingDto)
  templateVariableMappings?: BulkAlimtalkTemplateVariableMappingDto[];

  @ApiProperty({
    required: false,
    example: '2026-03-17T12:30:00.000Z',
    description: '즉시 발송이 아니라면 예약 발송 시각(ISO 8601)'
  })
  @IsString()
  @IsISO8601()
  @IsOptional()
  scheduledAt?: string;
}
