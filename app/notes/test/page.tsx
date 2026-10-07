import Link from "next/link";
import PondHero from "../../pond/pond-hero";

type GitHubUser = {
  login: string;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
};

type GitHubRepo = {
  stargazers_count: number;
  forks_count: number;
};

async function getGitHubStats() {
  try {
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "dreamy-pomodoro",
    };

    const [userResponse, reposResponse] = await Promise.all([
      fetch("https://api.github.com/users/vishwa-io", {
        headers,
        next: { revalidate: 3600 },
      }),
      fetch("https://api.github.com/users/vishwa-io/repos?per_page=100&sort=updated", {
        headers,
        next: { revalidate: 3600 },
      }),
    ]);

    if (!userResponse.ok || !reposResponse.ok) {
      throw new Error("GitHub request failed");
    }

    const user = (await userResponse.json()) as GitHubUser;
    const repos = (await reposResponse.json()) as GitHubRepo[];

    return {
      login: user.login,
      avatar: user.avatar_url,
      repos: user.public_repos,
      followers: user.followers,
      following: user.following,
      stars: repos.reduce((total, repo) => total + repo.stargazers_count, 0),
      forks: repos.reduce((total, repo) => total + repo.forks_count, 0),
    };
  } catch {
    return {
      login: "vishwa-io",
      avatar: "",
      repos: 0,
      followers: 0,
      following: 0,
      stars: 0,
      forks: 0,
    };
  }
}

export const metadata = {
  title: "GitHub · Dreamy Pomodoro",
};

export default async function GitHubStats() {
  const stats = await getGitHubStats();

  return (
    <main className="about-page stats-page">
      <PondHero />
      <div className="stats-shell">
        <Link href="/" className="about-back">
          <span>←</span> back to the pond
        </Link>

        <section className="about-card stats-card" aria-labelledby="stats-title">
          <div className="stats-heading">
            <div className="stats-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .75A11.25 11.25 0 0 0 8.44 22.67c.56.1.77-.24.77-.54v-2.1c-3.14.68-3.8-1.34-3.8-1.34-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.64 1.22 3.28.93.1-.73.39-1.22.71-1.5-2.51-.29-5.15-1.26-5.15-5.62 0-1.24.44-2.25 1.16-3.05-.12-.29-.5-1.44.11-3 0 0 .94-.3 3.1 1.16A10.7 10.7 0 0 1 12 6.1c.96 0 1.93.13 2.83.38 2.15-1.46 3.09-1.16 3.09-1.16.62 1.56.23 2.71.12 3  .72.8 1.16 1.81 1.16 3.05 0 4.37-2.65 5.32-5.17 5.61.41.35.77 1.04.77 2.1v3.11c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" />
              </svg>
            </div>
            <div>
              <div className="about-kicker">github stats</div>
              <h1 id="stats-title">{stats.login}</h1>
            </div>
          </div>

          <div className="stats-rule" />

          <div className="stats-grid">
            <div className="stats-item">
              <span>repositories</span>
              <strong>{stats.repos}</strong>
            </div>
            <div className="stats-item">
              <span>stars</span>
              <strong>{stats.stars}</strong>
            </div>
            <div className="stats-item">
              <span>followers</span>
              <strong>{stats.followers}</strong>
            </div>
            <div className="stats-item">
              <span>following</span>
              <strong>{stats.following}</strong>
            </div>
          </div>

          <a
            className="stats-profile-link"
            href="https://github.com/vishwa-io"
            target="_blank"
            rel="noreferrer"
          >
            view github profile <span>↗</span>
          </a>
        </section>
      </div>
    </main>
  );
}
