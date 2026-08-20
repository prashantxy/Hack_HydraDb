import "@/styles/chaintrace.css";

import { Hero } from "@/components/site/hero";
import { Nav } from "@/components/site/nav";
import { Hatch } from "@/components/site/primitives";
import {
  Audience,
  Closing,
  Faq,
  How,
  Problem,
  Solution,
  Stack,
  Stats,
} from "@/components/site/sections";

export const metadata = {
  title: "ChainTrace — dependency blast radius for npm and PyPI",
  description:
    "ChainTrace turns your npm and Python lockfiles into one dependency graph, then walks it backwards from any compromised version to the services that ship it — with hop counts, attack paths, and a production-weighted risk score.",
};

export default function Home() {
  return (
    <main className="ct">
      <Nav />

      <div className="ct-shell">
        <Hero />
        <Stats />

        <Problem />
        <Hatch />

        <Solution />
        <Hatch />

        <Stack />
        <Hatch />

        <Audience />
        <How />
        <Faq />

        <Closing />
      </div>
    </main>
  );
}
