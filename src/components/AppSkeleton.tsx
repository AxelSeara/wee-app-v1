export const AppSkeleton = () => (
  <main className="loading-shell" aria-busy="true" aria-live="polite">
    <section className="skeleton-topbar">
      <span className="sk sk-brand" />
      <span className="sk sk-search" />
      <span className="sk sk-avatar" />
    </section>

    <section className="page-section">
      <div className="skeleton-focus-grid">
        <article className="skeleton-card">
          <span className="sk sk-line sk-line-short" />
          <span className="sk sk-line" />
          <span className="sk sk-btn" />
        </article>
        <article className="skeleton-card">
          <span className="sk sk-line sk-line-short" />
          <span className="sk sk-line" />
          <span className="sk sk-btn" />
        </article>
        <article className="skeleton-card">
          <span className="sk sk-line sk-line-short" />
          <span className="sk sk-line" />
          <span className="sk sk-btn" />
        </article>
      </div>
    </section>

    <section className="page-section">
      <span className="sk sk-title" />
      <div className="skeleton-post-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <article className="skeleton-post-card" key={`post-${index}`}>
            <span className="sk sk-media" />
            <span className="sk sk-line sk-line-short" />
            <span className="sk sk-line" />
            <span className="sk sk-line sk-line-mid" />
          </article>
        ))}
      </div>
    </section>

    <section className="page-section">
      <span className="sk sk-title" />
      <div className="skeleton-topic-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article className="skeleton-topic-card" key={`topic-${index}`}>
            <span className="sk sk-line sk-line-short" />
            <span className="sk sk-line sk-line-mid" />
            <span className="sk sk-line" />
          </article>
        ))}
      </div>
    </section>
  </main>
);
