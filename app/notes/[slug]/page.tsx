import Link from "next/link";

/**
 * Note detail page — stub.
 *
 * Wire this up to however you want to store writing (MDX files, a CMS, plain
 * TS objects). For now it just echoes the slug so the route resolves and you
 * can see the layout system applied to a text page.
 */
export default async function Note({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="site">
      <section className="intro-section">
        <div className="content">
          <div className="stack">
            <div className="body-copy">
              <div className="greetings appear">
                <span>
                  <Link href="/">← back</Link>
                </span>
              </div>
              <div className="information">
                <h1 className="appear" style={{ margin: 0, fontSize: 14, fontWeight: 400, lineHeight: "22px" }}>
                  {slug}
                </h1>
                <p className="appear">
                  PLACEHOLDER — note body. Same 14px/22px measure as the homepage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
