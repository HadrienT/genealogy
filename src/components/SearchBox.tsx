import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFamily } from "../hooks/useFamily";
import { useI18n } from "../hooks/useI18n";
import { formatTreeBirthPlace } from "../utils/formatTreeBirthPlace";
import type { Person } from "../types/person";

const MAX_RESULTS = 12;

/** Lower case, no accents: "Hélène" and "helene" match each other. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const years = (p: Person) => {
  const b = p.birthDate?.slice(0, 4);
  const d = p.deathDate?.slice(0, 4);
  return b || d ? `${b ?? "?"} – ${d ?? ""}`.trim() : "";
};

/** Name search in the header: every word typed must appear in one of the person's names. */
const SearchBox: React.FC<{ onPick: (id: string) => void }> = ({ onPick }) => {
  const { people } = useFamily();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const index = useMemo(
    () =>
      people.map((p) => ({
        person: p,
        first: fold(p.firstName ?? ""),
        last: fold(p.lastName ?? ""),
        all: fold([p.firstName, p.middleNames, p.lastName, p.maidenName].filter(Boolean).join(" ")),
      })),
    [people]
  );

  const { results, total } = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (words.length === 0) return { results: [], total: 0 };
    const scored: { person: Person; score: number }[] = [];
    for (const entry of index) {
      if (!words.every((w) => entry.all.includes(w))) continue;
      // names starting with what was typed come first
      const score = words.reduce(
        (sum, w) => sum + (entry.last.startsWith(w) ? 2 : 0) + (entry.first.startsWith(w) ? 1 : 0),
        0
      );
      scored.push({ person: entry.person, score });
    }
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        (a.person.lastName ?? "").localeCompare(b.person.lastName ?? "") ||
        (a.person.birthDate ?? "").localeCompare(b.person.birthDate ?? "")
    );
    return { results: scored.slice(0, MAX_RESULTS).map((s) => s.person), total: scored.length };
  }, [index, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "");
      if ((e.key === "/" && !typing) || (e.key === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  const pick = (p: Person) => {
    onPick(p.id);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (e.key === "Enter") {
      if (results[active]) pick(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="search" ref={wrapRef}>
      <input
        ref={inputRef}
        className="search__input"
        type="search"
        value={query}
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        title={t("search.shortcut")}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && query.trim() && (
        <div className="menu search__menu" role="listbox">
          {results.length === 0 ? (
            <div className="search__empty">{t("search.none")}</div>
          ) : (
            results.map((p, i) => (
              <button
                key={p.id}
                role="option"
                aria-selected={i === active}
                className={"search__item" + (i === active ? " search__item--active" : "")}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <span className="search__name">
                  {[p.firstName, p.lastName].filter(Boolean).join(" ") || `#${p.id.slice(0, 6)}`}
                  {p.maidenName && <em> née {p.maidenName}</em>}
                </span>
                <span className="search__meta">
                  {[years(p), formatTreeBirthPlace(p)].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))
          )}
          {total > results.length && (
            <div className="search__empty">{t("search.more", { n: String(total - results.length) })}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBox;
