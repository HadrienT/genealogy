import React, { useMemo } from "react";
import { useFamily } from "../hooks/useFamily";
import { useI18n } from "../hooks/useI18n";
import { computeStats, type Average, type Count } from "../utils/stats";

interface BarRow {
  label: string;
  /** 0–1 */
  share: number;
  value: string;
  note?: string;
}

/** Horizontal bars: one hue, values written out, so it also reads as a table. */
const Bars: React.FC<{ rows: BarRow[]; empty: string }> = ({ rows, empty }) =>
  rows.length === 0 ? (
    <p className="stats__empty">{empty}</p>
  ) : (
    <table className="bars">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} title={`${r.label} : ${r.value}${r.note ? ` (${r.note})` : ""}`}>
            <th scope="row">{r.label}</th>
            <td className="bars__track">
              <div className="bars__bar" style={{ width: `${Math.max(r.share * 100, 0.5)}%` }} />
            </td>
            <td className="bars__value">
              {r.value}
              {r.note && <span className="bars__note"> {r.note}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

const countRows = (counts: Count[]): BarRow[] => {
  const max = Math.max(...counts.map((c) => c.n), 1);
  return counts.map((c) => ({ label: c.label, share: c.n / max, value: String(c.n) }));
};

const StatsView: React.FC = () => {
  const { people, marriages } = useFamily();
  const { t, lang } = useI18n();
  const s = useMemo(() => computeStats(people, marriages), [people, marriages]);

  const num = (n: number) => n.toLocaleString(lang);
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)} %` : "–");
  const years = (n: number) => t("stats.years", { n: n.toLocaleString(lang, { maximumFractionDigits: 1 }) });
  const sample = (n: number) => t("stats.sample", { n: String(n) });
  const averageRows = (rows: Average[], scale: number, label = (r: Average) => r.label): BarRow[] =>
    rows
      .filter((r) => r.n > 0)
      .map((r) => ({ label: label(r), share: r.avg / scale, value: years(r.avg), note: sample(r.n) }));

  const rootName = s.root
    ? [s.root.firstName, s.root.lastName].filter(Boolean).join(" ")
    : "";
  const knownAncestors = s.generations.reduce((sum, g) => sum + g.known, 0);

  const tiles: [string, string, string?][] = [
    [num(s.total), t("stats.people"), t("stats.menWomen", { men: num(s.men), women: num(s.women) })],
    [String(s.generations.length), t("stats.generations"), rootName && t("stats.above", { name: rootName })],
    [num(knownAncestors), t("stats.ancestors")],
    [s.firstYear !== null ? `${s.firstYear} – ${s.lastYear}` : "–", t("stats.period")],
    [pct(s.withBirthDate, s.total), t("stats.withBirthDate")],
    [pct(s.withBirthPlace, s.total), t("stats.withBirthPlace")],
    [num(s.marriages), t("stats.marriages")],
  ];

  return (
    <div className="stats">
      <div className="stats__tiles">
        {tiles.map(([value, label, note]) => (
          <div className="stats__tile floating" key={label}>
            <div className="stats__figure">{value}</div>
            <div className="stats__label">{label}</div>
            {note && <div className="stats__note">{note}</div>}
          </div>
        ))}
      </div>

      <div className="stats__grid">
        <section className="stats__card floating stats__card--wide">
          <h3>{t("stats.completeness")}</h3>
          <p className="stats__hint">{t("stats.completenessHint", { name: rootName })}</p>
          <Bars
            empty={t("stats.none")}
            rows={s.generations.map((g) => ({
              label: t("stats.generationN", { n: String(g.gen) }),
              share: g.known / g.expected,
              value: `${num(g.known)} / ${num(g.expected)}`,
              note: pct(g.known, g.expected),
            }))}
          />
        </section>

        <section className="stats__card floating">
          <h3>{t("stats.births")}</h3>
          <Bars empty={t("stats.none")} rows={countRows(s.births)} />
        </section>

        <section className="stats__card floating">
          <h3>{t("stats.longevity")}</h3>
          <p className="stats__hint">{t("stats.longevityHint")}</p>
          <Bars empty={t("stats.none")} rows={averageRows(s.longevity, 100)} />
        </section>

        <section className="stats__card floating">
          <h3>{t("stats.parentAge")}</h3>
          <Bars
            empty={t("stats.none")}
            rows={averageRows(s.parentAge, 60, (r) => t(r.label === "father" ? "stats.fathers" : "stats.mothers"))}
          />
          <h3 className="stats__sub">{t("stats.marriageAge")}</h3>
          <Bars
            empty={t("stats.none")}
            rows={averageRows(s.marriageAge, 60, (r) => t(r.label === "men" ? "stats.men" : "stats.women"))}
          />
        </section>

        <section className="stats__card floating">
          <h3>{t("stats.surnames")}</h3>
          <Bars empty={t("stats.none")} rows={countRows(s.surnames)} />
        </section>

        <section className="stats__card floating">
          <h3>{t("stats.firstNamesMen")}</h3>
          <Bars empty={t("stats.none")} rows={countRows(s.firstNamesMen)} />
        </section>

        <section className="stats__card floating">
          <h3>{t("stats.firstNamesWomen")}</h3>
          <Bars empty={t("stats.none")} rows={countRows(s.firstNamesWomen)} />
        </section>

        <section className="stats__card floating">
          <h3>{t("stats.places")}</h3>
          <Bars empty={t("stats.none")} rows={countRows(s.places)} />
        </section>

        <section className="stats__card floating">
          <h3>{t("stats.regions")}</h3>
          <Bars empty={t("stats.none")} rows={countRows(s.regions)} />
        </section>
      </div>
    </div>
  );
};

export default StatsView;
