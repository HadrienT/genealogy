import React, { useEffect, useRef, useState } from "react";
import { useFamily } from "../hooks/useFamily";
import { useI18n } from "../hooks/useI18n";
import { useIssueText, nameOf } from "../hooks/useIssueText";
import type { Issue } from "../utils/checks";

/** Header chip listing the inconsistencies found in the current tree. */
const IssuesMenu: React.FC<{ issues: Issue[]; onPick: (id: string) => void }> = ({ issues, onPick }) => {
  const { getPersonById } = useFamily();
  const { t } = useI18n();
  const describe = useIssueText();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (issues.length === 0) return null;

  return (
    <div className="issues" ref={ref}>
      <button
        className="chip chip--issues"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={t("issue.count", { n: String(issues.length) })}
        aria-label={t("issue.count", { n: String(issues.length) })}
      >
        ⚠ {issues.length}
      </button>
      {open && (
        <div className="menu issues__menu">
          <div className="menu__header">{t("issue.title")}</div>
          <div className="issues__list">
            {issues.map((issue, i) => (
              <button
                key={i}
                className="issues__item"
                onClick={() => {
                  onPick(issue.personId);
                  setOpen(false);
                }}
              >
                <strong>{nameOf(getPersonById(issue.personId))}</strong>
                <span>{describe(issue)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IssuesMenu;
