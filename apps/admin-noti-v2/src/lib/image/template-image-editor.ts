export const TEMPLATE_IMAGE_VIEWPORT = {
  width: 520,
  height: 260,
} as const;

export const TEMPLATE_IMAGE_OUTPUT = {
  width: 800,
  height: 400,
} as const;

export const TEMPLATE_IMAGE_MAX_BYTES = 500 * 1024;
export const TEMPLATE_IMAGE_COMPRESSION_PRESETS = [
  { name: "기본 압축", qualities: [0.88, 0.82, 0.76, 0.7, 0.64] },
  { name: "강한 압축", qualities: [0.76, 0.7, 0.64, 0.58, 0.52] },
  { name: "최대 압축", qualities: [0.64, 0.58, 0.52, 0.46, 0.4] },
] as const;

export type TemplateImagePosition = {
  x: number;
  y: number;
};

export type TemplateImageNaturalSize = {
  width: number;
  height: number;
};

export function getTemplateImageScale(size: TemplateImageNaturalSize, zoom: number) {
  return Math.max(
    TEMPLATE_IMAGE_VIEWPORT.width / size.width,
    TEMPLATE_IMAGE_VIEWPORT.height / size.height
  ) * zoom;
}

export function clampTemplateImagePosition(
  position: TemplateImagePosition,
  size: TemplateImageNaturalSize,
  zoom: number
) {
  const scale = getTemplateImageScale(size, zoom);
  const width = size.width * scale;
  const height = size.height * scale;
  const maxX = Math.max(0, (width - TEMPLATE_IMAGE_VIEWPORT.width) / 2);
  const maxY = Math.max(0, (height - TEMPLATE_IMAGE_VIEWPORT.height) / 2);

  return {
    x: Math.min(maxX, Math.max(-maxX, position.x)),
    y: Math.min(maxY, Math.max(-maxY, position.y)),
  };
}

export function getTemplateImageLayout(
  size: TemplateImageNaturalSize,
  zoom: number,
  position: TemplateImagePosition
) {
  const scale = getTemplateImageScale(size, zoom);
  const width = size.width * scale;
  const height = size.height * scale;
  const safePosition = clampTemplateImagePosition(position, size, zoom);

  return {
    scale,
    width,
    height,
    left: (TEMPLATE_IMAGE_VIEWPORT.width - width) / 2 + safePosition.x,
    top: (TEMPLATE_IMAGE_VIEWPORT.height - height) / 2 + safePosition.y,
    position: safePosition,
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    image.src = src;
  });
}

function buildExportFileName(originalName: string) {
  const normalized = originalName.trim() || "kakao-template-image";
  const withoutExt = normalized.replace(/\.[^.]+$/, "");
  return `${withoutExt}-cropped.jpg`;
}

export type TemplateImageExportPreview = {
  blob: Blob;
  quality: number;
  fitsLimit: boolean;
};

function getCompressionPreset(level: number) {
  return TEMPLATE_IMAGE_COMPRESSION_PRESETS[
    Math.min(Math.max(level, 0), TEMPLATE_IMAGE_COMPRESSION_PRESETS.length - 1)
  ];
}

async function renderCroppedTemplateImageBlob(params: {
  sourceUrl: string;
  size: TemplateImageNaturalSize;
  zoom: number;
  position: TemplateImagePosition;
  compressionLevel?: number;
}) {
  const image = await loadImage(params.sourceUrl);
  const layout = getTemplateImageLayout(params.size, params.zoom, params.position);
  const sourceX = Math.max(0, -layout.left / layout.scale);
  const sourceY = Math.max(0, -layout.top / layout.scale);
  const sourceWidth = Math.min(image.naturalWidth - sourceX, TEMPLATE_IMAGE_VIEWPORT.width / layout.scale);
  const sourceHeight = Math.min(image.naturalHeight - sourceY, TEMPLATE_IMAGE_VIEWPORT.height / layout.scale);

  const canvas = document.createElement("canvas");
  canvas.width = TEMPLATE_IMAGE_OUTPUT.width;
  canvas.height = TEMPLATE_IMAGE_OUTPUT.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("이미지 편집기를 초기화하지 못했습니다.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const preset = getCompressionPreset(params.compressionLevel ?? 0);
  let blob: Blob | null = null;
  let appliedQuality = preset.qualities[preset.qualities.length - 1];

  for (const quality of preset.qualities) {
    // eslint-disable-next-line no-await-in-loop
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", quality);
    });

    appliedQuality = quality;

    if (blob && blob.size <= TEMPLATE_IMAGE_MAX_BYTES) {
      break;
    }
  }

  if (!blob) {
    throw new Error("이미지 저장에 실패했습니다.");
  }

  return {
    blob,
    quality: appliedQuality,
    fitsLimit: blob.size <= TEMPLATE_IMAGE_MAX_BYTES,
  };
}

export async function estimateCroppedTemplateImage(params: {
  sourceUrl: string;
  size: TemplateImageNaturalSize;
  zoom: number;
  position: TemplateImagePosition;
  compressionLevel?: number;
}): Promise<TemplateImageExportPreview> {
  return renderCroppedTemplateImageBlob(params);
}

export async function exportCroppedTemplateImage(params: {
  sourceUrl: string;
  fileName: string;
  size: TemplateImageNaturalSize;
  zoom: number;
  position: TemplateImagePosition;
  compressionLevel?: number;
}) {
  const { blob, fitsLimit } = await renderCroppedTemplateImageBlob(params);

  if (!fitsLimit) {
    throw new Error("편집된 이미지가 500KB를 초과했습니다. 다른 이미지를 사용하거나 범위를 조정해 주세요.");
  }

  return new File([blob], buildExportFileName(params.fileName), { type: "image/jpeg" });
}
