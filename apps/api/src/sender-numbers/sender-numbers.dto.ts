import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateSenderNumberDto {
  @ApiProperty({ example: '0212345678' })
  @IsString()
  phoneNumber!: string;

  @ApiProperty({
    enum: ['COMPANY', 'EMPLOYEE'],
    description: 'COMPANY=회사 번호, EMPLOYEE=타인 번호'
  })
  @IsEnum(['COMPANY', 'EMPLOYEE'])
  type!: 'COMPANY' | 'EMPLOYEE';
}

export class ReviewSenderNumberDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  memo?: string;
}
