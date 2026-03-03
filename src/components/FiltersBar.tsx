import type { SearchFilters } from "../lib/types";

interface FiltersBarProps {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  availableTopics: string[];
  availableDomains: string[];
}

export const FiltersBar = ({ filters, onChange, availableTopics, availableDomains }: FiltersBarProps) => (
  <section className="filters">
    <input
      type="search"
      placeholder="Buscar por texto, tema o dominio"
      value={filters.query}
      onChange={(event) => onChange({ ...filters, query: event.target.value })}
    />

    <select
      value={filters.qualityLabel}
      onChange={(event) => onChange({ ...filters, qualityLabel: event.target.value as SearchFilters["qualityLabel"] })}
    >
      <option value="all">Toda la calidad</option>
      <option value="high">Alta</option>
      <option value="medium">Media</option>
      <option value="low">Baja</option>
      <option value="clickbait">Clickbait</option>
    </select>

    <select value={filters.topic} onChange={(event) => onChange({ ...filters, topic: event.target.value })}>
      <option value="all">Todos los temas</option>
      {availableTopics.map((topic) => (
        <option key={topic} value={topic}>
          {topic}
        </option>
      ))}
    </select>

    <select value={filters.domain} onChange={(event) => onChange({ ...filters, domain: event.target.value })}>
      <option value="all">Todos los dominios</option>
      {availableDomains.map((domain) => (
        <option key={domain} value={domain}>
          {domain}
        </option>
      ))}
    </select>
  </section>
);
