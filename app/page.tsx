import PondHero from "./pond/pond-hero";
import HeroBar from "./hero-bar";
import Pomodoro from "./pomodoro";
import SocialNav from "./social-nav";
import PondControls from "./pond-controls";

export default function Home() {
  return (
    <main className="dreamy-pomodoro">
      <PondHero />
      <div className="dreamy-overlay">
        <SocialNav />
        <PondControls />
        <HeroBar />
        <Pomodoro />
      </div>
    </main>
  );
}
