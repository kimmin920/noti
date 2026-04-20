import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, Min } from 'class-validator';
import { AccessOrigin, UserRole } from '@prisma/client';

export class UpdateUserSmsQuotaDto {
  @ApiProperty({ example: 5000 })
  @Type(() => Number)
  @Min(0)
  monthlySmsLimit!: number;
}

export class UpdateAdminUserRoleDto {
  @ApiProperty({ enum: [UserRole.USER, UserRole.PARTNER_ADMIN] })
  @IsEnum(UserRole)
  role!: 'USER' | 'PARTNER_ADMIN';
}

export class UpdateAdminUserAccessOriginDto {
  @ApiProperty({ enum: [AccessOrigin.DIRECT, AccessOrigin.PUBL] })
  @IsEnum(AccessOrigin)
  accessOrigin!: AccessOrigin;
}
