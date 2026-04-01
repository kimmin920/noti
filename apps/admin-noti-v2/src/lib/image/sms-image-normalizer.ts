const MMS_IMAGE_MAX_BYTES = 300 * 1024;
const MMS_IMAGE_MAX_DIMENSION = 1000;
const MMS_IMAGE_QUALITIES = [0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52, 0.46] as const;

function loadImage(sourceUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    image.src = sourceUrl;
  });
}

function buildOutputName(originalName: string) {
  const normalized = (originalName || "mms-image")
    .trim()
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${normalized || "mms-image"}.jpg`;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

export async function normalizeSmsAttachmentImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 첨부할 수 있습니다.");
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(sourceUrl);
    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestEdge > MMS_IMAGE_MAX_DIMENSION ? MMS_IMAGE_MAX_DIMENSION / longestEdge : 1;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("이미지 변환을 시작하지 못했습니다.");
    }

    // PNG 투명 영역은 흰 배경 위로 합성해 JPG로 보냅니다.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    let blob: Blob | null = null;

    for (const quality of MMS_IMAGE_QUALITIES) {
      // eslint-disable-next-line no-await-in-loop
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", quality);
      });

      if (blob && blob.size <= MMS_IMAGE_MAX_BYTES) {
        break;
      }
    }

    if (!blob) {
      throw new Error("이미지 변환에 실패했습니다.");
    }

    if (blob.size > MMS_IMAGE_MAX_BYTES) {
      throw new Error("MMS 이미지는 300KB 이하로만 첨부할 수 있습니다.");
    }

    return new File([blob], buildOutputName(file.name), { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

