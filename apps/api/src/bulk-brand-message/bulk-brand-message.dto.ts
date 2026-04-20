import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class BulkBrandMessageButtonDto {
  @ApiProperty({ enum: ['WL', 'AL', 'BK', 'MD'], example: 'WL' })
  @IsString()
  @IsIn(['WL', 'AL', 'BK', 'MD'])
  type!: 'WL' | 'AL' | 'BK' | 'MD';

  @ApiProperty({ example: '자세히 보기' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(14)
  name!: string;

  @ApiProperty({ required: false, example: 'https://example.com/mobile' })
  @IsString()
  @IsOptional()
  linkMo?: string;

  @ApiProperty({ required: false, example: 'https://example.com/pc' })
  @IsString()
  @IsOptional()
  linkPc?: string;

  @ApiProperty({ required: false, example: 'myapp://details' })
  @IsString()
  @IsOptional()
  schemeIos?: string;

  @ApiProperty({ required: false, example: 'myapp://details' })
  @IsString()
  @IsOptional()
  schemeAndroid?: string;
}

export class BulkBrandMessageImageDto {
  @ApiProperty({ required: false, example: 'https://cdn.example.com/image.png' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ required: false, example: 'https://example.com/landing' })
  @IsString()
  @IsOptional()
  imageLink?: string;
}

export class BulkBrandTemplateVariableMappingDto {
  @ApiProperty({ example: 'username' })
  @IsString()
  templateVariable!: string;

  @ApiProperty({ example: 'name' })
  @IsString()
  userFieldKey!: string;
}

export class CreateBulkBrandMessageCampaignDto {
  @ApiProperty({ required: false, example: '4월 친구 대상 안내' })
  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @ApiProperty({ example: 'sender_profile_id' })
  @IsString()
  @IsNotEmpty()
  senderProfileId!: string;

  @ApiProperty({ required: false, enum: ['FREESTYLE', 'TEMPLATE'], example: 'FREESTYLE' })
  @IsString()
  @IsIn(['FREESTYLE', 'TEMPLATE'])
  @IsOptional()
  mode?: 'FREESTYLE' | 'TEMPLATE';

  @ApiProperty({
    required: false,
    enum: ['TEXT', 'IMAGE', 'WIDE', 'WIDE_ITEM_LIST', 'CAROUSEL_FEED', 'PREMIUM_VIDEO', 'COMMERCE', 'CAROUSEL_COMMERCE'],
    example: 'TEXT'
  })
  @IsString()
  @IsIn(['TEXT', 'IMAGE', 'WIDE', 'WIDE_ITEM_LIST', 'CAROUSEL_FEED', 'PREMIUM_VIDEO', 'COMMERCE', 'CAROUSEL_COMMERCE'])
  @IsOptional()
  messageType?:
    | 'TEXT'
    | 'IMAGE'
    | 'WIDE'
    | 'WIDE_ITEM_LIST'
    | 'CAROUSEL_FEED'
    | 'PREMIUM_VIDEO'
    | 'COMMERCE'
    | 'CAROUSEL_COMMERCE';

  @ApiProperty({ required: false, example: '브랜드 메시지 예시 본문입니다.' })
  @IsString()
  @MaxLength(1300)
  @IsOptional()
  content?: string;

  @ApiProperty({ required: false, example: 'TPL_BRAND_WELCOME' })
  @IsString()
  @IsOptional()
  templateCode?: string;

  @ApiProperty({ required: false, example: '브랜드 환영 안내' })
  @IsString()
  @IsOptional()
  templateName?: string;

  @ApiProperty({ required: false, example: '안녕하세요 #{username}님' })
  @IsString()
  @IsOptional()
  templateBody?: string;

  @ApiProperty({ required: false, type: [String], example: ['username'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredVariables?: string[];

  @ApiProperty({ required: false, example: true })
  @IsBoolean()
  @IsOptional()
  pushAlarm?: boolean;

  @ApiProperty({ required: false, example: false })
  @IsBoolean()
  @IsOptional()
  adult?: boolean;

  @ApiProperty({ required: false, example: 'evt_brand_launch' })
  @IsString()
  @IsOptional()
  statsEventKey?: string;

  @ApiProperty({ required: false, example: '123456789' })
  @IsString()
  @IsOptional()
  resellerCode?: string;

  @ApiProperty({ required: false, type: [BulkBrandMessageButtonDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BulkBrandMessageButtonDto)
  buttons?: BulkBrandMessageButtonDto[];

  @ApiProperty({ required: false, type: BulkBrandMessageImageDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BulkBrandMessageImageDto)
  image?: BulkBrandMessageImageDto;

  @ApiProperty({ type: [String], example: ['managed_user_id_1', 'managed_user_id_2'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  userIds!: string[];

  @ApiProperty({
    required: false,
    type: [BulkBrandTemplateVariableMappingDto],
    example: [
      { templateVariable: 'username', userFieldKey: 'name' },
      { templateVariable: 'couponName', userFieldKey: 'segment' }
    ]
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => BulkBrandTemplateVariableMappingDto)
  templateVariableMappings?: BulkBrandTemplateVariableMappingDto[];

  @ApiProperty({
    required: false,
    example: '2026-04-17T12:30:00.000Z',
    description: '즉시 발송이 아니라면 예약 발송 시각(ISO 8601)'
  })
  @IsString()
  @IsISO8601()
  @IsOptional()
  scheduledAt?: string;
}
