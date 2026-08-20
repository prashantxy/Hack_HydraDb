import { CinematicPage } from "@/components/landing/cinematic-page";

export const metadata = {
  title: "ChainTrace — Supply Chain Security",
  description:
    "Don't just find vulnerable packages. Show their production blast radius. Know the blast radius before the attack does.",
};

export default function Home() {
  return (
    <main>
      <CinematicPage />
    </main>
  );
}
