import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MeResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  providerUserId!: string;

  @ApiProperty({ required: false, nullable: true })
  email!: string | null;

  @ApiProperty({ enum: ['GOOGLE_OAUTH', 'PUBL_SSO', 'LOCAL_PASSWORD'] })
  loginProvider!: 'GOOGLE_OAUTH' | 'PUBL_SSO' | 'LOCAL_PASSWORD';

  @ApiProperty({ enum: ['USER', 'PARTNER_ADMIN', 'SUPER_ADMIN'] })
  role!: 'USER' | 'PARTNER_ADMIN' | 'SUPER_ADMIN';

  @ApiProperty({ enum: ['DIRECT', 'PUBL'] })
  accessOrigin!: 'DIRECT' | 'PUBL';
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
