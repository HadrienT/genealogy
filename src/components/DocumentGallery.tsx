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

interface Props {
  personId: string;
}

const isImage = (mime: string) => mime.startsWith("image/");
const isPdf = (mime: string) => mime === "application/pdf";

/** Build authenticated URL for viewing a document */
function docUrl(personId: string, docId: string, download?: boolean) {
  const base = `${API_BASE}/api/persons/${personId}/documents/${docId}`;
  return download ? `${base}?download=1` : base;
}

const DocumentGallery: React.FC<Props> = ({ personId }) => {
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

  // Load image thumbnails as authenticated blob URLs
  useEffect(() => {
    const imageDocs = docs.filter((d) => isImage(d.mimeType));
    let cancelled = false;
    (async () => {
      const newUrls: Record<string, string> = {};
      for (const doc of imageDocs) {
        if (blobUrls[doc.id]) continue;
        try {
          const res = await fetch(docUrl(personId, doc.id), {
            headers: authHeaders(),
          });
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

  // Cleanup blob URLs on unmount
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
      const res = await fetch(docUrl(personId, doc.id, true), {
        headers: authHeaders(),
      });
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
      <div style={{ marginTop: 12, color: "#94a3b8", fontSize: 12 }}>
        {t("docs.loading")}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={headerRowStyle}>
        <div style={sectionLabelStyle}>
          {t("docs.title")} {docs.length > 0 && <span style={countBadge}>{docs.length}</span>}
        </div>
        {isEditor && (
          <label style={uploadBtnStyle}>
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
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
          {t("docs.empty")}
        </div>
      )}

      {/* Thumbnail grid */}
      {docs.length > 0 && (
        <div style={gridStyle}>
          {docs.map((doc) => (
            <div
              key={doc.id}
              style={thumbCardStyle}
              onClick={() => setViewDoc(doc)}
              title={doc.name}
            >
              {isImage(doc.mimeType) && blobUrls[doc.id] ? (
                <img
                  src={blobUrls[doc.id]}
                  alt={doc.name}
                  style={thumbImgStyle}
                />
              ) : (
                <div style={thumbPlaceholderStyle}>
                  <span style={{ fontSize: 28 }}>{fileIcon(doc.mimeType)}</span>
                  <span style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>
                    {doc.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
              )}
              <div style={thumbLabelStyle} title={doc.name}>
                {doc.name.length > 18 ? doc.name.slice(0, 15) + "…" : doc.name}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Viewer Modal ─────────────────────────── */}
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

// ── Document Viewer Modal ───────────────────────

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

  // For non-image files (PDF, etc.), fetch as blob and create object URL
  useEffect(() => {
    if (blobUrl) {
      setContentUrl(blobUrl);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(docUrl(personId, doc.id), {
          headers: authHeaders(),
        });
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

  // Cleanup non-shared blob URLs
  useEffect(() => {
    return () => {
      if (contentUrl && contentUrl !== blobUrl) {
        URL.revokeObjectURL(contentUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={modalHeaderStyle}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {doc.name}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              {formatSize(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {isEditor && (
              <>
                <button onClick={onDownload} style={modalActionBtn} title={t("docs.download")}>
                  ⬇️
                </button>
                <button onClick={onDelete} style={{ ...modalActionBtn, color: "#ef4444" }} title={t("docs.delete")}>
                  🗑️
                </button>
              </>
            )}
            <button onClick={onClose} style={modalActionBtn} title={t("detail.close")}>
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={modalContentStyle}>
          {!contentUrl ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8" }}>
              {t("docs.loading")}
            </div>
          ) : isImage(doc.mimeType) ? (
            <img
              src={contentUrl}
              alt={doc.name}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 4 }}
            />
          ) : isPdf(doc.mimeType) ? (
            <iframe
              src={contentUrl}
              title={doc.name}
              style={{ width: "100%", height: "100%", border: "none", borderRadius: 4 }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
              <span style={{ fontSize: 48 }}>📎</span>
              <div style={{ fontSize: 14, color: "#64748b" }}>{doc.name}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{t("docs.noPreview")}</div>
              {isEditor && (
                <button onClick={onDownload} style={downloadBtnStyle}>
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

// ── Styles ──────────────────────────────────────

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const countBadge: React.CSSProperties = {
  fontSize: 10,
  background: "#f1f5f9",
  color: "#64748b",
  padding: "1px 6px",
  borderRadius: 8,
  fontWeight: 500,
};

const uploadBtnStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#3b82f6",
  cursor: "pointer",
  padding: "3px 10px",
  border: "1px dashed #93c5fd",
  borderRadius: 6,
  background: "#eff6ff",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
  gap: 8,
  marginTop: 8,
};

const thumbCardStyle: React.CSSProperties = {
  cursor: "pointer",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  overflow: "hidden",
  background: "white",
  transition: "box-shadow 0.15s",
};

const thumbImgStyle: React.CSSProperties = {
  width: "100%",
  height: 72,
  objectFit: "cover",
  display: "block",
};

const thumbPlaceholderStyle: React.CSSProperties = {
  width: "100%",
  height: 72,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#f8fafc",
};

const thumbLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#64748b",
  padding: "4px 6px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
};

const modalStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 12,
  width: "min(90vw, 900px)",
  height: "min(85vh, 700px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "12px 16px",
  borderBottom: "1px solid #e2e8f0",
  gap: 12,
};

const modalActionBtn: React.CSSProperties = {
  background: "none",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 14,
  padding: "4px 8px",
  lineHeight: 1,
};

const modalContentStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  overflow: "auto",
  background: "#f8fafc",
};

const downloadBtnStyle: React.CSSProperties = {
  padding: "8px 20px",
  background: "#3b82f6",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

export default DocumentGallery;
