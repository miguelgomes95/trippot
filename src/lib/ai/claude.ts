import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment.
export const claude = new Anthropic();

export const MODEL = "claude-opus-5-5";

// If the model declines a request, the API retries it on a fallback model
// inside the same call, chosen by refusal category.
export const FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: "default" } = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};
