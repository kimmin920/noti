"use client";

import type { CSSProperties } from "react";

type SkeletonBlockProps = {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  className?: string;
};

export function SkeletonBlock({
  width = "100%",
  height = 12,
  className = "",
}: SkeletonBlockProps) {
  return <div className={`skeleton-block${className ? ` ${className}` : ""}`} style={{ width, height }} aria-hidden="true" />;
}

export function SkeletonStatGrid({ columns = 4 }: { columns?: number }) {
  return (
    <div className="box mb-16">
      <div className="skeleton-stat-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div className="skeleton-stat-cell" key={index}>
            <SkeletonBlock width="46%" height={11} />
            <SkeletonBlock width="58%" height={28} className="skeleton-gap-8" />
            <SkeletonBlock width="40%" height={11} className="skeleton-gap-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonTableBox({
  titleWidth = 120,
  rows = 4,
  columns,
}: {
  titleWidth?: CSSProperties["width"];
  rows?: number;
  columns: Array<CSSProperties["width"]>;
}) {
  return (
    <div className="box">
      <div className="box-header">
        <SkeletonBlock width={titleWidth} height={14} />
      </div>
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            className="skeleton-table-row"
            key={rowIndex}
            style={{ gridTemplateColumns: columns.map((value) => (typeof value === "number" ? `${value}px` : value)).join(" ") }}
          >
            {columns.map((_, columnIndex) => (
              <div className="skeleton-stack" key={columnIndex}>
                <SkeletonBlock width={columnIndex === 0 ? "72%" : "100%"} height={12} />
                {columnIndex === 0 || columnIndex === 1 ? <SkeletonBlock width="44%" height={10} /> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonToolbarBox() {
  return (
    <div className="box mb-16">
      <div className="skeleton-toolbar-row">
        <SkeletonBlock width="240px" height={32} />
        <SkeletonBlock width="120px" height={32} />
        <SkeletonBlock width="120px" height={32} />
      </div>
    </div>
  );
}
