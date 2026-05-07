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
  @ApiProperty({ required: false, description: '검수 요청으로 전환할 로컬 임시저장 템플릿 ID' })
  @IsOptional()
  @IsString()
  draftTemplateId?: string;

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

export class SaveV2KakaoTemplateDraftActionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  type?: string;

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

export class SaveV2KakaoTemplateDraftDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  draftTemplateId?: string;

  @ApiProperty({ required: false, enum: ['GROUP', 'SENDER_PROFILE'] })
  @Transform(({ value }) => (value === 'DEFAULT_GROUP' ? 'GROUP' : value))
  @IsOptional()
  @IsString()
  @IsIn(['GROUP', 'SENDER_PROFILE'])
  targetType?: 'GROUP' | 'SENDER_PROFILE';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  senderProfileId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  templateCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  body?: string;

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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  categoryCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  securityFlag?: boolean;

  @ApiProperty({ required: false, type: [SaveV2KakaoTemplateDraftActionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveV2KakaoTemplateDraftActionDto)
  buttons?: SaveV2KakaoTemplateDraftActionDto[];

  @ApiProperty({ required: false, type: [SaveV2KakaoTemplateDraftActionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveV2KakaoTemplateDraftActionDto)
  quickReplies?: SaveV2KakaoTemplateDraftActionDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceEventKey?: string;
}

export class GetV2KakaoTemplateDraftsQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sourceEventKey?: string;
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

export class DeleteV2KakaoTemplateQueryDto extends GetV2KakaoTemplateDetailQueryDto {}

export class CreateV2BrandTemplateButtonDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(14)
  name!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  type!: string;

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
  schemeAndroid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeIos?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  chatExtra?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  chatEvent?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bizFormKey?: string;
}

export class CreateV2BrandTemplateCouponDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

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
  schemeAndroid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeIos?: string;
}

export class CreateV2BrandTemplateImageDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageLink?: string;
}

export class CreateV2BrandTemplateWideItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

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
  schemeAndroid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeIos?: string;
}

export class CreateV2BrandTemplateWideItemContainerDto {
  @ApiProperty({ type: [CreateV2BrandTemplateWideItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateV2BrandTemplateWideItemDto)
  list!: CreateV2BrandTemplateWideItemDto[];
}

export class CreateV2BrandTemplateVideoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  videoUrl!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;
}

export class CreateV2BrandTemplateCommerceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  regularPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  discountPrice?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  discountRate?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  discountFixed?: number;
}

export class CreateV2BrandTemplateCarouselHeadDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  header?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

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
  schemeAndroid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeIos?: string;
}

export class CreateV2BrandTemplateCarouselTailDto {
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
  schemeAndroid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  schemeIos?: string;
}

export class CreateV2BrandTemplateCarouselItemDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  header?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  additionalContent?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  imageUrl!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  imageLink?: string;

  @ApiProperty({ required: false, type: [CreateV2BrandTemplateButtonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateV2BrandTemplateButtonDto)
  buttons?: CreateV2BrandTemplateButtonDto[];

  @ApiProperty({ required: false, type: CreateV2BrandTemplateCouponDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateCouponDto)
  coupon?: CreateV2BrandTemplateCouponDto;

  @ApiProperty({ required: false, type: CreateV2BrandTemplateCommerceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateCommerceDto)
  commerce?: CreateV2BrandTemplateCommerceDto;
}

export class CreateV2BrandTemplateCarouselDto {
  @ApiProperty({ required: false, type: CreateV2BrandTemplateCarouselHeadDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateCarouselHeadDto)
  head?: CreateV2BrandTemplateCarouselHeadDto;

  @ApiProperty({ type: [CreateV2BrandTemplateCarouselItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateV2BrandTemplateCarouselItemDto)
  list!: CreateV2BrandTemplateCarouselItemDto[];

  @ApiProperty({ required: false, type: CreateV2BrandTemplateCarouselTailDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateCarouselTailDto)
  tail?: CreateV2BrandTemplateCarouselTailDto;
}

export class CreateV2BrandTemplateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senderProfileId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  templateName!: string;

  @ApiProperty({
    enum: ['TEXT', 'IMAGE', 'WIDE', 'WIDE_ITEM_LIST', 'PREMIUM_VIDEO', 'COMMERCE', 'CAROUSEL_FEED', 'CAROUSEL_COMMERCE']
  })
  @IsString()
  @IsIn(['TEXT', 'IMAGE', 'WIDE', 'WIDE_ITEM_LIST', 'PREMIUM_VIDEO', 'COMMERCE', 'CAROUSEL_FEED', 'CAROUSEL_COMMERCE'])
  chatBubbleType!: 'TEXT' | 'IMAGE' | 'WIDE' | 'WIDE_ITEM_LIST' | 'PREMIUM_VIDEO' | 'COMMERCE' | 'CAROUSEL_FEED' | 'CAROUSEL_COMMERCE';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  adult?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  header?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  additionalContent?: string;

  @ApiProperty({ required: false, type: CreateV2BrandTemplateImageDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateImageDto)
  image?: CreateV2BrandTemplateImageDto;

  @ApiProperty({ required: false, type: [CreateV2BrandTemplateButtonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateV2BrandTemplateButtonDto)
  buttons?: CreateV2BrandTemplateButtonDto[];

  @ApiProperty({ required: false, type: CreateV2BrandTemplateWideItemContainerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateWideItemContainerDto)
  item?: CreateV2BrandTemplateWideItemContainerDto;

  @ApiProperty({ required: false, type: CreateV2BrandTemplateCouponDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateCouponDto)
  coupon?: CreateV2BrandTemplateCouponDto;

  @ApiProperty({ required: false, type: CreateV2BrandTemplateCommerceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateCommerceDto)
  commerce?: CreateV2BrandTemplateCommerceDto;

  @ApiProperty({ required: false, type: CreateV2BrandTemplateVideoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateVideoDto)
  video?: CreateV2BrandTemplateVideoDto;

  @ApiProperty({ required: false, type: CreateV2BrandTemplateCarouselDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateV2BrandTemplateCarouselDto)
  carousel?: CreateV2BrandTemplateCarouselDto;
}

export class UpdateV2BrandTemplateDto extends CreateV2BrandTemplateDto {}

export class GetV2BrandTemplateDetailQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senderProfileId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  templateCode!: string;
}

export class DeleteV2BrandTemplateQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  senderProfileId!: string;
}

export class UploadV2BrandTemplateImageDto {
  @ApiProperty({
    enum: [
      'IMAGE',
      'WIDE_IMAGE',
      'MAIN_WIDE_ITEMLIST_IMAGE',
      'NORMAL_WIDE_ITEMLIST_IMAGE',
      'CAROUSEL_FEED_IMAGE',
      'CAROUSEL_COMMERCE_IMAGE'
    ]
  })
  @IsString()
  @IsIn([
    'IMAGE',
    'WIDE_IMAGE',
    'MAIN_WIDE_ITEMLIST_IMAGE',
    'NORMAL_WIDE_ITEMLIST_IMAGE',
    'CAROUSEL_FEED_IMAGE',
    'CAROUSEL_COMMERCE_IMAGE'
  ])
  imageType!: 'IMAGE' | 'WIDE_IMAGE' | 'MAIN_WIDE_ITEMLIST_IMAGE' | 'NORMAL_WIDE_ITEMLIST_IMAGE' | 'CAROUSEL_FEED_IMAGE' | 'CAROUSEL_COMMERCE_IMAGE';
}
