import type { Metadata } from "next";

import "@/styles/chaintrace.css";
import "@/styles/console.css";

import { ConsoleState } from "@/components/console/console-state";
import { ConsoleShell } from "@/components/console/shell";

export const metadata: Metadata = {
  title: "ChainTrace console",
  description:
    "Operate the ChainTrace API: dependency graphs in 3D, blast radius by hop distance, attack paths, and risk scored per service.",
};

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConsoleState>
      <ConsoleShell>{children}</ConsoleShell>
    </ConsoleState>
  );
}
