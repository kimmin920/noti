import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateDashboardSettingsDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  autoRechargeEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  lowBalanceAlertEnabled?: boolean;
}

export class CreateDashboardNoticeDto {
  @ApiProperty({ example: '서비스 점검 안내' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ example: '오늘 22:00부터 22:30까지 점검이 진행됩니다.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPinned?: boolean;
}

export class UpdateDashboardNoticeDto {
  @ApiPropertyOptional({ example: '서비스 점검 안내' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({ example: '오늘 22:00부터 22:30까지 점검이 진행됩니다.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  body?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPinned?: boolean;
}

export class UpdateDashboardQuotaDto {
  @ApiProperty({ example: 1000 })
  @Type(() => Number)
  @Min(1)
  dailySendLimit!: number;
}
