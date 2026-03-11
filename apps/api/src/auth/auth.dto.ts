import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MeResponseDto {
  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  publUserId!: string;

  @ApiProperty({ required: false, nullable: true })
  email!: string | null;

  @ApiProperty({ enum: ['GOOGLE_OAUTH', 'PUBL_SSO', 'LOCAL_PASSWORD'] })
  loginProvider!: 'GOOGLE_OAUTH' | 'PUBL_SSO' | 'LOCAL_PASSWORD';

  @ApiProperty({ enum: ['TENANT_ADMIN', 'OPERATOR'] })
  role!: 'TENANT_ADMIN' | 'OPERATOR';
}

export class PasswordLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  loginId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password!: string;
}
