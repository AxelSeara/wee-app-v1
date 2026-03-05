import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PostCard } from "../components/PostCard";
import { TopBar } from "../components/TopBar";
import { pick, useI18n } from "../lib/i18n";
import { TopicBlock } from "../components/TopicBlock";
import { DEFAULT_FILTERS } from "../lib/appData";
import { scoreHomeFeedPost } from "../lib/auraEngine";
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
  const byRecent = (a: Post, b: Post): number => {
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
    if (b.interestScore !== a.interestScore) return b.interestScore - a.interestScore;
    return a.id.localeCompare(b.id);
  };
  const grouped = new Map<string, Post[]>();
  posts.forEach((post) => {
    post.topics.forEach((topic) => {
      const bucket = grouped.get(topic);
      if (bucket) {
        bucket.push(post);
        return;
      }
      grouped.set(topic, [post]);
    });
  });

  return Array.from(grouped.entries())
    .map(([topic, bucket]) => ({ topic, posts: bucket.sort(byRecent) }))
    .sort((a, b) => byRecent(a.posts[0], b.posts[0]));
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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeSection, setActiveSection] = useState("feed-section");
  const [mobileNavHidden, setMobileNavHidden] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 800px)").matches : false
  );
  const [showAllActiveUsers, setShowAllActiveUsers] = useState(false);
  const [mobileExtrasOpen, setMobileExtrasOpen] = useState(false);
  const [compactFeed, setCompactFeed] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("all");
  const lastScrollY = useRef(0);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 180);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);
  const filteredPosts = useMemo(
    () => filterPosts({ ...DEFAULT_FILTERS, query: debouncedSearchQuery }),
    [filterPosts, debouncedSearchQuery]
  );
  const visiblePosts = useMemo(
    () =>
      selectedGroup === "all"
        ? filteredPosts
        : filteredPosts.filter((post) => post.topics.includes(selectedGroup)),
    [filteredPosts, selectedGroup]
  );

  const byCommunityValue = (a: Post, b: Post): number => {
    const byRecent = (first: Post, second: Post): number => {
      if (second.createdAt !== first.createdAt) return second.createdAt - first.createdAt;
      if (second.qualityScore !== first.qualityScore) return second.qualityScore - first.qualityScore;
      if (second.interestScore !== first.interestScore) return second.interestScore - first.interestScore;
      return first.id.localeCompare(second.id);
    };
    const scoreA = scoreHomeFeedPost(a, userQualityValueById, userInfluenceAuraById);
    const scoreB = scoreHomeFeedPost(b, userQualityValueById, userInfluenceAuraById);
    const diff = scoreB - scoreA;
    if (Math.abs(diff) > 0.001) return diff;
    return byRecent(a, b);
  };

  const feedPosts = [...visiblePosts].sort(byCommunityValue).slice(0, 14);
  const topicBlocks = groupByTopic(visiblePosts);
  const groupOptions = useMemo(() => {
    const topics = Array.from(new Set(posts.flatMap((post) => post.topics))).sort();
    return ["all", ...topics];
  }, [posts]);
  useEffect(() => {
    if (!groupOptions.includes(selectedGroup)) setSelectedGroup("all");
  }, [groupOptions, selectedGroup]);
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
        auraAverage: 0,
        collaborationRatio: 0,
        commentedRatio: 0,
        ratedRatio: 0
      };
    }

    const activeAuthors = new Set(visiblePosts.map((post) => post.userId)).size;
    const auraAverage = Math.round(
      visiblePosts.reduce((acc, post) => acc + post.interestScore, 0) / Math.max(1, visiblePosts.length)
    );
    const collaborativeCount = visiblePosts.filter((post) => (post.contributorUserIds?.length ?? 1) > 1).length;
    const commentedCount = visiblePosts.filter((post) => (post.comments?.length ?? 0) > 0).length;
    const ratedCount = visiblePosts.filter((post) => (post.feedbacks?.length ?? 0) > 0).length;

    const collaborationRatio = Math.round((collaborativeCount / total) * 100);
    const commentedRatio = Math.round((commentedCount / total) * 100);
    const ratedRatio = Math.round((ratedCount / total) * 100);
    const healthScore = Math.round(
      auraAverage * 0.42 +
      collaborationRatio * 0.2 +
      commentedRatio * 0.2 +
      ratedRatio * 0.18
    );

    return {
      healthScore,
      activeAuthors,
      auraAverage,
      collaborationRatio,
      commentedRatio,
      ratedRatio
    };
  }, [visiblePosts]);

  useEffect(() => {
    const key = `wee_onboarding_seen_${activeUser.id}`;
    const seen = localStorage.getItem(key);
    setShowOnboarding(!seen);
    const compactKey = `wee_compact_feed_${activeUser.id}`;
    setCompactFeed(localStorage.getItem(compactKey) === "1");
  }, [activeUser.id]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const onChange = (event: MediaQueryListEvent) => setIsMobileView(event.matches);
    setIsMobileView(media.matches);
    if (media.addEventListener) {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }
    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (isMobileView && compactFeed) {
      setCompactFeed(false);
      localStorage.setItem(`wee_compact_feed_${activeUser.id}`, "0");
    }
  }, [isMobileView, compactFeed, activeUser.id]);

  useEffect(() => {
    const sectionIds = ["feed-section", "topics-section", "community-section"];
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
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      if (isMobileView) {
        if (currentY < 28) {
          setMobileNavHidden(false);
        } else if (delta > 8) {
          setMobileNavHidden(true);
        } else if (delta < -8) {
          setMobileNavHidden(false);
        }
      }
      lastScrollY.current = currentY;
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
  }, [isMobileView]);

  const closeOnboarding = (): void => {
    const key = `wee_onboarding_seen_${activeUser.id}`;
    localStorage.setItem(key, "1");
    setShowOnboarding(false);
  };

  const scrollToSection = (id: string): void => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleCompactFeed = (): void => {
    if (isMobileView) return;
    setCompactFeed((prev) => {
      const next = !prev;
      localStorage.setItem(`wee_compact_feed_${activeUser.id}`, next ? "1" : "0");
      return next;
    });
  };

  return (
    <main>
      <TopBar user={activeUser} onOpenShare={onOpenShareModal} onLogout={onLogout} />

      {showOnboarding ? (
        <section className="page-section onboarding-card">
          <div className="section-head">
            <h2><Icon name="spark" /> {pick(language, "Arranca en 3 pasos", "Start in 3 quick steps", "Arrinca en 3 pasos")}</h2>
            <button type="button" className="btn" onClick={closeOnboarding}>{pick(language, "Vamos", "Let's go", "Imos")}</button>
          </div>
          <ol className="onboarding-list">
            <li>{pick(language, "Pega un link y Wee lo coloca donde toca.", "Paste a link and Wee puts it in the right place.", "Pega unha ligazón e Wee colócaa onde toca.")}</li>
            <li>{pick(language, "Abre la fuente y vota para subir lo útil.", "Open the source and vote so useful content rises.", "Abre a fonte e vota para subir o útil.")}</li>
            <li>{pick(language, "Añade contexto en comentarios y ayudas a todo el grupo.", "Add context in comments and help the whole group.", "Engade contexto nos comentarios e axudas a todo o grupo.")}</li>
          </ol>
        </section>
      ) : null}

      <div className="home-layout" id="home-top">
        <aside className="home-sidebar">
          <div className="home-sidebar-stack">
            <nav className={`home-side-nav${mobileNavHidden ? " is-hidden" : ""}`} aria-label={pick(language, "Navegación de Wee", "Wee navigation", "Navegación de Wee")}>
              <button
                type="button"
                className={activeSection === "feed-section" ? "side-nav-btn active" : "side-nav-btn"}
                onClick={() => scrollToSection("feed-section")}
              >
                <Icon name="chili" /> {pick(language, "Feed", "Feed", "Feed")}
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
                className={activeSection === "community-section" ? "side-nav-btn active" : "side-nav-btn"}
                onClick={() => scrollToSection("community-section")}
              >
                <Icon name="users" /> {pick(language, "Comunidad", "Community", "Comunidade")}
              </button>
            </nav>
            <label className="home-sidebar-search" aria-label={pick(language, "Tema actual", "Current topic", "Tema actual")}>
              <Icon name="book" size={13} />
              <select
                value={selectedGroup}
                onChange={(event) => setSelectedGroup(event.target.value)}
                className="settings-select"
              >
                {groupOptions.map((group) => (
                  <option key={group} value={group}>
                    {group === "all"
                      ? pick(language, "Tema: Todos", "Topic: All", "Tema: Todos")
                      : `${pick(language, "Tema", "Topic", "Tema")}: ${group}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={`btn home-mobile-extras-toggle${mobileExtrasOpen ? " is-open" : ""}`}
              onClick={() => setMobileExtrasOpen((prev) => !prev)}
              aria-expanded={mobileExtrasOpen}
            >
              <Icon name="settings" size={13} />
              {mobileExtrasOpen
                ? pick(language, "Ocultar extras", "Hide extras", "Ocultar extras")
                : pick(language, "Ver extras", "Show extras", "Ver extras")}
            </button>
            <div className={`home-sidebar-extras${mobileExtrasOpen ? " is-open" : ""}`}>
              <section className="home-users-block">
                <div className="home-users-head">
                  <h4><Icon name="users" size={14} /> {pick(language, "Gente activa", "Active people", "Xente activa")}</h4>
                  <span className="badge">{activeUsers.length}</span>
                </div>
                {usersSidebarList.length === 0 ? (
                  <p className="hint">{pick(language, "Aún no se movió nada por aquí.", "Nothing has moved here yet.", "Aínda non se moveu nada por aquí.")}</p>
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
                      ? pick(language, "Ver solo activos", "Show active only", "Ver só activos")
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

          </div>
        </aside>

        <div className="home-main">
          <section className="page-section section-latest" id="feed-section">
            <div className="section-head">
              <h2>
                <Icon name="chili" />{" "}
                {selectedGroup === "all"
                  ? pick(language, "Lo que está sonando", "What's popping now", "O que está soando")
                  : `${pick(language, "Popular en", "Popular in", "Popular en")} ${selectedGroup}`}
              </h2>
              {!isMobileView ? (
                <button type="button" className="btn" onClick={toggleCompactFeed}>
                  <Icon name="news" size={13} /> {compactFeed
                    ? pick(language, "Ver grande", "Expanded view", "Ver grande")
                    : pick(language, "Ver compacto", "Compact view", "Ver compacto")}
                </button>
              ) : null}
            </div>
            <p className="section-intro">
              {pick(language, "Lo que más está ayudando y moviendo conversación ahora mismo.", "What is helping most and driving conversation right now.", "O que máis está axudando e movendo conversa agora mesmo.")}
            </p>
            <div className={compactFeed ? "post-grid post-grid-compact" : "post-grid"}>
              {feedPosts.length > 0 ? (
                feedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    author={usersById.get(post.userId)}
                    compact={compactFeed}
                    onOpenDetail={(entry) => navigate(`/post/${entry.id}`)}
                  />
                ))
              ) : (
                <article className="empty-state">
                  <h3>{pick(language, "Aquí falta tu primer aporte", "Your first contribution is missing here", "Aquí falta a túa primeira achega")}</h3>
                  <p>{pick(language, "Comparte una noticia y abrimos el hilo entre todos.", "Share a post and we will open the thread together.", "Comparte unha nova e abrimos o fío entre todos.")}</p>
                  <button type="button" className="btn btn-primary" onClick={onOpenShareModal}>{pick(language, "Compartir ahora", "Share now", "Compartir agora")}</button>
                </article>
              )}
            </div>
          </section>

          <section className="page-section section-topics" id="topics-section">
            <div className="section-head">
              <h2><Icon name="book" /> {pick(language, "Temas en marcha", "Topics in motion", "Temas en marcha")}</h2>
            </div>
            <p className="section-intro">{pick(language, "Cada tema es un hilo vivo: misma conversación, menos ruido y más contexto útil.", "Each topic is a live thread: same conversation, less noise and more useful context.", "Cada tema é un fío vivo: mesma conversa, menos ruído e máis contexto útil.")}</p>
            <div className="topic-grid">
              {topicBlocks.map((block) => (
                <TopicBlock key={block.topic} topic={block.topic} posts={block.posts} />
              ))}
            </div>
          </section>

          <section className="page-section section-collab" id="community-section">
            <div className="section-head">
              <h2><Icon name="users" /> {pick(language, "Comunidad", "Community", "Comunidade")}</h2>
              <p className="hint">{pick(language, "Aquí se ve quién está tirando del grupo con aportes útiles y constancia.", "Here you can see who is pulling the group forward with useful, consistent contributions.", "Aquí vese quen está tirando do grupo con achegas útiles e constancia.")}</p>
            </div>

            <div className="community-health">
              <article className="health-main">
                <h3><Icon name="target" /> {pick(language, "Pulso de la comunidad", "Community pulse", "Pulso da comunidade")}</h3>
                <p>
                  {pick(language, "Cómo va la comunidad", "How the community is doing", "Como vai a comunidade")}:{" "}
                  <strong>{communityPulse.healthScore}/100</strong> · {communityPulse.activeAuthors}{" "}
                  {pick(language, "personas activas", "active people", "persoas activas")}
                </p>
                <div className="health-bar">
                  <span style={{ width: `${communityPulse.healthScore}%` }} />
                </div>
              </article>

              <div className="health-kpis">
                <article className="health-kpi">
                  <h4>{pick(language, "Aura media", "Average Aura")}</h4>
                  <p>{communityPulse.auraAverage}</p>
                </article>
                <article className="health-kpi">
                  <h4>{pick(language, "Colaboración", "Collab", "Colaboración")}</h4>
                  <p>{communityPulse.collaborationRatio}%</p>
                </article>
                <article className="health-kpi">
                  <h4>{pick(language, "Con comentarios", "With comments", "Con comentarios")}</h4>
                  <p>{communityPulse.commentedRatio}%</p>
                </article>
                <article className="health-kpi">
                  <h4>{pick(language, "Con votos", "With ratings", "Con votos")}</h4>
                  <p>{communityPulse.ratedRatio}%</p>
                </article>
              </div>
            </div>

            <div className="community-actions">
              <button type="button" className="btn btn-primary" onClick={onOpenShareModal}>
                <Icon name="plus" /> {pick(language, "Aportar ahora", "Contribute now", "Aportar agora")}
              </button>
              <button type="button" className="btn" onClick={() => scrollToSection("topics-section")}>
                <Icon name="book" /> {pick(language, "Ir a temas", "Go to topics", "Ir a temas")}
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
                      {entry.count} {pick(language, "aportes", "contributions", "achegas")} ·
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
