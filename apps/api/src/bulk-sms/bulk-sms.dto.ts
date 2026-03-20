import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class BulkSmsTemplateVariableMappingDto {
  @ApiProperty({ example: 'username' })
  @IsString()
  templateVariable!: string;

  @ApiProperty({ example: 'name' })
  @IsString()
  userFieldKey!: string;
}

export class CreateBulkSmsCampaignDto {
  @ApiProperty({ required: false, example: '3월 신규 가입자 안내' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ example: 'sender_number_id' })
  @IsString()
  senderNumberId!: string;

  @ApiProperty({ required: false, example: 'template_id' })
  @IsString()
  @IsOptional()
  templateId?: string;

  @ApiProperty({ required: false, example: '안녕하세요. 공지드립니다.' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  body?: string;

  @ApiProperty({
    required: false,
    example: true,
    description: '광고 문자 발송 여부. true면 (광고) 서비스명과 무료수신거부 문구를 자동 추가합니다.'
  })
  @IsBoolean()
  @IsOptional()
  isAdvertisement?: boolean;

  @ApiProperty({
    required: false,
    example: '비주오',
    description: '광고 문자 상단에 붙는 광고 서비스명. 비워두면 (광고)만 표시됩니다.'
  })
  @IsString()
  @IsOptional()
  advertisingServiceName?: string;

  @ApiProperty({ type: [String], example: ['managed_user_id_1', 'managed_user_id_2'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  userIds!: string[];

  @ApiProperty({
    required: false,
    type: [BulkSmsTemplateVariableMappingDto],
    example: [
      { templateVariable: 'username', userFieldKey: 'name' },
      { templateVariable: 'level', userFieldKey: 'gradeOrLevel' }
    ]
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkSmsTemplateVariableMappingDto)
  templateVariableMappings?: BulkSmsTemplateVariableMappingDto[];

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
