import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpsertEventRuleDto {
  @ApiProperty()
  @IsString()
  eventKey!: string;

  @ApiProperty()
  @IsString()
  displayName!: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ enum: ['SMS_ONLY', 'ALIMTALK_ONLY', 'ALIMTALK_THEN_SMS'] })
  @IsEnum(['SMS_ONLY', 'ALIMTALK_ONLY', 'ALIMTALK_THEN_SMS'])
  channelStrategy!: 'SMS_ONLY' | 'ALIMTALK_ONLY' | 'ALIMTALK_THEN_SMS';

  @ApiProperty({ default: 'NORMAL' })
  @IsEnum(['NORMAL'])
  messagePurpose!: 'NORMAL';

  @ApiProperty({ type: [String] })
  @IsArray()
  requiredVariables!: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  smsTemplateId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  smsSenderNumberId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  alimtalkTemplateId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  alimtalkSenderProfileId?: string;
}
