const apiBase = "https://generativelanguage.googleapis.com/v1beta/models";

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  return key;
}

async function request(model: string, action: string, body: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/${model}:${action}`, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey() }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}): ${payload.error?.message || "Unknown error"}`);
  return payload;
}

async function availableModels(method: "generateContent" | "embedContent", preferred: string[]) {
  const response = await fetch(`${apiBase}?key=${encodeURIComponent(apiKey())}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini model discovery failed (${response.status}): ${payload.error?.message || "Unknown error"}`);
  const models = (payload.models || []) as Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  const usable = models.filter((model) => model.name && model.supportedGenerationMethods?.includes(method)).map((model) => model.name!.replace(/^models\//, ""));
  if (!usable.length) throw new Error(`This Gemini API key has no model available for ${method}.`);
  return [...preferred.filter((name) => usable.includes(name)), ...usable.filter((name) => !preferred.includes(name))];
}

async function requestAvailableModel(method: "generateContent" | "embedContent", preferred: string[], body: Record<string, unknown>) {
  const models = await availableModels(method, preferred);
  let lastError: unknown;
  for (const model of models) {
    try { return await request(model, method, body); }
    catch (error) {
      lastError = error;
      // Google may list retired models while rejecting them for new API projects.
      if (!(error instanceof Error) || !error.message.includes("(404)")) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No available Gemini model could process this request.");
}

export async function embedding(text: string) {
  const body = { content: { parts: [{ text: text.slice(0, 30000) }] }, output_dimensionality: 1536 };
  const payload = process.env.GEMINI_EMBEDDING_MODEL ? await request(process.env.GEMINI_EMBEDDING_MODEL, "embedContent", body) : await requestAvailableModel("embedContent", ["gemini-embedding-2", "gemini-embedding-001"], body);
  const vector = payload.embedding?.values;
  if (!Array.isArray(vector) || vector.length !== 1536) throw new Error("Gemini did not return a 1536-dimensional embedding.");
  return vector;
}

export async function generateText(prompt: string, systemInstruction?: string, maxOutputTokens = 1024, json = true) {
  const body = { ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}), contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { ...(json ? { responseMimeType: "application/json" } : {}), maxOutputTokens } };
  const payload = process.env.GEMINI_TEXT_MODEL ? await request(process.env.GEMINI_TEXT_MODEL, "generateContent", body) : await requestAvailableModel("generateContent", ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"], body);
  const text = payload.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
  if (!text) throw new Error("Gemini returned no generated text.");
  return text;
}

export async function generateJson<T>(prompt: string, systemInstruction: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const retry = attempt ? " Your previous response was invalid. Return only one complete, compact JSON object with no Markdown, commentary, or code fences." : "";
    const text = await generateText(prompt, `${systemInstruction}${retry}`, 2048, true);
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try { return JSON.parse(cleaned) as T; } catch (error) { lastError = error; }
  }
  throw new Error(`Gemini returned invalid structured data: ${lastError instanceof Error ? lastError.message : "unknown JSON error"}`);
}
