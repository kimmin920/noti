import { ApiProperty } from '@nestjs/swagger';
import { Sms080ServiceType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateSms080ApplicationDto {
  @ApiProperty({
    enum: Sms080ServiceType,
    description: 'NHN_MANAGED=신규 080 번호 신청, EXTERNAL=이미 보유한 080 번호 등록'
  })
  @IsEnum(Sms080ServiceType)
  type!: Sms080ServiceType;

  @ApiProperty({ required: false, example: '08012345678' })
  @IsString()
  @IsOptional()
  unsubscribeNumber?: string;

  @ApiProperty({ required: false, example: '비즈우' })
  @IsString()
  @IsOptional()
  businessName?: string;

  @ApiProperty({ required: false, example: '외부 080 제공 업체' })
  @IsString()
  @IsOptional()
  providerName?: string;
}

export class ReviewSms080ApplicationDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  memo?: string;

  @ApiProperty({ required: false, example: '08012345678' })
  @IsString()
  @IsOptional()
  unsubscribeNumber?: string;
}
