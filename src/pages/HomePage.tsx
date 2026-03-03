import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PostCard } from "../components/PostCard";
import { TopBar } from "../components/TopBar";
import { pick, useI18n } from "../lib/i18n";
import { TopicBlock } from "../components/TopicBlock";
import { DEFAULT_FILTERS } from "../lib/appData";
import type { Post, SearchFilters, User, UserCommunityStats, UserPreferences } from "../lib/types";

interface HomePageProps {
  activeUser: User;
  users: User[];
  posts: Post[];
  preferences: UserPreferences | null;
  filterPosts: (filters: SearchFilters) => Post[];
  userQualityValueById: Map<string, number>;
  userInfluenceAuraById: Map<string, number>;
  userCommunityStatsById: Map<string, UserCommunityStats>;
  onOpenShareModal: () => void;
  onLogout: () => void;
}

const groupByTopic = (posts: Post[]): Array<{ topic: string; posts: Post[] }> => {
  const grouped = new Map<string, Post[]>();
  posts.forEach((post) => {
    post.topics.forEach((topic) => {
      grouped.set(topic, [...(grouped.get(topic) ?? []), post]);
    });
  });

  return Array.from(grouped.entries())
    .map(([topic, bucket]) => ({ topic, posts: bucket.sort((a, b) => b.createdAt - a.createdAt) }))
    .sort((a, b) => b.posts[0].createdAt - a.posts[0].createdAt);
};

export const HomePage = ({
  activeUser,
  users,
  posts,
  preferences,
  filterPosts,
  userQualityValueById,
  userInfluenceAuraById,
  userCommunityStatsById,
  onOpenShareModal,
  onLogout
}: HomePageProps) => {
  const { language } = useI18n();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeSection, setActiveSection] = useState("popular-section");
  const [showAllActiveUsers, setShowAllActiveUsers] = useState(false);
  const visiblePosts = useMemo(
    () => filterPosts({ ...DEFAULT_FILTERS, query: searchQuery }),
    [filterPosts, searchQuery]
  );

  const weightedFeedback = (post: Post): number => {
    const feedbacks = post.feedbacks ?? [];
    if (feedbacks.length === 0) return 0;
    const totalWeight = feedbacks.reduce((acc, item) => {
      const score = userInfluenceAuraById.get(item.userId) ?? 1000;
      const weight = 0.6 + Math.pow(score / 10000, 1.25) * 1.4;
      return acc + weight;
    }, 0);
    if (!totalWeight) return 0;
    const weightedVote = feedbacks.reduce((acc, item) => {
      const score = userInfluenceAuraById.get(item.userId) ?? 1000;
      const weight = 0.6 + Math.pow(score / 10000, 1.25) * 1.4;
      return acc + item.vote * weight;
    }, 0);
    const posterior = weightedVote / (totalWeight + 3.5);
    const confidence = totalWeight / (totalWeight + 5);
    return posterior * 22 * confidence;
  };

  const recencyScore = (createdAt: number): number => {
    const ageHours = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60));
    return 14 * Math.exp(-ageHours / 26) - 3;
  };

  const byCommunityValue = (a: Post, b: Post): number => {
    const valueA = userQualityValueById.get(a.userId) ?? 40;
    const valueB = userQualityValueById.get(b.userId) ?? 40;
    const recencyA = recencyScore(a.createdAt);
    const recencyB = recencyScore(b.createdAt);
    const evidenceA = a.flags.includes("no_source") ? -12 : a.flags.includes("unverified_claim") ? -8 : 6;
    const evidenceB = b.flags.includes("no_source") ? -12 : b.flags.includes("unverified_claim") ? -8 : 6;
    const clickbaitA = a.qualityLabel === "clickbait" ? -26 : 0;
    const clickbaitB = b.qualityLabel === "clickbait" ? -26 : 0;
    const collaborationA = Math.min(8, ((a.contributorUserIds?.length ?? 1) - 1) * 3);
    const collaborationB = Math.min(8, ((b.contributorUserIds?.length ?? 1) - 1) * 3);
    const scoreA =
      a.qualityScore * 0.52 +
      a.interestScore * 0.24 +
      valueA * 0.14 +
      recencyA +
      evidenceA +
      collaborationA +
      clickbaitA +
      weightedFeedback(a);
    const scoreB =
      b.qualityScore * 0.52 +
      b.interestScore * 0.24 +
      valueB * 0.14 +
      recencyB +
      evidenceB +
      collaborationB +
      clickbaitB +
      weightedFeedback(b);
    return scoreB - scoreA;
  };

  const feedPosts = [...visiblePosts].sort(byCommunityValue).slice(0, 14);
  const latestNewsPosts = [...visiblePosts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const topicBlocks = groupByTopic(visiblePosts);
  const usersById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const topContributors = useMemo(() => {
    const byUser = new Map<string, { count: number; highQuality: number; latestAt: number }>();
    visiblePosts.forEach((post) => {
      const current = byUser.get(post.userId) ?? { count: 0, highQuality: 0, latestAt: 0 };
      byUser.set(post.userId, {
        count: current.count + 1,
        highQuality: current.highQuality + (post.qualityScore >= 75 && post.qualityLabel !== "clickbait" ? 1 : 0),
        latestAt: Math.max(current.latestAt, post.createdAt)
      });
    });

    return Array.from(byUser.entries())
      .map(([userId, stats]) => {
        const qualityValue = userQualityValueById.get(userId) ?? 40;
        const community = userCommunityStatsById.get(userId);
        const collaborationIndex = Math.round(
          stats.count * 2 + stats.highQuality * 3 + qualityValue * 0.25 + (community?.aura ?? 0) * 0.35 + (community?.level ?? 1) * 8
        );
        return { userId, ...stats, collaborationIndex };
      })
      .sort((a, b) => b.collaborationIndex - a.collaborationIndex || b.latestAt - a.latestAt)
      .slice(0, 4);
  }, [visiblePosts, userQualityValueById, userCommunityStatsById]);

  const activeUsers = useMemo(() => {
    const byUser = new Map<string, { recentPosts: number; latestAt: number }>();
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 14;
    posts.forEach((post) => {
      if (post.createdAt < cutoff) return;
      const current = byUser.get(post.userId) ?? { recentPosts: 0, latestAt: 0 };
      byUser.set(post.userId, {
        recentPosts: current.recentPosts + 1,
        latestAt: Math.max(current.latestAt, post.createdAt)
      });
    });

    return users
      .filter((user) => byUser.has(user.id))
      .map((user) => ({ user, ...byUser.get(user.id)! }))
      .sort((a, b) => b.recentPosts - a.recentPosts || b.latestAt - a.latestAt);
  }, [users, posts]);
  const allUsersForSidebar = useMemo(() => {
    const byUser = new Map(activeUsers.map((entry) => [entry.user.id, entry]));
    return [...users]
      .map((user) => {
        const stats = byUser.get(user.id);
        return {
          user,
          recentPosts: stats?.recentPosts ?? 0,
          latestAt: stats?.latestAt ?? 0
        };
      })
      .sort((a, b) => b.recentPosts - a.recentPosts || b.latestAt - a.latestAt || a.user.alias.localeCompare(b.user.alias));
  }, [users, activeUsers]);
  const usersSidebarList = showAllActiveUsers ? allUsersForSidebar : activeUsers.slice(0, 5);

  const communityPulse = useMemo(() => {
    const total = visiblePosts.length;
    if (total === 0) {
      return {
        healthScore: 0,
        activeAuthors: 0,
        qualityRatio: 0,
        collaborationRatio: 0,
        commentedRatio: 0,
        ratedRatio: 0
      };
    }

    const activeAuthors = new Set(visiblePosts.map((post) => post.userId)).size;
    const qualityCount = visiblePosts.filter((post) => post.qualityScore >= 75 && post.qualityLabel !== "clickbait").length;
    const collaborativeCount = visiblePosts.filter((post) => (post.contributorUserIds?.length ?? 1) > 1).length;
    const commentedCount = visiblePosts.filter((post) => (post.comments?.length ?? 0) > 0).length;
    const ratedCount = visiblePosts.filter((post) => (post.feedbacks?.length ?? 0) > 0).length;

    const qualityRatio = Math.round((qualityCount / total) * 100);
    const collaborationRatio = Math.round((collaborativeCount / total) * 100);
    const commentedRatio = Math.round((commentedCount / total) * 100);
    const ratedRatio = Math.round((ratedCount / total) * 100);
    const healthScore = Math.round(
      qualityRatio * 0.42 +
      collaborationRatio * 0.2 +
      commentedRatio * 0.2 +
      ratedRatio * 0.18
    );

    return {
      healthScore,
      activeAuthors,
      qualityRatio,
      collaborationRatio,
      commentedRatio,
      ratedRatio
    };
  }, [visiblePosts]);

  useEffect(() => {
    const key = `wee_onboarding_seen_${activeUser.id}`;
    const seen = localStorage.getItem(key);
    setShowOnboarding(!seen);
  }, [activeUser.id]);

  useEffect(() => {
    const sectionIds = ["popular-section", "topics-section", "news-section", "community-section"];
    if (typeof IntersectionObserver !== "undefined") {
      const sections = sectionIds
        .map((id) => document.getElementById(id))
        .filter((entry): entry is HTMLElement => Boolean(entry));
      if (sections.length === 0) return;

      const visibleRatios = new Map<string, number>();
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const id = (entry.target as HTMLElement).id;
            if (entry.isIntersecting) {
              visibleRatios.set(id, entry.intersectionRatio);
            } else {
              visibleRatios.delete(id);
            }
          });

          let next = sectionIds[0];
          let best = -1;
          sectionIds.forEach((id) => {
            const ratio = visibleRatios.get(id) ?? 0;
            if (ratio > best) {
              best = ratio;
              next = id;
            }
          });

          const reachedBottom =
            window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
          if (reachedBottom) next = "community-section";

          setActiveSection((prev) => (prev === next ? prev : next));
        },
        {
          threshold: [0.15, 0.35, 0.6, 0.85],
          rootMargin: "-104px 0px -42% 0px"
        }
      );

      sections.forEach((section) => observer.observe(section));
      return () => observer.disconnect();
    }

    const onScroll = () => {
      const offset = 140;
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= offset) current = id;
      }
      const reachedBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      if (reachedBottom) current = "community-section";
      setActiveSection((prev) => (prev === current ? prev : current));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeOnboarding = (): void => {
    const key = `wee_onboarding_seen_${activeUser.id}`;
    localStorage.setItem(key, "1");
    setShowOnboarding(false);
  };

  const scrollToSection = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main>
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} onLogout={onLogout} />

      {showOnboarding ? (
        <section className="page-section onboarding-card">
          <div className="section-head">
            <h2><Icon name="spark" /> {pick(language, "Primeros 3 pasos", "First 3 steps")}</h2>
            <button type="button" className="btn" onClick={closeOnboarding}>{pick(language, "Listo", "Got it")}</button>
          </div>
          <ol className="onboarding-list">
            <li>{pick(language, "Comparte un enlace y Wee lo coloca en su hilo por tema.", "Share a link and Wee places it into its topic thread.")}</li>
            <li>{pick(language, "Revisa la fuente y vota para priorizar lo más útil.", "Check the source and vote to prioritize useful content.")}</li>
            <li>{pick(language, "Añade contexto en comentarios para ayudar al grupo.", "Add context in comments to help the group.")}</li>
          </ol>
        </section>
      ) : null}

      <div className="home-layout" id="home-top">
        <aside className="home-sidebar">
          <div className="home-sidebar-stack">
            <nav className="home-side-nav" aria-label={pick(language, "Navegación del foro", "Forum navigation", "Navegación do foro")}>
              <button
                type="button"
                className={activeSection === "popular-section" ? "side-nav-btn active" : "side-nav-btn"}
                onClick={() => scrollToSection("popular-section")}
              >
                <Icon name="chili" /> {pick(language, "Popular", "Popular", "Popular")}
              </button>
              <button
                type="button"
                className={activeSection === "topics-section" ? "side-nav-btn active" : "side-nav-btn"}
                onClick={() => scrollToSection("topics-section")}
              >
                <Icon name="book" /> {pick(language, "Temas", "Topics", "Temas")}
              </button>
              <button
                type="button"
                className={activeSection === "news-section" ? "side-nav-btn active" : "side-nav-btn"}
                onClick={() => scrollToSection("news-section")}
              >
                <Icon name="news" /> {pick(language, "Noticias", "News", "Novas")}
              </button>
              <button
                type="button"
                className={activeSection === "community-section" ? "side-nav-btn active" : "side-nav-btn"}
                onClick={() => scrollToSection("community-section")}
              >
                <Icon name="users" /> {pick(language, "Comunidad", "Community", "Comunidade")}
              </button>
            </nav>

            <section className="home-users-block">
              <div className="home-users-head">
                <h4><Icon name="users" size={14} /> {pick(language, "Usuarios activos", "Active users", "Usuarios en activo")}</h4>
                <span className="badge">{activeUsers.length}</span>
              </div>
              {usersSidebarList.length === 0 ? (
                <p className="hint">{pick(language, "Aún sin actividad reciente.", "No recent activity yet.", "Aínda sen actividade recente.")}</p>
              ) : (
                <ul className="home-users-list">
                  {usersSidebarList.map((entry) => (
                    <li key={entry.user.id}>
                      <Link to={`/profile/${entry.user.id}`} className="home-user-link">
                        <span>{entry.user.alias}</span>
                        <small>{entry.recentPosts}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {users.length > 0 ? (
                <button
                  type="button"
                  className="btn home-users-toggle"
                  onClick={() => setShowAllActiveUsers((prev) => !prev)}
                >
                  <Icon name="eye" size={14} />
                  {showAllActiveUsers
                    ? pick(language, "Mostrar solo activos", "Show active only", "Amosar só activos")
                    : pick(language, "Mostrar todos", "Show all", "Amosar todos")}
                </button>
              ) : null}
            </section>
            <label className="home-sidebar-search" aria-label={pick(language, "Buscar en Wee", "Search in Wee", "Buscar en Wee")}>
              <Icon name="search" size={13} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={pick(language, "Buscar tema, palabra o fuente...", "Search topic, keyword or source...", "Buscar tema, palabra ou fonte...")}
              />
            </label>

          </div>
        </aside>

        <div className="home-main">
          <section className="page-section section-latest" id="popular-section">
            <h2><Icon name="chili" /> {pick(language, "Popular ahora", "Popular now", "Popular agora")}</h2>
            <p className="section-intro">
              {pick(language, "Lo más útil y comentado por la comunidad en este momento.", "Most useful and discussed by the community right now.", "O máis útil e comentado pola comunidade neste momento.")}
            </p>
            <div className="post-grid">
              {feedPosts.length > 0 ? (
                feedPosts.map((post) => (
                  <PostCard key={post.id} post={post} onOpenDetail={(entry) => navigate(`/post/${entry.id}`)} />
                ))
              ) : (
                <article className="empty-state">
                  <h3>{pick(language, "Aún no hay publicaciones", "No posts yet")}</h3>
                  <p>{pick(language, "Comparte la primera noticia y abre el primer hilo de tu comunidad.", "Share the first post and open your community's first thread.")}</p>
                  <button type="button" className="btn btn-primary" onClick={onOpenShareModal}>{pick(language, "Compartir ahora", "Share now")}</button>
                </article>
              )}
            </div>
          </section>

          <section className="page-section section-topics" id="topics-section">
            <div className="section-head">
              <h2><Icon name="book" /> {pick(language, "Temas activos", "Active topics")}</h2>
              <Link to="/settings" className="link-btn">
                <Icon name="settings" /> {pick(language, "Preferencias", "Preferences", "Preferencias")}
              </Link>
            </div>
            <p className="section-intro">{pick(language, "Cada tema funciona como un hilo: misma conversación, mismo contexto y menos duplicados.", "Each topic works as a thread: same conversation, same context and fewer duplicates.")}</p>
            <div className="topic-grid">
              {topicBlocks.map((block) => (
                <TopicBlock key={block.topic} topic={block.topic} posts={block.posts} />
              ))}
            </div>
          </section>

          <section className="page-section section-latest" id="news-section">
            <h2><Icon name="news" /> {pick(language, "Noticias recientes", "Latest news", "Novas recentes")}</h2>
            <p className="section-intro">
              {pick(language, "Publicaciones por orden temporal para no perder contexto.", "Posts in chronological order to keep context.", "Publicacións por orde temporal para non perder contexto.")}
            </p>
            <div className="post-grid">
              {latestNewsPosts.length > 0 ? (
                latestNewsPosts.map((post) => (
                  <PostCard key={post.id} post={post} onOpenDetail={(entry) => navigate(`/post/${entry.id}`)} />
                ))
              ) : (
                <article className="empty-state">
                  <h3>{pick(language, "Aún no hay noticias", "No news yet", "Aínda non hai novas")}</h3>
                </article>
              )}
            </div>
          </section>

          <section className="page-section section-collab" id="community-section">
            <div className="section-head">
              <h2><Icon name="users" /> {pick(language, "Comunidad", "Community", "Comunidade")}</h2>
              <p className="hint">{pick(language, "Se ordena por constancia y por cuántas publicaciones acaban siendo útiles para la comunidad.", "Ranked by consistency and by how many posts become useful for the community.")}</p>
            </div>

            <div className="community-health">
              <article className="health-main">
                <h3><Icon name="target" /> {pick(language, "Pulso de comunidad", "Community pulse")}</h3>
                <p>
                  {pick(language, "Salud actual del foro", "Current forum health", "Saúde actual do foro")}:{" "}
                  <strong>{communityPulse.healthScore}/100</strong> · {communityPulse.activeAuthors}{" "}
                  {pick(language, "personas activas", "active people", "persoas activas")}
                </p>
                <div className="health-bar">
                  <span style={{ width: `${communityPulse.healthScore}%` }} />
                </div>
              </article>

              <div className="health-kpis">
                <article className="health-kpi">
                  <h4>{pick(language, "Calidad útil", "Useful quality")}</h4>
                  <p>{communityPulse.qualityRatio}%</p>
                </article>
                <article className="health-kpi">
                  <h4>{pick(language, "Colaboración", "Collaboration")}</h4>
                  <p>{communityPulse.collaborationRatio}%</p>
                </article>
                <article className="health-kpi">
                  <h4>{pick(language, "Con comentarios", "With comments")}</h4>
                  <p>{communityPulse.commentedRatio}%</p>
                </article>
                <article className="health-kpi">
                  <h4>{pick(language, "Con votos", "With ratings")}</h4>
                  <p>{communityPulse.ratedRatio}%</p>
                </article>
              </div>
            </div>

            <div className="community-actions">
              <button type="button" className="btn btn-primary" onClick={onOpenShareModal}>
                <Icon name="plus" /> {pick(language, "Aportar ahora", "Contribute now")}
              </button>
              <button type="button" className="btn" onClick={() => scrollToSection("topics-section")}>
                <Icon name="book" /> {pick(language, "Revisar temas", "Review topics")}
              </button>
              <button type="button" className="btn" onClick={() => scrollToSection("news-section")}>
                <Icon name="news" /> {pick(language, "Revisar noticias", "Review news")}
              </button>
            </div>

            <div className="collab-grid">
              {topContributors.map((entry) => {
                const user = usersById.get(entry.userId);
                if (!user) return null;
                return (
                  <Link key={entry.userId} to={`/profile/${entry.userId}/posts`} className="collab-card">
                    <h3>{user.alias}</h3>
                    <p>
                      {entry.count} {pick(language, "aportes", "contributions")} · {entry.highQuality} {pick(language, "de alta calidad", "high quality")} ·
                      aura {userCommunityStatsById.get(entry.userId)?.aura ?? 0} ·
                      {pick(language, "nivel", "level")} {userCommunityStatsById.get(entry.userId)?.level ?? 1}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>

    </main>
  );
};
