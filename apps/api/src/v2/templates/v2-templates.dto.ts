import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class CreateV2KakaoTemplateButtonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(14)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  linkMo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  linkPc?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeIos?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeAndroid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bizFormId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pluginId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telNumber?: string;
}

export class CreateV2KakaoTemplateQuickReplyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(14)
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  linkMo?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  linkPc?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeIos?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeAndroid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  bizFormId?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pluginId?: string;
}

export class CreateV2KakaoTemplateDto {
  @ApiProperty({ enum: ['GROUP', 'SENDER_PROFILE'] })
  @Transform(({ value }) => (value === 'DEFAULT_GROUP' ? 'GROUP' : value))
  @IsString()
  @IsIn(['GROUP', 'SENDER_PROFILE'])
  targetType!: 'GROUP' | 'SENDER_PROFILE';

  @ApiProperty({ required: false, description: '등록 대상 ID (group senderKey 또는 senderProfileId)' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  senderProfileId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateCode!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiProperty({ required: false, enum: ['BA', 'AD', 'EX', 'MI'] })
  @IsOptional()
  @IsString()
  @IsIn(['BA', 'AD', 'EX', 'MI'])
  messageType?: 'BA' | 'AD' | 'EX' | 'MI';

  @ApiProperty({ required: false, enum: ['NONE', 'TEXT', 'IMAGE'] })
  @IsOptional()
  @IsString()
  @IsIn(['NONE', 'TEXT', 'IMAGE'])
  emphasizeType?: 'NONE' | 'TEXT' | 'IMAGE';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  extra?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  subtitle?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryCode!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  securityFlag?: boolean;

  @ApiProperty({ required: false, type: [CreateV2KakaoTemplateButtonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateV2KakaoTemplateButtonDto)
  buttons?: CreateV2KakaoTemplateButtonDto[];

  @ApiProperty({ required: false, type: [CreateV2KakaoTemplateQuickReplyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateV2KakaoTemplateQuickReplyDto)
  quickReplies?: CreateV2KakaoTemplateQuickReplyDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class GetV2KakaoTemplateDetailQueryDto {
  @ApiProperty({ enum: ['GROUP', 'SENDER_PROFILE'] })
  @Transform(({ value }) => (value === 'DEFAULT_GROUP' ? 'GROUP' : value))
  @IsString()
  @IsIn(['GROUP', 'SENDER_PROFILE'])
  source!: 'GROUP' | 'SENDER_PROFILE';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  ownerKey?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateCode!: string;
}
