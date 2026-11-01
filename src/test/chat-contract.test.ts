import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CHAT_MAX_CHARACTERS, CHAT_SESSION_KEY, CHAT_TIMEOUT_MS, CHAT_URL, CHAT_WAIT_NOTICE_MS, DOWNLOAD_URL, extractFileLinks, getChatSession, isDownloadLink, readChatOutput, validateChatInput } from "@/lib/chat-config";
import { requestChat } from "@/lib/chat-request.server";

const sessionId = "12345678-1234-4234-8234-123456789abc";

describe("Chat contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts 8000 characters without truncating", () => {
    expect(CHAT_MAX_CHARACTERS).toBe(8000);
    expect(validateChatInput({ message: "x".repeat(8000), sessionId }).message).toHaveLength(8000);
  });
  it("rejects messages exceeding 8000 before sending", () => {
    expect(() => validateChatInput({ message: "x".repeat(8001), sessionId })).toThrow();
  });
  it("reads only output even when old fields exist", () => {
    expect(readChatOutput({ output: "**Novo**", answer: "Antigo", text: "Antigo" })).toBe("**Novo**");
  });
  it.each([{ answer: "old" }, { text: "old" }, { response: "old" }, { message: "old" }, { json: { output: "old" } }, [{ output: "old" }], "old", { output: 12 }])("rejects legacy or invalid responses %j", (value) => {
    expect(() => readChatOutput(value)).toThrow();
  });
  it("uses 300 seconds for timeout", () => expect(CHAT_TIMEOUT_MS).toBe(300000));
  it("shows the extended wait notice after 15 seconds", () => expect(CHAT_WAIT_NOTICE_MS).toBe(15000));
  it("posts only to the chat endpoint with the required body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ output: "Resposta" })));
    const timeout = vi.spyOn(AbortSignal, "timeout");
    await expect(requestChat({ message: "O que é LOTO?", sessionId })).resolves.toBe("Resposta");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(CHAT_URL, expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sendMessage", sessionId, chatInput: "O que é LOTO?" }) }));
    expect(timeout).toHaveBeenCalledWith(300000);
  });
  it("surfaces network failures instead of using fallback answers", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network error"));
    await expect(requestChat({ message: "LOTO", sessionId })).rejects.toThrow("Network error");
  });
  it("allows file downloads only on the exact configured HTTPS host and path", () => {
    expect(isDownloadLink(`${DOWNLOAD_URL}?id=file_1234`)).toBe(true);
    for (const href of ["https://evil.example/webhook/vigyon-arquivo?id=file_1234", `${DOWNLOAD_URL}.exe`, DOWNLOAD_URL.replace("https:", "http:"), DOWNLOAD_URL.replace(".cloud", ".cloud.evil.example"), "javascript:alert(1)"]) expect(isDownloadLink(href)).toBe(false);
  });
});

describe("Persistent chat session", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  it("creates a UUID once and reuses it across reloads", () => {
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(sessionId);
    expect(getChatSession(localStorage)).toBe(sessionId);
    expect(localStorage.getItem(CHAT_SESSION_KEY)).toBe(sessionId);
    expect(getChatSession(localStorage)).toBe(sessionId);
    expect(uuid).toHaveBeenCalledTimes(1);
  });
  it("replaces the persisted UUID on new conversation", () => {
    localStorage.setItem(CHAT_SESSION_KEY, sessionId);
    const next = "87654321-4321-4321-8321-cba987654321";
    vi.spyOn(crypto, "randomUUID").mockReturnValue(next);
    expect(getChatSession(localStorage, true)).toBe(next);
    expect(localStorage.getItem(CHAT_SESSION_KEY)).toBe(next);
    expect(next).not.toBe(sessionId);
  });
});