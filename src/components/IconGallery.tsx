import { Icon, type IconName } from "./Icon";

const ICONS: IconName[] = ["search", "plus", "bolt", "users", "check", "chili", "news", "book", "settings", "trophy", "dice"];

export const IconGallery = () => (
  <section className="icon-gallery">
    <h3>Icon Gallery</h3>
    <div className="icon-grid">
      {ICONS.map((name) => (
        <article key={name} className="icon-card">
          <Icon name={name} size={18} />
          <span>{name}</span>
        </article>
      ))}
    </div>
  </section>
);
