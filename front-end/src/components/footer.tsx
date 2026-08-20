"use client";

import { Shield, ExternalLink } from "lucide-react";

const links = [
  {
    heading: "Product",
    items: [
      { label: "CLI", href: "#" },
      { label: "Dashboard", href: "#" },
      { label: "API", href: "#" },
    ],
  },
  {
    heading: "Resources",
    items: [
      { label: "Documentation", href: "#" },
      { label: "GitHub", href: "https://github.com", external: true, icon: ExternalLink },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    heading: "Company",
    items: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-card-border/50">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-accent" />
              </div>
              <span className="text-sm font-semibold tracking-tight">
                CHAINTRACE
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Software supply-chain security
            </p>
          </div>

          {/* Link columns */}
          {links.map((group) => (
            <div key={group.heading}>
              <p className="text-xs font-medium text-foreground mb-3">
                {group.heading}
              </p>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-10 pt-6 border-t border-card-border/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted/60">
            &copy; 2026 ChainTrace. Supply-chain security platform.
          </p>
          <p className="text-[11px] text-muted/60">
            Built for hack-hydra
          </p>
        </div>
      </div>
    </footer>
  );
}
