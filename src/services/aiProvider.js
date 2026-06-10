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

function geminiErrorMessage(error, kind) {
  const raw = String(error && (error.message || error.statusText || error) || '').trim();
  const lower = raw.toLowerCase();

  if (lower.includes('api key') || lower.includes('apikey') || lower.includes('permission') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return `Gemini ${kind} failed. Check GEMINI_API_KEY in Render Environment and redeploy.`;
  }
  if (lower.includes('quota') || lower.includes('rate') || lower.includes('429')) {
    return `Gemini ${kind} failed because the API quota or rate limit was reached.`;
  }
  if (lower.includes('model') || lower.includes('not found') || lower.includes('404')) {
    return `Gemini ${kind} failed. Check GEMINI_RESEARCH_MODEL and GEMINI_WRITING_MODEL in Render Environment.`;
  }
  if (raw) {
    return `Gemini ${kind} failed: ${raw.slice(0, 240)}`;
  }
  return `Gemini ${kind} failed. Check the Render logs for the Gemini error.`;
}

async function geminiGenerate({ prompt, useSearch, jsonMode, maxOutputTokens }) {
  const ai = getGemini();
  if (!ai) return null;

  const model = useSearch
    ? (process.env.GEMINI_RESEARCH_MODEL || 'gemini-2.5-flash')
    : (process.env.GEMINI_WRITING_MODEL || process.env.GEMINI_RESEARCH_MODEL || 'gemini-2.5-flash');

  const config = { temperature: 0.2 };
  if (Number.isFinite(maxOutputTokens) && maxOutputTokens > 0) {
    config.maxOutputTokens = maxOutputTokens;
  }
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

async function research(prompt, options = {}) {
  if (!isEnabled()) return { error: disabledReason() };

  try {
    const result = await geminiGenerate({ prompt, useSearch: true, maxOutputTokens: options.maxOutputTokens });
    if (result && result.text) return { provider: 'gemini', ...result };
  } catch (error) {
    console.error('[aiProvider] Gemini research failed:', error && (error.stack || error.message || error));
    return { error: geminiErrorMessage(error, 'research') };
  }
  return { error: 'Gemini research returned no content. Check the Render logs and Gemini model settings.' };
}

async function write(prompt, { expectJson = true, maxOutputTokens } = {}) {
  if (!isEnabled()) return null;

  try {
    const result = await geminiGenerate({ prompt, jsonMode: expectJson, maxOutputTokens });
    if (result && result.text) {
      return expectJson ? parseJsonLoose(result.text) : result.text;
    }
  } catch (error) {
    console.error('[aiProvider] Gemini writing failed:', error && (error.stack || error.message || error));
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
