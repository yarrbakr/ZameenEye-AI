// SINGLE SWAP POINT for the assistant's brain.
// Today this returns the local, data-grounded stand-in. To connect the ZameenEye
// backend LLM, implement AssistantProvider (POST the query + context to your endpoint,
// map the response to { text, actions }) and return it here — the chat UI is unchanged.

import type { AssistantProvider } from "./types";
import { localProvider } from "./localProvider";

export function getProvider(): AssistantProvider {
  return localProvider;
}

export type { AssistantMessage, MapAction } from "./types";
