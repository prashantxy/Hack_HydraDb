"use client";

import { useMemo } from "react";
import { scrollStages } from "@/lib/graph-data";
import { smoothstep } from "@/lib/scroll-store";

interface TypographyOverlayProps {
  progress: number;
}

export function TypographyOverlay({ progress }: TypographyOverlayProps) {
  return (
    <div className="typography-layer">
      {scrollStages.map((stage, i) => (
        <StageBlock key={i} stage={stage} progress={progress} />
      ))}
    </div>
  );
}

function StageBlock({
  stage,
  progress,
}: {
  stage: (typeof scrollStages)[number];
  progress: number;
}) {
  const opacity = useMemo(() => {
    const fadeIn = smoothstep(stage.start, stage.start + 0.03, progress);
    const fadeOut = 1 - smoothstep(stage.end - 0.03, stage.end, progress);
    return fadeIn * fadeOut;
  }, [stage.start, stage.end, progress]);

  const translateY = useMemo(() => {
    const fadeIn = smoothstep(stage.start, stage.start + 0.05, progress);
    return (1 - fadeIn) * 30;
  }, [stage.start, progress]);

  if (opacity < 0.01) return null;

  if (stage.variant === "hero") {
    return (
      <div
        className="typography-content"
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        <div className="typography-hero">{stage.lines[0]}</div>
      </div>
    );
  }

  if (stage.variant === "stats") {
    return (
      <div
        className="stats-overlay"
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        <div className="stats-severity">{stage.lines[0]}</div>
        <div className="stats-score">{stage.lines[1]}</div>
        <div className="stats-details">
          {stage.lines.slice(3).map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>
    );
  }

  // Statement variant
  return (
    <div
      className="typography-content"
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div className="typography-statement">
        {stage.lines.map((line, i) => {
          const isCritical =
            line.toLowerCase().includes("blast") ||
            line.toLowerCase().includes("critical");
          return (
            <div key={i}>
              {isCritical ? (
                <span className="critical">{line}</span>
              ) : i === 1 ? (
                <span className="muted">{line}</span>
              ) : (
                line
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
