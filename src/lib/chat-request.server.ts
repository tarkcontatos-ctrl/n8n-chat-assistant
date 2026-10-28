import { CHAT_URL, CHAT_TIMEOUT_MS, readChatOutput, type validateChatInput } from "./chat-config";

export async function requestChat(data: ReturnType<typeof validateChatInput>): Promise<string> {
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sendMessage", sessionId: data.sessionId, chatInput: data.message }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`n8n chat failed [${res.status}]: ${body}`);
    throw new Error(`n8n [${res.status}]: ${body}`);
  }
  return readChatOutput(await res.json());
}