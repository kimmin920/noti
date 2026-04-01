"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { SenderLetterStamp } from "@/lib/resources/sender-letter-stamp";
import { useMountEffect } from "@/lib/hooks/use-mount-effect";

type ResizeMode = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type InteractionState =
  | {
      mode: "drag" | ResizeMode;
      pointerId: number;
      startX: number;
      startY: number;
      startStamp: SenderLetterStamp;
    }
  | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function SenderLetterStampField({
  stamp,
  editable = false,
  onChange,
}: {
  stamp: SenderLetterStamp | null;
  editable?: boolean;
  onChange?: (stamp: SenderLetterStamp | null) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [interaction, setInteraction] = useState<InteractionState>(null);

  useMountEffect(() => {
    if (!editable) {
      return;
    }

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const target = event.target;
      if (target instanceof Node && root.contains(target)) {
        return;
      }

      setSelected(false);
      setHovered(false);
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  });

  const applyBounds = (nextStamp: SenderLetterStamp) => {
    const surfaceWidth = 116;
    const surfaceHeight = 92;
    const width = clamp(nextStamp.width, 28, surfaceWidth);
    const height = clamp(nextStamp.height, 28, surfaceHeight);
    const x = clamp(nextStamp.x, 0, surfaceWidth - width);
    const y = clamp(nextStamp.y, 0, surfaceHeight - height);

    return { ...nextStamp, x, y, width, height };
  };

  const updateStamp = (nextStamp: SenderLetterStamp | null) => {
    onChange?.(nextStamp ? applyBounds(nextStamp) : null);
  };

  const startInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    mode: "drag" | ResizeMode,
  ) => {
    if (!editable || !stamp) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setSelected(true);
    setInteraction({
      mode,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startStamp: stamp,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editable || !stamp || !interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;

    if (interaction.mode === "drag") {
      updateStamp({
        ...interaction.startStamp,
        x: interaction.startStamp.x + dx,
        y: interaction.startStamp.y + dy,
      });
      return;
    }

    let nextX = interaction.startStamp.x;
    let nextY = interaction.startStamp.y;
    let nextWidth = interaction.startStamp.width;
    let nextHeight = interaction.startStamp.height;

    if (interaction.mode === "top-left") {
      nextX = interaction.startStamp.x + dx;
      nextY = interaction.startStamp.y + dy;
      nextWidth = interaction.startStamp.width - dx;
      nextHeight = interaction.startStamp.height - dy;
    } else if (interaction.mode === "top-right") {
      nextY = interaction.startStamp.y + dy;
      nextWidth = interaction.startStamp.width + dx;
      nextHeight = interaction.startStamp.height - dy;
    } else if (interaction.mode === "bottom-left") {
      nextX = interaction.startStamp.x + dx;
      nextWidth = interaction.startStamp.width - dx;
      nextHeight = interaction.startStamp.height + dy;
    } else if (interaction.mode === "bottom-right") {
      nextWidth = interaction.startStamp.width + dx;
      nextHeight = interaction.startStamp.height + dy;
    }

    updateStamp({
      ...interaction.startStamp,
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
    });
  };

  const finishInteraction = (event: ReactPointerEvent<HTMLElement>) => {
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setInteraction(null);
  };

  return (
    <div ref={rootRef} className="sender-letter-stamp-field">
      <div
        className={`sender-letter-stamp-surface${editable ? " editable" : ""}`}
        onPointerMove={handlePointerMove}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
        onPointerDown={() => {
          if (editable && !stamp?.dataUrl) {
            setSelected(false);
          }
        }}
        onPointerEnter={() => {
          if (editable && stamp?.dataUrl) {
            setHovered(true);
          }
        }}
        onPointerLeave={() => {
          if (editable) {
            setHovered(false);
          }
        }}
      >
        <span className="sender-letter-stamp-placeholder-text">(인)</span>

        {stamp?.dataUrl ? (
          <div
            className={`sender-letter-stamp-item${selected ? " grid-item-selected" : ""}`}
            style={{
              left: `${stamp.x}px`,
              top: `${stamp.y}px`,
              width: `${stamp.width}px`,
              height: `${stamp.height}px`,
            }}
            onPointerDown={(event) => startInteraction(event, "drag")}
            onClick={(event) => {
              event.stopPropagation();
              if (editable) {
                setSelected(true);
              }
            }}
          >
            <img
              src={stamp.dataUrl}
              alt="업로드한 인감"
              className="sender-letter-stamp-image"
              draggable={false}
            />
            {editable && (hovered || selected) ? (
              <>
                <div className="grid-item-indicator multi-select-indicator" />
                {selected ? (
                  <>
                <button
                  type="button"
                  className="resize-handle top-left"
                  onPointerDown={(event) => startInteraction(event, "top-left")}
                  aria-label="인감 왼쪽 위 크기 조절"
                >
                  <span className="resize-handler" />
                </button>
                <button
                  type="button"
                  className="resize-handle top-right"
                  onPointerDown={(event) => startInteraction(event, "top-right")}
                  aria-label="인감 오른쪽 위 크기 조절"
                >
                  <span className="resize-handler" />
                </button>
                <button
                  type="button"
                  className="resize-handle bottom-left"
                  onPointerDown={(event) => startInteraction(event, "bottom-left")}
                  aria-label="인감 왼쪽 아래 크기 조절"
                >
                  <span className="resize-handler" />
                </button>
                <button
                  type="button"
                  className="resize-handle bottom-right"
                  onPointerDown={(event) => startInteraction(event, "bottom-right")}
                  aria-label="인감 오른쪽 아래 크기 조절"
                >
                  <span className="resize-handler" />
                </button>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
