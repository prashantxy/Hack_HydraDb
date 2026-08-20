"use client";

import { PixelArrow, Wordmark } from "./primitives";

const LINKS = [
  { href: "#stack", label: "The stack" },
  { href: "#blast", label: "Blast radius" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
  { href: "/console", label: "Console" },
];

export function Nav() {
  return (
    <nav className="ct-nav">
      <div className="ct-nav-in">
        <a href="#top" className="ct-wordmark" aria-label="ChainTrace, home">
          <Wordmark />
          <span className="ct-wordmark-slash" aria-hidden>
            /
          </span>
        </a>

        <div className="ct-nav-links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="ct-nav-link">
              {l.label}
            </a>
          ))}
        </div>

        <a href="#start" className="ct-btn">
          Scan a repo
          <PixelArrow />
        </a>
      </div>
    </nav>
  );
}
