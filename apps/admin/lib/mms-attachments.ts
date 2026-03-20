import {
  MMS_ATTACHMENT_MAX_COUNT,
  MMS_ATTACHMENT_MAX_FILE_SIZE_BYTES,
  MMS_ATTACHMENT_TOTAL_SIZE_BYTES_FOR_THREE
} from './sms-message-spec';

export interface ValidatedMmsAttachment {
  file: File;
  width: number;
  height: number;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value}B`;
  }

  return `${(value / 1024).toFixed(1)}KB`;
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight
      });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`${file.name} 이미지를 읽을 수 없습니다.`));
    };

    image.src = objectUrl;
  });
}

export async function validateMmsAttachments(files: File[]): Promise<{
  attachments: ValidatedMmsAttachment[];
  errors: string[];
}> {
  const selectedFiles = files.slice(0, MMS_ATTACHMENT_MAX_COUNT);
  const errors: string[] = [];

  if (files.length > MMS_ATTACHMENT_MAX_COUNT) {
    errors.push(`이미지는 최대 ${MMS_ATTACHMENT_MAX_COUNT}개까지 첨부할 수 있습니다.`);
  }

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  if (selectedFiles.length === MMS_ATTACHMENT_MAX_COUNT && totalSize > MMS_ATTACHMENT_TOTAL_SIZE_BYTES_FOR_THREE) {
    errors.push(
      `이미지가 3개일 때는 총 용량이 ${formatBytes(MMS_ATTACHMENT_TOTAL_SIZE_BYTES_FOR_THREE)} 이하여야 합니다.`
    );
  }

  const attachments: ValidatedMmsAttachment[] = [];

  for (const file of selectedFiles) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['jpg', 'jpeg'].includes(extension) || (file.type && file.type !== 'image/jpeg')) {
      errors.push(`${file.name}: .jpg, .jpeg 파일만 첨부할 수 있습니다.`);
      continue;
    }

    if (file.size > MMS_ATTACHMENT_MAX_FILE_SIZE_BYTES) {
      errors.push(`${file.name}: 파일 하나당 ${formatBytes(MMS_ATTACHMENT_MAX_FILE_SIZE_BYTES)} 이하여야 합니다.`);
      continue;
    }

    try {
      const dimensions = await readImageDimensions(file);
      if (dimensions.width > 1000 || dimensions.height > 1000) {
        errors.push(`${file.name}: 1000x1000 이하 이미지로 업로드해 주세요.`);
        continue;
      }

      attachments.push({
        file,
        width: dimensions.width,
        height: dimensions.height
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${file.name} 이미지를 확인하지 못했습니다.`);
    }
  }

  return {
    attachments,
    errors
  };
}

export function formatAttachmentSize(size: number): string {
  return formatBytes(size);
}
