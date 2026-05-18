import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  ArrayNotEmpty,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const MANUAL_MESSAGE_RECIPIENT_LIMIT = 100;

function normalizeRecipientPhonesInput(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? parseRecipientPhonesString(value)
      : [];
  const seen = new Set<string>();
  const phones: string[] = [];

  for (const item of rawItems) {
    const phone = String(item).trim();
    const key = phone.replace(/\D/g, '');
    if (!phone || !key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    phones.push(phone);
  }

  return phones.length > 0 ? phones : undefined;
}

function parseRecipientPhonesString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Accept plain text pasted into multipart forms.
  }

  return trimmed.split(/[\n,;]+/);
}

function normalizeTemplateAttachmentFileIds(value: unknown) {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? parseTemplateAttachmentFileIdsString(value)
      : [];
  const seen = new Set<number>();
  const fileIds: number[] = [];

  for (const item of rawItems) {
    const fileId = Number(item);
    if (!Number.isInteger(fileId) || fileId <= 0 || seen.has(fileId)) {
      continue;
    }

    seen.add(fileId);
    fileIds.push(fileId);
  }

  return fileIds.length > 0 ? fileIds : undefined;
}

function parseTemplateAttachmentFileIdsString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Accept comma-separated ids from multipart forms.
  }

  return trimmed.split(/[\n,;]+/);
}

function hasRecipientPhones(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

class RecipientDto {
  @ApiProperty({ example: '01012345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: 'publ_user_abc', required: false })
  @IsString()
  @IsOptional()
  userId?: string;
}

export class CreateMessageRequestDto {
  @ApiProperty({ example: 'google:1234567890' })
  @IsString()
  @IsNotEmpty()
  ownerUserId!: string;

  @ApiProperty({ example: 'PUBL_USER_SIGNUP' })
  @IsString()
  @IsNotEmpty()
  eventKey!: string;

  @ApiProperty({ type: RecipientDto })
  @ValidateNested()
  @Type(() => RecipientDto)
  recipient!: RecipientDto;

  @ApiProperty({
    example: {
      username: '민우'
    }
  })
  @IsObject()
  variables!: Record<string, string | number>;

  @ApiProperty({ required: false, example: { publEventId: 'evt_001', traceId: 't_123' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string | number>;

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

export class CreatePublEventRequestDto {
  @ApiProperty({ example: 'PUBL', required: false })
  @IsString()
  @IsOptional()
  partnerKey?: string;

  @ApiProperty({ example: 'publ:business_123' })
  @IsString()
  @IsNotEmpty()
  providerUserId!: string;

  @ApiProperty({ example: 'PUBL_USER_SIGNUP' })
  @IsString()
  @IsNotEmpty()
  eventKey!: string;

  @ApiProperty({
    example: {
      targetPhoneNumber: '01012345678',
      username: '민우'
    }
  })
  @IsObject()
  props!: Record<string, unknown>;

  @ApiProperty({ required: false, example: { publEventId: 'evt_001', traceId: 't_123' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

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

export class MessageRequestResponseDto {
  @ApiProperty()
  requestId!: string;

  @ApiProperty({ required: false, type: [String] })
  requestIds?: string[];

  @ApiProperty({ required: false, example: 2 })
  acceptedCount?: number;

  @ApiProperty({
    enum: ['WAITING', 'IN_PROGRESS', 'LOOKUP_FAILED', 'SENT_TO_PROVIDER', 'DELIVERED', 'DELIVERY_FAILED', 'SEND_FAILED', 'CANCELED', 'DEAD']
  })
  status!: string;

  @ApiProperty({ required: false })
  idempotent?: boolean;
}

export class CreateManualSmsRequestDto {
  @ApiProperty({ example: 'sender_number_id' })
  @IsString()
  @IsNotEmpty()
  senderNumberId!: string;

  @ApiProperty({ example: '01012345678', required: false })
  @ValidateIf((dto: CreateManualSmsRequestDto) => !hasRecipientPhones(dto.recipientPhones))
  @IsString()
  @IsNotEmpty()
  recipientPhone?: string;

  @ApiProperty({ example: ['01012345678', '01098765432'], required: false, type: [String], maxItems: MANUAL_MESSAGE_RECIPIENT_LIMIT })
  @Transform(({ value }) => normalizeRecipientPhonesInput(value))
  @ValidateIf((dto: CreateManualSmsRequestDto) => hasRecipientPhones(dto.recipientPhones))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MANUAL_MESSAGE_RECIPIENT_LIMIT)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  recipientPhones?: string[];

  @ApiProperty({ example: '안녕하세요. 테스트용 직접 SMS입니다.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body!: string;

  @ApiProperty({
    example: '상품 이미지 안내',
    required: false,
    description: 'MMS 발송 시 사용할 제목. 비워두면 본문 첫 줄로 자동 생성됩니다.'
  })
  @IsString()
  @IsOptional()
  mmsTitle?: string;

  @ApiProperty({
    example: [321],
    required: false,
    type: [Number],
    maxItems: 3,
    description: 'SMS 템플릿에서 가져온 NHN MMS 첨부 파일 ID'
  })
  @Transform(({ value }) => normalizeTemplateAttachmentFileIds(value))
  @IsArray()
  @ArrayMaxSize(3)
  @IsInt({ each: true })
  @IsOptional()
  templateAttachmentFileIds?: number[];

  @ApiProperty({
    example: true,
    required: false,
    description: '광고 문자 발송 여부. true면 (광고) 서비스명과 무료수신거부 문구를 자동 추가합니다.'
  })
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isAdvertisement?: boolean;

  @ApiProperty({
    example: '비주오',
    required: false,
    description: '광고 문자 상단에 붙는 광고 서비스명. 비워두면 (광고)만 표시됩니다.'
  })
  @IsString()
  @IsOptional()
  advertisingServiceName?: string;

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

export class CreateManualAlimtalkRequestDto {
  @ApiProperty({ example: 'sender_profile_id' })
  @IsString()
  @IsNotEmpty()
  senderProfileId!: string;

  @ApiProperty({ example: 'provider_template_id', required: false })
  @IsString()
  @IsOptional()
  providerTemplateId?: string;

  @ApiProperty({ example: 'NHN', required: false, enum: ['LOCAL', 'GROUP', 'NHN'] })
  @IsString()
  @IsOptional()
  @IsIn(['LOCAL', 'GROUP', 'NHN'])
  templateSource?: 'LOCAL' | 'GROUP' | 'NHN';

  @ApiProperty({ example: 'WELCOME001', required: false })
  @IsString()
  @IsOptional()
  templateCode?: string;

  @ApiProperty({ example: '가입인사', required: false })
  @IsString()
  @IsOptional()
  templateName?: string;

  @ApiProperty({ example: '#{username}님 가입을 환영합니다.', required: false })
  @IsString()
  @IsOptional()
  templateBody?: string;

  @ApiProperty({ example: ['username'], required: false, type: [String] })
  @IsArray()
  @IsOptional()
  requiredVariables?: string[];

  @ApiProperty({ example: '01012345678', required: false })
  @ValidateIf((dto: CreateManualAlimtalkRequestDto) => !hasRecipientPhones(dto.recipientPhones))
  @IsString()
  @IsNotEmpty()
  recipientPhone?: string;

  @ApiProperty({ example: ['01012345678', '01098765432'], required: false, type: [String], maxItems: MANUAL_MESSAGE_RECIPIENT_LIMIT })
  @Transform(({ value }) => normalizeRecipientPhonesInput(value))
  @ValidateIf((dto: CreateManualAlimtalkRequestDto) => hasRecipientPhones(dto.recipientPhones))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MANUAL_MESSAGE_RECIPIENT_LIMIT)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  recipientPhones?: string[];

  @ApiProperty({
    example: true,
    required: false,
    description: 'NHN SMS failover: 카카오톡 전달 실패 시 SMS/LMS로 대체 발송'
  })
  @IsBoolean()
  @IsOptional()
  useSmsFailover?: boolean;

  @ApiProperty({
    example: 'sender_number_id',
    required: false,
    description: 'SMS failover에 사용할 승인된 발신번호 ID'
  })
  @IsString()
  @IsOptional()
  fallbackSenderNumberId?: string;

  @ApiProperty({
    example: {
      username: '민우',
      ticketName: 'VIP'
    }
  })
  @IsObject()
  variables!: Record<string, string | number>;

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

export class BrandMessageButtonDto {
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

export class BrandMessageImageDto {
  @ApiProperty({ required: false, example: 'asset_123' })
  @IsString()
  @IsOptional()
  assetId?: string;

  @ApiProperty({ required: false, example: 'https://cdn.example.com/image.png' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ required: false, example: 'https://example.com/landing' })
  @IsString()
  @IsOptional()
  imageLink?: string;
}

export class CreateManualBrandMessageRequestDto {
  @ApiProperty({ example: 'sender_profile_id' })
  @IsString()
  @IsNotEmpty()
  senderProfileId!: string;

  @ApiProperty({ enum: ['FREESTYLE', 'TEMPLATE'], example: 'FREESTYLE' })
  @IsString()
  @IsIn(['FREESTYLE', 'TEMPLATE'])
  mode!: 'FREESTYLE' | 'TEMPLATE';

  @ApiProperty({ enum: ['I', 'M', 'N'], example: 'I' })
  @IsString()
  @IsIn(['I', 'M', 'N'])
  targeting!: 'I' | 'M' | 'N';

  @ApiProperty({
    enum: ['TEXT', 'IMAGE', 'WIDE', 'WIDE_ITEM_LIST', 'CAROUSEL_FEED', 'PREMIUM_VIDEO', 'COMMERCE', 'CAROUSEL_COMMERCE'],
    example: 'TEXT',
    required: false
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

  @ApiProperty({ example: '01012345678', required: false })
  @ValidateIf((dto: CreateManualBrandMessageRequestDto) => !hasRecipientPhones(dto.recipientPhones))
  @IsString()
  @IsNotEmpty()
  recipientPhone?: string;

  @ApiProperty({ example: ['01012345678', '01098765432'], required: false, type: [String], maxItems: MANUAL_MESSAGE_RECIPIENT_LIMIT })
  @Transform(({ value }) => normalizeRecipientPhonesInput(value))
  @ValidateIf((dto: CreateManualBrandMessageRequestDto) => hasRecipientPhones(dto.recipientPhones))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MANUAL_MESSAGE_RECIPIENT_LIMIT)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  recipientPhones?: string[];

  @ApiProperty({ required: false, example: 'BRAND_TEMPLATE_001' })
  @IsString()
  @IsOptional()
  templateCode?: string;

  @ApiProperty({ required: false, example: '신상품 안내 템플릿' })
  @IsString()
  @IsOptional()
  templateName?: string;

  @ApiProperty({ required: false, example: '#{username}님을 위한 신상품 안내입니다.' })
  @IsString()
  @IsOptional()
  templateBody?: string;

  @ApiProperty({ example: ['username'], required: false, type: [String] })
  @IsArray()
  @IsOptional()
  requiredVariables?: string[];

  @ApiProperty({
    required: false,
    example: {
      username: '민우'
    }
  })
  @IsObject()
  @IsOptional()
  variables?: Record<string, string | number>;

  @ApiProperty({ required: false, example: '브랜드 메시지 예시 본문입니다.' })
  @IsString()
  @IsOptional()
  @MaxLength(1300)
  content?: string;

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

  @ApiProperty({ required: false, type: [BrandMessageButtonDto] })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => BrandMessageButtonDto)
  buttons?: BrandMessageButtonDto[];

  @ApiProperty({ required: false, type: BrandMessageImageDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BrandMessageImageDto)
  image?: BrandMessageImageDto;

  @ApiProperty({
    required: false,
    example: '2026-04-06T12:30:00.000Z',
    description: '즉시 발송이 아니라면 예약 발송 시각(ISO 8601)'
  })
  @IsString()
  @IsISO8601()
  @IsOptional()
  scheduledAt?: string;
}
