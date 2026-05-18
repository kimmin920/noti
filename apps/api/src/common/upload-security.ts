import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';
import { MMS_ATTACHMENT_MAX_FILE_SIZE_BYTES } from '@publ/shared';

type MulterFileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

type UploadFileFilterOptions = {
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  label: string;
};

export const DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const IMAGE_UPLOAD_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MMS_IMAGE_UPLOAD_MAX_FILE_SIZE_BYTES = MMS_ATTACHMENT_MAX_FILE_SIZE_BYTES;

const DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'];
const MMS_IMAGE_EXTENSIONS = ['.jpg', '.jpeg'];
const MMS_IMAGE_MIME_TYPES = ['image/jpeg'];

export const documentUploadFileFilter = createUploadFileFilter({
  allowedExtensions: DOCUMENT_EXTENSIONS,
  allowedMimeTypes: DOCUMENT_MIME_TYPES,
  label: '서류 파일'
});

export const imageUploadFileFilter = createUploadFileFilter({
  allowedExtensions: IMAGE_EXTENSIONS,
  allowedMimeTypes: IMAGE_MIME_TYPES,
  label: '이미지 파일'
});

export const mmsImageUploadFileFilter = createUploadFileFilter({
  allowedExtensions: MMS_IMAGE_EXTENSIONS,
  allowedMimeTypes: MMS_IMAGE_MIME_TYPES,
  label: 'MMS 이미지'
});

function createUploadFileFilter(options: UploadFileFilterOptions) {
  const allowedExtensions = new Set(options.allowedExtensions);
  const allowedMimeTypes = new Set(options.allowedMimeTypes);

  return (_req: unknown, file: Express.Multer.File, cb: MulterFileFilterCallback): void => {
    const extension = extname(file.originalname || '').toLowerCase();
    const mimeType = (file.mimetype || '').toLowerCase();
    const hasAllowedExtension = allowedExtensions.has(extension);
    const hasAllowedMimeType =
      !mimeType ||
      mimeType === 'application/octet-stream' ||
      allowedMimeTypes.has(mimeType);

    if (!hasAllowedExtension || !hasAllowedMimeType) {
      cb(
        new BadRequestException(
          `${options.label} 형식이 올바르지 않습니다. 허용 형식: ${options.allowedExtensions.join(', ')}`
        ),
        false
      );
      return;
    }

    cb(null, true);
  };
}
