import type { Metadata } from "next";

import "@/styles/chaintrace.css";
import "@/styles/docs.css";

import { DocsPage } from "@/components/docs/docs-page";

export const metadata: Metadata = {
  title: "ChainTrace docs — API and CLI reference",
  description:
    "Full reference for ChainTrace: the graph model, all 16 HTTP endpoints, risk scoring rules, the CLI with its flags, lockfile support and exit codes, and the console.",
};

export default function Docs() {
  return <DocsPage />;
}
