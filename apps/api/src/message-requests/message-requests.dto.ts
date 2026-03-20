import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty({ example: 'tenant_demo' })
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

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

export class MessageRequestResponseDto {
  @ApiProperty()
  requestId!: string;

  @ApiProperty({ enum: ['ACCEPTED', 'PROCESSING', 'SENT_TO_PROVIDER', 'DELIVERED', 'DELIVERY_FAILED', 'SEND_FAILED', 'CANCELED', 'DEAD'] })
  status!: string;

  @ApiProperty({ required: false })
  idempotent?: boolean;
}

export class CreateManualSmsRequestDto {
  @ApiProperty({ example: 'sender_number_id' })
  @IsString()
  @IsNotEmpty()
  senderNumberId!: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @IsNotEmpty()
  recipientPhone!: string;

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

  @ApiProperty({ example: 'GROUP', required: false, enum: ['LOCAL', 'GROUP'] })
  @IsString()
  @IsOptional()
  @IsIn(['LOCAL', 'GROUP'])
  templateSource?: 'LOCAL' | 'GROUP';

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

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @IsNotEmpty()
  recipientPhone!: string;

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
