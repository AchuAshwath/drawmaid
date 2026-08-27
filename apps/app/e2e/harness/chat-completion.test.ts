import { describe, expect, it } from "vitest";
import { decodeChatCompletion } from "./chat-completion";

describe("chat completion decoding", () => {
  it("returns model content", () => {
    expect(
      decodeChatCompletion(
        200,
        true,
        JSON.stringify({
          choices: [{ message: { content: "TYPE flowchart" } }],
        }),
      ),
    ).toEqual({ text: "TYPE flowchart" });
  });

  it("marks missing or blank content as a provider failure", () => {
    expect(
      decodeChatCompletion(
        200,
        true,
        JSON.stringify({ choices: [{ finish_reason: "stop", message: {} }] }),
      ),
    ).toEqual({
      text: "",
      error: "empty completion (finish_reason: stop)",
    });
    expect(decodeChatCompletion(200, true, "{}").error).toBe(
      "empty completion",
    );
  });

  it("reports HTTP, provider, and malformed-body failures", () => {
    expect(
      decodeChatCompletion(
        429,
        false,
        JSON.stringify({ error: { message: "quota exhausted" } }),
      ).error,
    ).toBe("HTTP 429: quota exhausted");
    expect(
      decodeChatCompletion(
        200,
        true,
        JSON.stringify({ error: { message: "upstream unavailable" } }),
      ).error,
    ).toBe("provider error: upstream unavailable");
    expect(decodeChatCompletion(502, false, "bad gateway").error).toBe(
      "HTTP 502: bad gateway",
    );
  });
});
