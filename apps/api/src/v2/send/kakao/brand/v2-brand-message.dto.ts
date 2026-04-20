import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export {
  BrandMessageButtonDto,
  BrandMessageImageDto,
  CreateManualBrandMessageRequestDto
} from '../../../../message-requests/message-requests.dto';

export class UploadV2BrandMessageImageDto {
  @ApiProperty({ enum: ['IMAGE', 'WIDE'] })
  @IsString()
  @IsIn(['IMAGE', 'WIDE'])
  messageType!: 'IMAGE' | 'WIDE';
}
