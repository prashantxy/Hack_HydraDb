"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useInView } from "./primitives";

/*
 * A terminal that types itself once, when scrolled to. The command
 * is typed a character at a time; output lands line by line, the
 * way the CLI actually prints it.
 */

export type TermLine = {
  kind: "cmd" | "out";
  content: ReactNode;
  /* ms to hold before this line appears */
  wait?: number;
};

export function Terminal({
  title,
  lines,
  children,
}: {
  title: string;
  lines: TermLine[];
  children?: ReactNode;
}) {
  const { ref, seen } = useInView<HTMLDivElement>(0.3);
  const [shown, setShown] = useState(0);
  const [typed, setTyped] = useState("");

  const first = lines[0];
  const command =
    first?.kind === "cmd" && typeof first.content === "string"
      ? first.content
      : null;

  /* type the command */
  useEffect(() => {
    if (!seen || !command) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => {
        setTyped(command);
        setShown(lines.length);
      });
      return () => cancelAnimationFrame(raf);
    }

    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(command.slice(0, i));
      if (i >= command.length) {
        clearInterval(id);
        setShown(1);
      }
    }, 34);

    return () => clearInterval(id);
  }, [seen, command, lines.length]);

  /* then reveal the output */
  useEffect(() => {
    if (shown === 0 || shown >= lines.length) return;

    const id = setTimeout(() => setShown((n) => n + 1), lines[shown]?.wait ?? 120);
    return () => clearTimeout(id);
  }, [shown, lines]);

  const typing = command !== null && typed.length < command.length;

  return (
    <div ref={ref} className="ct-term">
      <div className="ct-term-bar">
        <span className="ct-dot ct-pulse" aria-hidden />
        <span>{title}</span>
      </div>

      <div className="ct-term-body">
        {command !== null && (
          <div className="ct-term-line ct-term-cmd">
            {seen ? typed : ""}
            {typing && <i className="ct-caret" aria-hidden />}
          </div>
        )}

        {lines.slice(1, Math.max(1, shown)).map((line, i) => (
          <div key={i} className="ct-term-line">
            {line.content}
          </div>
        ))}
      </div>

      {children}
    </div>
  );
}
