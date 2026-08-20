import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Problem } from "@/components/problem";
import { RiskCard } from "@/components/risk-card";
import { Workflow } from "@/components/workflow";
import { CliDemo } from "@/components/cli-demo";
import { Architecture } from "@/components/architecture";
import { FinalCta } from "@/components/final-cta";
import { Footer } from "@/components/footer";

export const metadata = {
  title: "ChainTrace — Supply-Chain Security",
  description:
    "ChainTrace maps vulnerable dependencies to the production services they can actually affect. Know the blast radius before the attack does.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Hero />
      <Problem />
      <RiskCard />
      <Workflow />
      <CliDemo />
      <Architecture />
      <FinalCta />
      <Footer />
    </main>
  );
}
