import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MeResponseDto {
  @ApiProperty()
  tenantId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  providerUserId!: string;

  @ApiProperty({ required: false, nullable: true })
  email!: string | null;

  @ApiProperty({ enum: ['GOOGLE_OAUTH', 'PUBL_SSO', 'LOCAL_PASSWORD'] })
  loginProvider!: 'GOOGLE_OAUTH' | 'PUBL_SSO' | 'LOCAL_PASSWORD';

  @ApiProperty({ enum: ['TENANT_ADMIN', 'PARTNER_ADMIN', 'SUPER_ADMIN'] })
  role!: 'TENANT_ADMIN' | 'PARTNER_ADMIN' | 'SUPER_ADMIN';

  @ApiProperty({ enum: ['DIRECT', 'PUBL'] })
  accessOrigin!: 'DIRECT' | 'PUBL';

  @ApiProperty({ enum: ['DIRECT', 'PUBL'], required: false, nullable: true })
  partnerScope!: 'DIRECT' | 'PUBL' | null;
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
