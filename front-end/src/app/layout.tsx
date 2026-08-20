import type { Metadata } from "next";
import {
  Inter,
  JetBrains_Mono,
  Schibsted_Grotesk,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/* display face: a grotesk with a slightly mechanical skeleton —
 * set at 400 and tracked tight, it reads like panel lettering */
const schibsted = Schibsted_Grotesk({
  variable: "--font-schibsted",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChainTrace — dependency blast radius for npm and PyPI",
  description:
    "ChainTrace turns your npm and Python lockfiles into one dependency graph, then walks it backwards from any compromised version to the services that ship it — with hop counts, attack paths, and a production-weighted risk score.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${schibsted.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
