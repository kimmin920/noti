import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

const EVENT_STATUSES = ['ACTIVE', 'INACTIVE', 'DRAFT'] as const;
const PROP_TYPES = ['text', 'number', 'datetime', 'boolean', 'enum', 'object', 'array'] as const;

export class V2PublEventPropDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty()
  @IsString()
  rawPath!: string;

  @ApiProperty()
  @IsString()
  alias!: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty({ enum: PROP_TYPES })
  @IsString()
  @IsIn(PROP_TYPES)
  type!: typeof PROP_TYPES[number];

  @ApiProperty({ default: false })
  @IsBoolean()
  required!: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sample?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fallback?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  parserPipeline?: unknown;

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ default: 0 })
  @IsInt()
  @IsOptional()
  sortOrder?: number;
}

export class UpsertV2PublEventDto {
  @ApiProperty()
  @IsString()
  eventKey!: string;

  @ApiProperty()
  @IsString()
  displayName!: string;

  @ApiProperty()
  @IsString()
  category!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pAppCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  pAppName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  triggerText?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  detailText?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultTemplateBody?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultTemplateSource?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultTemplateOwnerKey?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultTemplateOwnerLabel?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultTemplateName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultTemplateCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultKakaoTemplateCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultTemplateStatus?: string;

  @ApiProperty({ enum: EVENT_STATUSES })
  @IsString()
  @IsIn(EVENT_STATUSES)
  serviceStatus!: typeof EVENT_STATUSES[number];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  locationType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  locationId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sourceType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  actionType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  docsVersion?: string;

  @ApiProperty({ type: [V2PublEventPropDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => V2PublEventPropDto)
  props!: V2PublEventPropDto[];
}
