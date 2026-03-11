import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListSenderProfilesDto {
  @ApiProperty({ required: false, example: 'my-kakao-channel' })
  @IsOptional()
  @IsString()
  plusFriendId?: string;

  @ApiProperty({ required: false, example: '@abcd1234efgh5678ijkl9012mnop3456' })
  @IsOptional()
  @IsString()
  senderKey?: string;

  @ApiProperty({ required: false, example: 'YSC03' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false, example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageNum?: number;

  @ApiProperty({ required: false, example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class CreateSenderProfileApplicationDto {
  @ApiProperty({ example: 'my-kakao-channel' })
  @IsString()
  @IsNotEmpty()
  plusFriendId!: string;

  @ApiProperty({ example: '01012345678' })
  @IsString()
  @IsNotEmpty()
  phoneNo!: string;

  @ApiProperty({ example: '00100010001' })
  @IsString()
  @IsNotEmpty()
  categoryCode!: string;
}

export class VerifySenderProfileTokenDto {
  @ApiProperty({ example: 'my-kakao-channel' })
  @IsString()
  @IsNotEmpty()
  plusFriendId!: string;

  @ApiProperty({ example: 12345678 })
  @Type(() => Number)
  @IsInt()
  token!: number;
}
