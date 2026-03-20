import { ApiProperty } from '@nestjs/swagger';
import { ManagedUserFieldType, ManagedUserStatus } from '@prisma/client';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class ImportUsersMappingDto {
  @ApiProperty({ required: false, example: 'user.profileAdditionalInformations.value' })
  @IsString()
  @IsOptional()
  sourcePath?: string;

  @ApiProperty({ required: false, example: 'member_name', deprecated: true })
  @IsString()
  @IsOptional()
  sourceKey?: string;

  @ApiProperty({ enum: ['IGNORE', 'SYSTEM', 'CUSTOM'] })
  @IsEnum(['IGNORE', 'SYSTEM', 'CUSTOM'])
  kind!: 'IGNORE' | 'SYSTEM' | 'CUSTOM';

  @ApiProperty({ required: false, example: 'name' })
  @IsString()
  @IsOptional()
  systemField?: string;

  @ApiProperty({ required: false, example: 'pointBalance' })
  @IsString()
  @IsOptional()
  customKey?: string;

  @ApiProperty({ required: false, example: '포인트 잔액' })
  @IsString()
  @IsOptional()
  customLabel?: string;

  @ApiProperty({ required: false, enum: ['TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'JSON'] })
  @IsEnum(ManagedUserFieldType)
  @IsOptional()
  dataType?: ManagedUserFieldType;
}

export class ImportUsersDto {
  @ApiProperty({ example: 'publ' })
  @IsString()
  @IsNotEmpty()
  source!: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: true
    }
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsObject({ each: true })
  records!: Record<string, unknown>[];

  @ApiProperty({ type: [ImportUsersMappingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportUsersMappingDto)
  mappings!: ImportUsersMappingDto[];
}

export class CreateManagedUserDto {
  @ApiProperty({ required: false, example: 'manual' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiProperty({ required: false, example: 'manual_user_1001' })
  @IsString()
  @IsOptional()
  externalId?: string;

  @ApiProperty({ example: '김민우' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ required: false, example: 'minu@example.com' })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, example: '01012345678' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false, enum: ManagedUserStatus, default: ManagedUserStatus.ACTIVE })
  @IsEnum(ManagedUserStatus)
  @IsOptional()
  status?: ManagedUserStatus;

  @ApiProperty({ required: false, example: '학생' })
  @IsString()
  @IsOptional()
  userType?: string;

  @ApiProperty({ required: false, example: 'Spring 5기' })
  @IsString()
  @IsOptional()
  segment?: string;

  @ApiProperty({ required: false, example: 'Gold' })
  @IsString()
  @IsOptional()
  gradeOrLevel?: string;

  @ApiProperty({ required: false, example: true })
  @IsBoolean()
  @IsOptional()
  marketingConsent?: boolean;

  @ApiProperty({ required: false, type: [String], example: ['vip', 'manual'] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ required: false, example: '2026-03-17T09:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  registeredAt?: string;

  @ApiProperty({ required: false, example: '2026-03-17T12:30:00.000Z' })
  @IsDateString()
  @IsOptional()
  lastLoginAt?: string;

  @ApiProperty({
    required: false,
    type: Object,
    additionalProperties: true,
    example: {
      note: '내부 수동 등록',
      seat: 'A-12',
      pointBalance: 12000
    }
  })
  @IsObject()
  @IsOptional()
  customAttributes?: Record<string, unknown>;
}
