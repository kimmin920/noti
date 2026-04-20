"use client";

import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { AppIcon } from "@/components/icons/AppIcon";
import {
  clampTemplateImagePosition,
  DEFAULT_TEMPLATE_IMAGE_CROP_CONFIG,
  exportCroppedTemplateImage,
  getTemplateImageLayout,
  type TemplateImageCropConfig,
  type TemplateImageNaturalSize,
  type TemplateImagePosition,
} from "@/lib/image/template-image-editor";

type KakaoTemplateImageEditorModalProps = {
  open: boolean;
  fileName: string;
  sourceUrl: string;
  onApply: (file: File) => Promise<void>;
  onClose: () => void;
  config?: TemplateImageCropConfig;
  guidanceTitle?: string;
  guidanceCopy?: string;
};

const INITIAL_POSITION = { x: 0, y: 0 };

export function KakaoTemplateImageEditorModal({
  open,
  fileName,
  sourceUrl,
  onApply,
  onClose,
  config,
  guidanceTitle,
  guidanceCopy,
}: KakaoTemplateImageEditorModalProps) {
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [naturalSize, setNaturalSize] = useState<TemplateImageNaturalSize | null>(null);
  const [position, setPosition] = useState<TemplateImagePosition>(INITIAL_POSITION);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cropConfig = config ?? DEFAULT_TEMPLATE_IMAGE_CROP_CONFIG;

  if (!open) {
    return null;
  }

  const layout = naturalSize ? getTemplateImageLayout(naturalSize, zoom, position, cropConfig) : null;

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || submitting) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !naturalSize) {
      return;
    }

    const nextPosition = clampTemplateImagePosition(
      {
        x: dragState.originX + (event.clientX - dragState.startX),
        y: dragState.originY + (event.clientY - dragState.startY),
      },
      naturalSize,
      zoom,
      cropConfig
    );

    setPosition(nextPosition);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleZoomChange = (value: number) => {
    if (!naturalSize) {
      setZoom(value);
      return;
    }

    const nextPosition = clampTemplateImagePosition(position, naturalSize, value, cropConfig);
    setZoom(value);
    setPosition(nextPosition);
  };

  const handleReset = () => {
    setZoom(1);
    setPosition(INITIAL_POSITION);
    setError(null);
  };

  const handleApply = async () => {
    if (!naturalSize) {
      setError("이미지를 불러오는 중입니다.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const file = await exportCroppedTemplateImage({
        sourceUrl,
        fileName,
        size: naturalSize,
        zoom,
        position,
        config: cropConfig,
      });
      await onApply(file);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "이미지를 적용하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop open template-image-editor-backdrop" onClick={submitting ? undefined : onClose}>
      <div className="modal template-image-editor-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <AppIcon name="sliders" className="icon icon-18" />
            이미지 편집
          </div>
          <button className="modal-close" onClick={onClose} disabled={submitting}>
            <AppIcon name="x" className="icon icon-18" />
          </button>
        </div>

        <div className="modal-body">
          <div className="template-image-editor-layout">
            <div className="template-image-editor-stage-shell">
              <div
                className={`template-image-editor-stage${dragging ? " dragging" : ""}`}
                style={
                  {
                    "--template-image-editor-width": `${cropConfig.viewport.width}px`,
                    "--template-image-editor-height": `${cropConfig.viewport.height}px`,
                    "--template-image-editor-aspect": `${cropConfig.viewport.width} / ${cropConfig.viewport.height}`,
                  } as CSSProperties
                }
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <div className="template-image-editor-stage-backdrop" />
                <div className="template-image-editor-stage-frame">
                  {layout ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sourceUrl}
                      alt="편집 중인 템플릿 이미지"
                      className="template-image-editor-image"
                      style={{
                        width: `${layout.width}px`,
                        height: `${layout.height}px`,
                        left: `${layout.left}px`,
                        top: `${layout.top}px`,
                      }}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sourceUrl}
                      alt="편집 중인 템플릿 이미지"
                      className="template-image-editor-image template-image-editor-image-loading"
                      onLoad={(event) => {
                        const nextSize = {
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                        };
                        setNaturalSize(nextSize);
                        setZoom(1);
                        setPosition(INITIAL_POSITION);
                      }}
                    />
                  )}
                  <div className="template-image-editor-stage-grid" />
                </div>
              </div>
            </div>

            <div className="template-image-editor-side">
              <div className="template-image-editor-meta">
                <div className="template-image-editor-meta-title">{guidanceTitle ?? "이미지를 프레임 안에 맞춰 주세요."}</div>
                <div className="template-image-editor-meta-copy">
                  {guidanceCopy ??
                    `업로드한 이미지는 최종적으로 ${cropConfig.output.width}×${cropConfig.output.height} 규격으로 저장됩니다.`}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">확대</label>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(event) => handleZoomChange(Number(event.target.value))}
                  disabled={!naturalSize || submitting}
                />
                <div className="template-image-editor-zoom-copy">{Math.round(zoom * 100)}%</div>
              </div>

              <div className="template-image-editor-actions">
                <button type="button" className="btn btn-default" onClick={handleReset} disabled={submitting}>
                  위치 초기화
                </button>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={handleApply}
                  disabled={!naturalSize || submitting}
                >
                  {submitting ? "적용 중..." : "적용"}
                </button>
              </div>

              {error ? (
                <div className="flash flash-attention" style={{ marginTop: 4 }}>
                  <AppIcon name="warn" className="icon icon-16 flash-icon" />
                  <div className="flash-body">{error}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
