// Production endpoints: change these constants when the automation changes.
export const CHAT_URL = "https://n8n.srv2083175.hstgr.cloud/webhook/9afdce04-6b40-4816-8644-9bfd011013bc/chat";
export const DOWNLOAD_URL = "https://n8n.srv2083175.hstgr.cloud/webhook/vigyon-arquivo";

export const CHAT_TIMEOUT_MS = 300_000;
export const CHAT_WAIT_NOTICE_MS = 15_000;
export const CHAT_MAX_CHARACTERS = 8000;
export const CHAT_SESSION_KEY = "vigyon-chat-session-id";
export const CHAT_ERROR = "Não consegui responder agora. Tente novamente.";
export const CHAT_LONG_WAIT = "Gerando sua resposta, isso pode levar alguns minutos...";

export function validateChatInput(input: { message: string; sessionId: string }) {
  if (typeof input?.message !== "string" || !input.message.trim()) throw new Error("Mensagem vazia.");
  if (input.message.length > CHAT_MAX_CHARACTERS) throw new Error("Sua mensagem ultrapassa 8000 caracteres. Reduza o texto antes de enviar.");
  if (typeof input.sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.sessionId)) throw new Error("Sessão inválida.");
  return { message: input.message.trim(), sessionId: input.sessionId };
}

export function readChatOutput(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("output" in value) || typeof value.output !== "string" || !value.output.trim()) {
    throw new Error("Resposta inválida: esperado output em texto.");
  }
  return value.output;
}

export function getChatSession(storage: Pick<Storage, "getItem" | "setItem">, reset = false): string {
  const saved = reset ? null : storage.getItem(CHAT_SESSION_KEY);
  if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved)) return saved;
  const id = crypto.randomUUID();
  storage.setItem(CHAT_SESSION_KEY, id);
  return id;
}

export function isDownloadLink(href: string): boolean {
  try {
    const url = new URL(href);
    const allowed = new URL(DOWNLOAD_URL);
    return url.protocol === allowed.protocol && url.origin === allowed.origin && url.pathname === allowed.pathname && !url.username && !url.password;
  } catch { return false; }
}

export type ChatFile = { id: string; name: string; previewUrl: string; downloadUrl: string };

const FILE_NAME = /[^\s/\\"'`]+\.[A-Za-z0-9]{1,5}/;

function fileUrls(id: string) {
  const base = new URL(DOWNLOAD_URL);
  base.searchParams.set("id", id);
  const previewUrl = base.toString();
  base.searchParams.set("download", "1");
  return { previewUrl, downloadUrl: base.toString() };
}

// Keeps only the two valid actions for a generated file: preview and direct download.
// Every reference to the file service (markdown link, image or bare URL) is taken out
// of the message body and returned as a single entry per file id.
export function extractFileLinks(text: string): { text: string; files: ChatFile[] } {
  const files: ChatFile[] = [];
  const seen = new Set<string>();
  const collect = (href: string, label = ""): boolean => {
    if (!isDownloadLink(href)) return false;
    const id = new URL(href).searchParams.get("id")?.trim();
    if (!id) return false;
    if (!seen.has(id)) {
      seen.add(id);
      files.push({ id, name: label.match(FILE_NAME)?.[0] ?? "Arquivo", ...fileUrls(id) });
    }
    return true;
  };

  let body = text
    .replace(/!\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)[^)]*\)/g, (all, label: string, href: string) => (collect(href, label) ? "" : all))
    .replace(/\[([^\]]*)\]\(\s*(https?:\/\/[^\s)]+)[^)]*\)/g, (all, label: string, href: string) => (collect(href, label) ? "" : all))
    .replace(/https?:\/\/[^\s<>"'`]+/g, (all) => (collect(all) ? "" : all));

  body = body
    .replace(/<\s*>/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: body, files };
}