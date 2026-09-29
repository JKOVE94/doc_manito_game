import "server-only";
import { env } from "./env";
import { HttpError } from "./http";

const TIMEOUT_MS = 20_000;

/**
 * Gemini generateContent (REST) → JSON 구조화 출력.
 * 실패 시 사용자에게 보여줄 수 있는 HttpError(502/503) 를 throw.
 */
export async function generateJson<T>(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const key = env.geminiApiKey;
  if (!key) throw new HttpError(503, "AI 힌트가 설정되지 않았어요. 호스트에게 문의하세요.");

  const url = `${env.geminiBaseUrl}/v1beta/models/${encodeURIComponent(env.geminiModel)}:generateContent`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          thinkingConfig: { thinkingLevel: "low" },
        },
      }),
    });
  } catch (e) {
    console.error("[gemini] network", e);
    throw new HttpError(502, "AI가 응답하지 않아요. 잠시 후 다시 시도해 주세요.");
  }

  if (!res.ok) {
    console.error("[gemini]", res.status, (await res.text()).slice(0, 500));
    throw new HttpError(502, res.status === 429 ? "AI 요청이 많아요. 잠시 후 다시 시도해 주세요." : "AI 응답에 실패했어요.");
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("[gemini] invalid JSON", text.slice(0, 300));
    throw new HttpError(502, "AI 응답을 이해하지 못했어요. 다시 질문해 주세요.");
  }
}
