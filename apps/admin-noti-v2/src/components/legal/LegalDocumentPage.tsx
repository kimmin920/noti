import Link from "next/link";

export type LegalDocumentSection = {
  title: string;
  body: string[];
};

type LegalDocumentPageProps = {
  title: string;
  description: string;
  effectiveDate: string;
  sections: LegalDocumentSection[];
};

export function LegalDocumentPage({
  title,
  description,
  effectiveDate,
  sections,
}: LegalDocumentPageProps) {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <header className="legal-header">
          <Link className="legal-brand" href="/dashboard" aria-label="NOTI 홈으로 이동">
            <img className="legal-brand-mark" src="/assets/noti-mark.svg" alt="" />
            <span>NOTI</span>
          </Link>
          <nav className="legal-nav" aria-label="서비스 문서">
            <Link href="/terms">이용약관</Link>
            <Link href="/privacy">개인정보처리방침</Link>
          </nav>
        </header>

        <article className="legal-document">
          <div className="legal-document-header">
            <div className="legal-eyebrow">서비스 문서</div>
            <h1>{title}</h1>
            <p>{description}</p>
            <dl className="legal-meta">
              <div>
                <dt>시행일</dt>
                <dd>{effectiveDate}</dd>
              </div>
            </dl>
          </div>

          <div className="legal-section-list">
            {sections.map((section, index) => (
              <section className="legal-section" key={section.title}>
                <h2>
                  {index + 1}. {section.title}
                </h2>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
