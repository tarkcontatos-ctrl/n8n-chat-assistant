import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { extractFileLinks, isDownloadLink } from "@/lib/chat-config";

function isForcedDownload(href: string) {
  try { return new URL(href).searchParams.get("download") === "1"; } catch { return false; }
}

function ChatImage({ src, alt }: { src?: string | undefined; alt?: string | undefined }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  if (failed) return <Button asChild className="vg-btn vg-btn-outline vg-download"><a href={src} target="_blank" rel="noopener noreferrer">🖼️ Abrir imagem</a></Button>;
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="vg-img-link" title="Abrir imagem ampliada">
      <img src={src} alt={alt ?? ""} loading="lazy" className="vg-chat-img" onError={() => setFailed(true)} />
    </a>
  );
}

export function ChatMarkdown({ text }: { text: string }) {
  const { text: body, files } = useMemo(() => extractFileLinks(text), [text]);
  return (
    <>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
        a: ({ href, children }) => {
          if (!href) return <span>{children}</span>;
          if (isDownloadLink(href)) {
            const dl = isForcedDownload(href);
            return <Button asChild className="vg-btn vg-btn-primary vg-download"><a href={href} target="_blank" rel="noopener noreferrer">{dl ? "📎 Baixar arquivo" : "📄 Abrir arquivo"}</a></Button>;
          }
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        },
        img: ({ src, alt }) => <ChatImage src={typeof src === "string" ? src : undefined} alt={alt} />,
        table: ({ children }) => <div className="vg-table-scroll"><table>{children}</table></div>,
      }}>{body}</ReactMarkdown>

      {files.map((file) => (
        <div key={file.id} className="vg-file" role="group" aria-label={`Arquivo ${file.name}`}>
          <span className="vg-file-name">📄 {file.name}</span>
          <span className="vg-file-actions">
            <Button asChild className="vg-btn vg-btn-outline vg-download"><a href={file.previewUrl} target="_blank" rel="noopener noreferrer">🔍 Prévia</a></Button>
            <Button asChild className="vg-btn vg-btn-primary vg-download"><a href={file.downloadUrl} target="_blank" rel="noopener noreferrer">⬇️ Baixar</a></Button>
          </span>
        </div>
      ))}
    </>
  );
}
