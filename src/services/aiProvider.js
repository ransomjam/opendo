// Central Gemini AI provider layer.
//
// The app uses Google Gemini only, including for fallback-sensitive paths.

function flag(value) {
  return String(value || '').toLowerCase() === 'true';
}

function hasGemini() {
  return !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());
}

function isEnabled() {
  return flag(process.env.AI_ENABLED) && hasGemini();
}

function disabledReason() {
  if (!flag(process.env.AI_ENABLED)) {
    return 'AI is disabled. Set AI_ENABLED=true in .env to turn it on.';
  }
  if (!hasGemini()) {
    return 'AI is not configured. Add GEMINI_API_KEY in .env.';
  }
  return null;
}

let cachedGemini;
function getGemini() {
  if (cachedGemini !== undefined) return cachedGemini;
  if (!hasGemini()) {
    cachedGemini = null;
    return cachedGemini;
  }
  try {
    const { GoogleGenAI } = require('@google/genai');
    cachedGemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (error) {
    cachedGemini = null;
  }
  return cachedGemini;
}

function parseJsonLoose(text) {
  if (text === null || text === undefined) return null;
  let t = String(text).trim();
  if (!t) return null;

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  try {
    return JSON.parse(t);
  } catch (_) {
    // fall through to bracket extraction
  }

  const arrStart = t.indexOf('[');
  const objStart = t.indexOf('{');
  let start;
  if (arrStart === -1) start = objStart;
  else if (objStart === -1) start = arrStart;
  else start = Math.min(arrStart, objStart);
  if (start === -1) return null;

  const end = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
  if (end <= start) return null;

  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

function extractGeminiCitations(response) {
  const citations = [];
  try {
    const candidates = response.candidates || [];
    candidates.forEach(candidate => {
      const chunks = (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) || [];
      chunks.forEach(chunk => {
        const web = chunk.web || chunk.retrievedContext;
        if (web && web.uri && !citations.some(c => c.url === web.uri)) {
          citations.push({ title: web.title || web.uri, url: web.uri });
        }
      });
    });
  } catch (_) {
    // best effort
  }
  return citations;
}

async function geminiGenerate({ prompt, useSearch, jsonMode }) {
  const ai = getGemini();
  if (!ai) return null;

  const model = useSearch
    ? (process.env.GEMINI_RESEARCH_MODEL || 'gemini-2.5-flash')
    : (process.env.GEMINI_WRITING_MODEL || process.env.GEMINI_RESEARCH_MODEL || 'gemini-2.5-flash');

  const config = { temperature: 0.2 };
  if (useSearch) {
    config.tools = [{ googleSearch: {} }];
  } else if (jsonMode) {
    config.responseMimeType = 'application/json';
  }

  const response = await ai.models.generateContent({ model, contents: prompt, config });
  const text = typeof response.text === 'string'
    ? response.text
    : (response.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');

  return { text, citations: extractGeminiCitations(response) };
}

async function research(prompt) {
  if (!isEnabled()) return { error: disabledReason() };

  try {
    const result = await geminiGenerate({ prompt, useSearch: true });
    if (result && result.text) return { provider: 'gemini', ...result };
  } catch (_) {
    // return a clear error below
  }
  return { error: 'Gemini research failed or returned no content.' };
}

async function write(prompt, { expectJson = true } = {}) {
  if (!isEnabled()) return null;

  try {
    const result = await geminiGenerate({ prompt, jsonMode: expectJson });
    if (result && result.text) {
      return expectJson ? parseJsonLoose(result.text) : result.text;
    }
  } catch (_) {
    // null tells callers to keep their non-AI fallback behavior.
  }
  return null;
}

module.exports = {
  isEnabled,
  disabledReason,
  hasGemini,
  research,
  write,
  parseJsonLoose
};
