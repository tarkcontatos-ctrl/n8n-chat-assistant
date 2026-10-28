import { createServerFn } from "@tanstack/react-start";
import { validateChatInput } from "./chat-config";
import { requestChat } from "./chat-request.server";

export const askVigyon = createServerFn({ method: "POST" })
  .inputValidator(validateChatInput)
  .handler(async ({ data }) => {
    try {
      return { answer: await requestChat(data), error: null };
    } catch (error) {
      console.error("Chat request failed", error);
      return { answer: null, error: "chat_request_failed" };
    }
  });
