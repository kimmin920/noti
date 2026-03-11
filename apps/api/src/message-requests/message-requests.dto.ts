import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
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
    example: {
      username: '민우',
      ticketName: 'VIP'
    }
  })
  @IsObject()
  variables!: Record<string, string | number>;
}
