import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { isDownloadLink } from "@/lib/chat-config";

export function ChatMarkdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => {
      if (!href) return <span>{children}</span>;
      if (isDownloadLink(href)) return <Button asChild className="vg-btn vg-btn-primary vg-download"><a href={href} target="_blank" rel="noopener noreferrer">📎 Baixar arquivo</a></Button>;
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
    table: ({ children }) => <div className="vg-table-scroll"><table>{children}</table></div>,
  }}>{text}</ReactMarkdown>;
}