import { createServerFn } from "@tanstack/react-start";

// Production n8n Chat Trigger webhook that answers the Vigyon chat.
const N8N_CHAT_URL =
  "https://n8n.srv2083175.hstgr.cloud/webhook/9afdce04-6b40-4816-8644-9bfd011013bc/chat";

function extractAnswer(data: unknown): string {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return extractAnswer(data[0]);
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    for (const k of ["output", "answer", "text", "response", "message"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
    if (o.json) return extractAnswer(o.json);
  }
  return "";
}

export const askVigyon = createServerFn({ method: "POST" })
  .inputValidator((d: { message: string; sessionId: string }) => {
    const message = String(d?.message ?? "").trim().slice(0, 1500);
    const sessionId = String(d?.sessionId ?? "").slice(0, 100);
    if (!message) throw new Error("Mensagem vazia");
    return { message, sessionId };
  })
  .handler(async ({ data }) => {
    const res = await fetch(N8N_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sendMessage",
        sessionId: data.sessionId,
        chatInput: data.message,
      }),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error(`n8n chat failed [${res.status}]: ${raw}`);
      throw new Error(`n8n [${res.status}]`);
    }
    let answer = "";
    try {
      answer = extractAnswer(JSON.parse(raw));
    } catch {
      answer = raw;
    }
    return { answer: answer || "Não recebi conteúdo na resposta." };
  });
