import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class NotionRecipientMappingsDto {
  @ApiProperty({ required: false, example: '이름' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false, example: '전화번호' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false, example: '이메일' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, example: '상태' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ required: false, example: '유형' })
  @IsString()
  @IsOptional()
  userType?: string;

  @ApiProperty({ required: false, example: '세그먼트' })
  @IsString()
  @IsOptional()
  segment?: string;

  @ApiProperty({ required: false, example: '등급' })
  @IsString()
  @IsOptional()
  gradeOrLevel?: string;

  @ApiProperty({ required: false, example: '마케팅 수신 동의' })
  @IsString()
  @IsOptional()
  marketingConsent?: string;

  @ApiProperty({ required: false, example: '가입일' })
  @IsString()
  @IsOptional()
  registeredAt?: string;

  @ApiProperty({ required: false, example: '최근 로그인' })
  @IsString()
  @IsOptional()
  lastLoginAt?: string;

  @ApiProperty({ required: false, example: '태그' })
  @IsString()
  @IsOptional()
  tags?: string;
}

export class SyncNotionRecipientsDto {
  @ApiProperty({ example: 'd9824bdc-8445-4327-be8b-5b47500af6ce' })
  @IsString()
  @IsNotEmpty()
  dataSourceId!: string;

  @ApiProperty({ type: NotionRecipientMappingsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => NotionRecipientMappingsDto)
  mappings!: NotionRecipientMappingsDto;
}
