import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../hooks/useI18n";
import type { TranslationKey } from "../hooks/useI18n";

const API_BASE = import.meta.env.VITE_API_URL || "";
const TOKEN_KEY = "genealogy-auth-token";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface DocMeta {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

const isImage = (mime: string) => mime.startsWith("image/");
const isPdf = (mime: string) => mime === "application/pdf";

function docUrl(personId: string, docId: string, download?: boolean) {
  const base = `${API_BASE}/api/persons/${personId}/documents/${docId}`;
  return download ? `${base}?download=1` : base;
}

const DocumentGallery: React.FC<{ personId: string }> = ({ personId }) => {
  const { isEditor } = useAuth();
  const { t } = useI18n();
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewDoc, setViewDoc] = useState<DocMeta | null>(null);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/persons/${personId}/documents`, {
        headers: authHeaders(),
      });
      if (res.ok) setDocs(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    setDocs([]);
    setLoading(true);
    setBlobUrls({});
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    const imageDocs = docs.filter((d) => isImage(d.mimeType));
    let cancelled = false;
    (async () => {
      const newUrls: Record<string, string> = {};
      for (const doc of imageDocs) {
        if (blobUrls[doc.id]) continue;
        try {
          const res = await fetch(docUrl(personId, doc.id), { headers: authHeaders() });
          if (!res.ok) continue;
          const blob = await res.blob();
          if (cancelled) return;
          newUrls[doc.id] = URL.createObjectURL(blob);
        } catch {
          /* ignore */
        }
      }
      if (!cancelled && Object.keys(newUrls).length > 0) {
        setBlobUrls((prev) => ({ ...prev, ...newUrls }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, personId]);

  useEffect(() => {
    return () => {
      Object.values(blobUrls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        await fetch(`${API_BASE}/api/persons/${personId}/documents`, {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        });
      }
      await fetchDocs();
    } catch {
      /* ignore */
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm(t("docs.confirmDelete"))) return;
    try {
      await fetch(`${API_BASE}/api/persons/${personId}/documents/${docId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (viewDoc?.id === docId) setViewDoc(null);
    } catch {
      /* ignore */
    }
  };

  const handleDownload = async (doc: DocMeta) => {
    try {
      const res = await fetch(docUrl(personId, doc.id, true), { headers: authHeaders() });
      if (!res.ok) return;
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch {
      /* ignore */
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileIcon = (mime: string) => {
    if (isImage(mime)) return "🖼️";
    if (isPdf(mime)) return "📄";
    if (mime.startsWith("video/")) return "🎥";
    if (mime.startsWith("audio/")) return "🎵";
    return "📎";
  };

  if (loading) {
    return (
      <div style={{ marginTop: 12, color: "var(--ink-faint)", fontSize: 12 }}>
        {t("docs.loading")}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div className="section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {t("docs.title")}
          {docs.length > 0 && <span className="chip">{docs.length}</span>}
        </div>
        {isEditor && (
          <label className="upload-btn">
            {uploading ? t("docs.uploading") : t("docs.upload")}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleUpload}
              style={{ display: "none" }}
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {docs.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 6 }}>
          {t("docs.empty")}
        </div>
      )}

      {docs.length > 0 && (
        <div className="docgrid">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="doccard"
              onClick={() => setViewDoc(doc)}
              title={doc.name}
            >
              {isImage(doc.mimeType) && blobUrls[doc.id] ? (
                <img className="doccard__media" src={blobUrls[doc.id]} alt={doc.name} />
              ) : (
                <div className="doccard__ph">
                  <span style={{ fontSize: 26 }}>{fileIcon(doc.mimeType)}</span>
                  <span style={{ fontSize: 9, color: "var(--ink-faint)", marginTop: 2 }}>
                    {doc.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="doccard__label">
                {doc.name.length > 18 ? doc.name.slice(0, 15) + "…" : doc.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewDoc && (
        <DocumentViewer
          personId={personId}
          doc={viewDoc}
          blobUrl={blobUrls[viewDoc.id]}
          isEditor={isEditor}
          onClose={() => setViewDoc(null)}
          onDelete={() => handleDelete(viewDoc.id)}
          onDownload={() => handleDownload(viewDoc)}
          formatSize={formatSize}
          t={t}
        />
      )}
    </div>
  );
};

interface ViewerProps {
  personId: string;
  doc: DocMeta;
  blobUrl?: string;
  isEditor: boolean;
  onClose: () => void;
  onDelete: () => void;
  onDownload: () => void;
  formatSize: (n: number) => string;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
}

const DocumentViewer: React.FC<ViewerProps> = ({
  personId,
  doc,
  blobUrl,
  isEditor,
  onClose,
  onDelete,
  onDownload,
  formatSize,
  t,
}) => {
  const [contentUrl, setContentUrl] = useState<string | null>(blobUrl ?? null);

  useEffect(() => {
    if (blobUrl) {
      setContentUrl(blobUrl);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(docUrl(personId, doc.id), { headers: authHeaders() });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        setContentUrl(URL.createObjectURL(blob));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [personId, doc.id, blobUrl]);

  useEffect(() => {
    return () => {
      if (contentUrl && contentUrl !== blobUrl) URL.revokeObjectURL(contentUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="viewer" onClick={(e) => e.stopPropagation()}>
        <div className="viewer__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 15,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {doc.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
              {formatSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {isEditor && (
              <>
                <button className="btn btn--icon" onClick={onDownload} title={t("docs.download")}>
                  ⬇️
                </button>
                <button className="btn btn--icon btn--danger" onClick={onDelete} title={t("docs.delete")}>
                  🗑️
                </button>
              </>
            )}
            <button className="iconclose" onClick={onClose} title={t("detail.close")}>
              ✕
            </button>
          </div>
        </div>

        <div className="viewer__body">
          {!contentUrl ? (
            <div style={{ color: "var(--ink-faint)" }}>{t("docs.loading")}</div>
          ) : isImage(doc.mimeType) ? (
            <img
              src={contentUrl}
              alt={doc.name}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6 }}
            />
          ) : isPdf(doc.mimeType) ? (
            <iframe
              src={contentUrl}
              title={doc.name}
              style={{ width: "100%", height: "100%", border: "none", borderRadius: 6 }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 44 }}>📎</span>
              <div style={{ fontSize: 14 }}>{doc.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                {t("docs.noPreview")}
              </div>
              {isEditor && (
                <button className="btn btn--primary" onClick={onDownload}>
                  {t("docs.download")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentGallery;
