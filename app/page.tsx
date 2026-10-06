import PondHero from "./pond/pond-hero";
import HeroBar from "./hero-bar";
import Pomodoro from "./pomodoro";

export default function Home() {
  return (
    <main className="dreamy-pomodoro">
      <PondHero />

      <div className="dreamy-overlay">
        <HeroBar />
        <Pomodoro />
      </div>
    </main>
  );
}
