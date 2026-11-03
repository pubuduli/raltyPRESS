import express, { type Request, type Response, type NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ============================================================================
// 1. SECURITY MIDDLEWARE, CORS, RATE LIMITING & REQUEST SIZE LIMITS
// ============================================================================

app.use(express.json({ limit: '2mb' }));

// Security headers & CORS restriction
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const origin = req.headers.origin;
  const appUrl = process.env.APP_URL || '';
  if (
    origin &&
    (origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.endsWith('.run.app') ||
      (appUrl && origin === appUrl))
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Editorial-Session');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Per-IP Rate Limiter (protects backend & expensive AI endpoints)
interface RateBucket {
  count: number;
  resetAt: number;
}
const ipRateBuckets = new Map<string, RateBucket>();

function rateLimitMiddleware(maxPerMinute: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    const now = Date.now();
    const bucket = ipRateBuckets.get(ip);

    if (!bucket || now > bucket.resetAt) {
      ipRateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }

    if (bucket.count >= maxPerMinute) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Too many requests from this client within 60 seconds. Please wait before retrying.',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    bucket.count += 1;
    next();
  };
}

app.use('/api', rateLimitMiddleware(60));

// Session / Operator token management for private operational protection
const serverSessionToken = crypto.randomBytes(24).toString('hex');

// ============================================================================
// 2. CENTRALIZED AI CONFIGURATION MANAGER & COST PROTECTION
// ============================================================================

export interface AIConfiguration {
  preferredModel: string;
  allowPaidModels: boolean;
  dailyRequestLimit: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
  maxRetries: number;
}

export interface AIUsageLogEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  model: string;
  status: 'success' | 'error' | 'blocked_quota' | 'duplicate_cached';
  durationMs: number;
  promptChars: number;
  outputChars: number;
  errorMessage?: string;
}

const aiConfig: AIConfiguration = {
  preferredModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  allowPaidModels: process.env.ALLOW_PAID_MODELS === 'true', // Disabled by default!
  dailyRequestLimit: parseInt(process.env.DAILY_AI_LIMIT || '50', 10),
  maxOutputTokens: parseInt(process.env.MAX_OUTPUT_TOKENS || '2048', 10),
  requestTimeoutMs: 25_000,
  maxRetries: 1
};

const aiUsageLogs: AIUsageLogEntry[] = [];
let dailyRequestDate = new Date().toISOString().slice(0, 10);
let dailyRequestCount = 0;

function checkAndIncrementDailyQuota(): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyRequestDate) {
    dailyRequestDate = today;
    dailyRequestCount = 0;
  }
  if (dailyRequestCount >= aiConfig.dailyRequestLimit) {
    return { allowed: false, remaining: 0 };
  }
  dailyRequestCount += 1;
  return { allowed: true, remaining: aiConfig.dailyRequestLimit - dailyRequestCount };
}

// Duplicate request prevention: in-flight tracking + 30s response cache
const inFlightRequests = new Set<string>();
const recentResponseCache = new Map<string, { timestamp: number; data: any }>();

function computeRequestHash(endpoint: string, payload: unknown): string {
  return crypto
    .createHash('sha256')
    .update(`${endpoint}:${JSON.stringify(payload)}`)
    .digest('hex');
}

// Initialize Google GenAI client (server-side only; never exposed to client)
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 5) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function recordAiLog(entry: Omit<AIUsageLogEntry, 'id' | 'timestamp'>) {
  aiUsageLogs.unshift({
    id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...entry
  });
  if (aiUsageLogs.length > 100) {
    aiUsageLogs.pop();
  }
}

/**
 * Centralized Gemini Request Executor:
 * - Enforces free-tier model restriction (blocks gemini-4-argon and paid models unless explicitly enabled)
 * - No automatic fallback to paid models
 * - Enforces daily request limit, maxOutputTokens, timeout, and retry limit
 */
async function executeGeminiRequest(params: {
  endpoint: string;
  prompt: string;
  systemInstruction?: string;
  requestedModel?: string;
  useSearchGrounding?: boolean;
}): Promise<{ text: string; modelUsed: string; groundingChunks?: any[] }> {
  const start = Date.now();

  if (!aiClient) {
    recordAiLog({
      endpoint: params.endpoint,
      model: aiConfig.preferredModel,
      status: 'error',
      durationMs: 0,
      promptChars: params.prompt.length,
      outputChars: 0,
      errorMessage: 'GEMINI_API_KEY is not configured on the server.'
    });
    throw Object.assign(
      new Error(
        'GEMINI_API_KEY is not configured on the server. Configure a free-tier eligible Gemini API key in environment variables, or edit content manually.'
      ),
      { status: 503, code: 'MISSING_API_KEY' }
    );
  }

  // Enforce model policy: disable paid models (such as gemini-4-argon) by default
  let selectedModel = aiConfig.preferredModel;
  if (params.requestedModel) {
    const isPaidModel =
      params.requestedModel.includes('argon') ||
      params.requestedModel.includes('pro') ||
      params.requestedModel.includes('ultra');
    if (isPaidModel && !aiConfig.allowPaidModels) {
      throw Object.assign(
        new Error(
          `Model "${params.requestedModel}" is disabled by zero-cost protection policy. Paid models (including gemini-4-argon) are disabled by default. Using "${aiConfig.preferredModel}" requires free-tier mode.`
        ),
        { status: 403, code: 'PAID_MODEL_DISABLED' }
      );
    }
    selectedModel = params.requestedModel;
  }

  // Check daily quota limit
  const quota = checkAndIncrementDailyQuota();
  if (!quota.allowed) {
    recordAiLog({
      endpoint: params.endpoint,
      model: selectedModel,
      status: 'blocked_quota',
      durationMs: 0,
      promptChars: params.prompt.length,
      outputChars: 0,
      errorMessage: `Daily request limit (${aiConfig.dailyRequestLimit}) reached.`
    });
    throw Object.assign(
      new Error(
        `Daily AI request limit (${aiConfig.dailyRequestLimit} requests/day) reached under zero-cost protection settings. Adjust the limit in Settings or continue with manual editorial entry.`
      ),
      { status: 429, code: 'DAILY_LIMIT_REACHED' }
    );
  }

  const config: any = {
    maxOutputTokens: aiConfig.maxOutputTokens
  };
  if (params.systemInstruction) {
    config.systemInstruction = params.systemInstruction;
  }
  if (params.useSearchGrounding) {
    config.tools = [{ googleSearch: {} }];
  }

  let attempts = 0;
  let lastError: any = null;

  while (attempts <= aiConfig.maxRetries) {
    attempts += 1;
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(Object.assign(new Error('Gemini API request timed out after 25 seconds.'), { status: 504 })),
          aiConfig.requestTimeoutMs
        )
      );

      const apiPromise = aiClient.models.generateContent({
        model: selectedModel,
        contents: params.prompt,
        config
      });

      const response: any = await Promise.race([apiPromise, timeoutPromise]);
      const text = response?.text || '';

      if (!text.trim()) {
        throw new Error('Gemini API returned an empty response payload.');
      }

      const groundingChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;

      recordAiLog({
        endpoint: params.endpoint,
        model: selectedModel,
        status: 'success',
        durationMs: Date.now() - start,
        promptChars: params.prompt.length,
        outputChars: text.length
      });

      return { text, modelUsed: selectedModel, groundingChunks };
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || 'Unknown Gemini error');
      const isQuotaOrAuth =
        err?.status === 429 ||
        err?.status === 403 ||
        err?.status === 401 ||
        errMsg.includes('429') ||
        errMsg.includes('quota') ||
        errMsg.includes('RESOURCE_EXHAUSTED');

      // Never retry quota exhaustion or auth errors
      if (isQuotaOrAuth || attempts > aiConfig.maxRetries) {
        break;
      }
    }
  }

  const finalMessage = lastError?.message || 'Gemini API request failed.';
  recordAiLog({
    endpoint: params.endpoint,
    model: selectedModel,
    status: 'error',
    durationMs: Date.now() - start,
    promptChars: params.prompt.length,
    outputChars: 0,
    errorMessage: finalMessage
  });

  throw Object.assign(new Error(finalMessage), {
    status: lastError?.status || 502,
    code: 'AI_REQUEST_FAILED'
  });
}

/**
 * Helper to parse and validate JSON returned by Gemini
 */
function parseAndValidateAiJson<T>(
  rawText: string,
  requiredFields: string[],
  contextName: string
): T {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    throw Object.assign(
      new Error(`${contextName}: AI returned malformed JSON (${err.message}). Please retry or edit manually.`),
      { status: 502, code: 'INVALID_AI_JSON' }
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw Object.assign(new Error(`${contextName}: AI output is not a JSON object.`), {
      status: 502,
      code: 'INVALID_AI_SCHEMA'
    });
  }

  const missing = requiredFields.filter(f => parsed[f] === undefined || parsed[f] === null);
  if (missing.length > 0) {
    throw Object.assign(
      new Error(`${contextName}: AI response failed schema validation (missing required fields: ${missing.join(', ')}).`),
      { status: 502, code: 'SCHEMA_VALIDATION_FAILED' }
    );
  }

  return parsed as T;
}

// ============================================================================
// 3. STATUS, AI CONFIG & USAGE LOG ENDPOINTS
// ============================================================================

app.get('/api/status', (_req: Request, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyRequestDate) {
    dailyRequestDate = today;
    dailyRequestCount = 0;
  }

  res.json({
    status: aiClient ? 'online' : 'unconfigured',
    hasApiKey: !!aiClient,
    defaultModel: aiConfig.preferredModel,
    allowPaidModels: aiConfig.allowPaidModels,
    operatingMode: aiClient
      ? `Free-Tier Protected (${aiConfig.preferredModel})`
      : 'API Key Not Configured (Manual Mode)',
    billingNotice:
      'Consumer Google AI Pro subscriptions do NOT provide Gemini API credits. API usage is governed by your Google AI Studio / Cloud project tier.',
    dailyRequestLimit: aiConfig.dailyRequestLimit,
    dailyRequestsUsed: dailyRequestCount,
    dailyRequestsRemaining: Math.max(0, aiConfig.dailyRequestLimit - dailyRequestCount),
    maxOutputTokens: aiConfig.maxOutputTokens,
    sessionToken: serverSessionToken,
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toISOString()
  });
});

app.get('/api/ai-config', (_req: Request, res: Response) => {
  res.json({
    config: aiConfig,
    usage: {
      date: dailyRequestDate,
      used: dailyRequestCount,
      remaining: Math.max(0, aiConfig.dailyRequestLimit - dailyRequestCount)
    },
    logs: aiUsageLogs.slice(0, 30)
  });
});

app.post('/api/ai-config', (req: Request, res: Response) => {
  const { dailyRequestLimit, maxOutputTokens, allowPaidModels, preferredModel } = req.body || {};

  if (typeof dailyRequestLimit === 'number' && dailyRequestLimit >= 1 && dailyRequestLimit <= 500) {
    aiConfig.dailyRequestLimit = Math.floor(dailyRequestLimit);
  }
  if (typeof maxOutputTokens === 'number' && maxOutputTokens >= 256 && maxOutputTokens <= 8192) {
    aiConfig.maxOutputTokens = Math.floor(maxOutputTokens);
  }
  if (typeof allowPaidModels === 'boolean') {
    aiConfig.allowPaidModels = allowPaidModels;
  }
  if (typeof preferredModel === 'string' && preferredModel.trim()) {
    const requested = preferredModel.trim();
    if (!aiConfig.allowPaidModels && (requested.includes('argon') || requested.includes('pro'))) {
      return res.status(400).json({
        error: 'Cannot select a paid model while "allowPaidModels" is disabled.'
      });
    }
    aiConfig.preferredModel = requested;
  }

  res.json({
    success: true,
    config: aiConfig
  });
});

// ============================================================================
// 4. CANADIAN NEWS RADAR — GENUINE RSS & SEARCH GROUNDING DISCOVERY
// ============================================================================

interface RssFeedSource {
  id: string;
  name: string;
  url: string;
  reliabilityScore: number;
  defaultCategory: string;
}

const CANADIAN_RSS_FEEDS: RssFeedSource[] = [
  {
    id: 'FEED-CREA-CMHC',
    name: 'Google News Canada: CREA & CMHC Housing',
    url: 'https://news.google.com/rss/search?q=(CREA+OR+CMHC+OR+"Canadian+housing+market"+OR+"Canadian+real+estate")+when:14d&hl=en-CA&gl=CA&ceid=CA:en',
    reliabilityScore: 14,
    defaultCategory: 'Canadian Housing Market'
  },
  {
    id: 'FEED-BOC-MORTGAGE',
    name: 'Google News Canada: Bank of Canada & Mortgage Rates',
    url: 'https://news.google.com/rss/search?q=("Bank+of+Canada"+OR+"Canadian+mortgage+rates"+OR+OSFI+mortgage)+when:14d&hl=en-CA&gl=CA&ceid=CA:en',
    reliabilityScore: 14,
    defaultCategory: 'Mortgage & Finance'
  },
  {
    id: 'FEED-POLICY-ZONING',
    name: 'Google News Canada: Housing Policy & Provincial Legislation',
    url: 'https://news.google.com/rss/search?q=("housing+policy"+Canada+OR+"municipal+zoning"+Canada+OR+RECO+OR+BCFSA)+when:14d&hl=en-CA&gl=CA&ceid=CA:en',
    reliabilityScore: 13,
    defaultCategory: 'Government Housing Policy'
  },
  {
    id: 'FEED-BOC-OFFICIAL',
    name: 'Bank of Canada Official Press Releases',
    url: 'https://www.bankofcanada.ca/content_type/press-releases/feed/',
    reliabilityScore: 15,
    defaultCategory: 'Mortgage & Finance'
  }
];

function decodeXmlEntities(str: string): string {
  return (str || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssXmlItems(xml: string, fallbackPublisher: string, reliabilityScore: number): {
  headline: string;
  url: string;
  publisher: string;
  publicationDate: string | null;
  summary: string;
  reliabilityScore: number;
}[] {
  const items: {
    headline: string;
    url: string;
    publisher: string;
    publicationDate: string | null;
    summary: string;
    reliabilityScore: number;
  }[] = [];

  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const rawTitle = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const rawLink =
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ||
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ||
      '';
    const rawPubDate =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ||
      block.match(/<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)?.[1] ||
      '';
    const rawSource = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || '';
    const rawDesc = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || '';

    let headline = decodeXmlEntities(rawTitle);
    let publisher = decodeXmlEntities(rawSource) || fallbackPublisher;

    // Google News titles often end with " - Publisher Name"
    if (headline.includes(' - ') && !rawSource) {
      const parts = headline.split(' - ');
      if (parts.length >= 2) {
        publisher = parts.pop()!.trim();
        headline = parts.join(' - ').trim();
      }
    }

    const url = decodeXmlEntities(rawLink);
    const summary = decodeXmlEntities(rawDesc);

    let publicationDate: string | null = null;
    if (rawPubDate) {
      const parsedDate = new Date(decodeXmlEntities(rawPubDate));
      if (!isNaN(parsedDate.getTime())) {
        publicationDate = parsedDate.toISOString().slice(0, 10);
      }
    }

    if (headline && url && url.startsWith('http')) {
      items.push({
        headline,
        url,
        publisher,
        publicationDate,
        summary: summary && summary !== headline ? summary.slice(0, 350) : headline,
        reliabilityScore
      });
    }
  }

  return items;
}

app.post('/api/discover-news', async (req: Request, res: Response) => {
  try {
    const {
      query = '',
      province = 'All',
      category = 'All',
      useSearchGrounding = false,
      customRssUrls = []
    } = req.body || {};

    const discovered: any[] = [];
    const errors: string[] = [];

    // 1. Build RSS Feed list (including dynamic query feed if user specified query/province/topic)
    const feedsToFetch: RssFeedSource[] = [...CANADIAN_RSS_FEEDS];

    if (query || (province && province !== 'All') || (category && category !== 'All')) {
      const terms = [
        'Canada real estate',
        query ? String(query).trim() : '',
        province && province !== 'All' && !province.includes('National') ? province.split('(')[0].trim() : '',
        category && category !== 'All' ? category : ''
      ]
        .filter(Boolean)
        .join(' ');

      feedsToFetch.unshift({
        id: 'FEED-DYNAMIC-QUERY',
        name: `Canadian Real Estate Search: ${terms}`,
        url: `https://news.google.com/rss/search?q=${encodeURIComponent(terms + ' when:14d')}&hl=en-CA&gl=CA&ceid=CA:en`,
        reliabilityScore: 13,
        defaultCategory: category !== 'All' ? category : 'Canadian Housing Market'
      });
    }

    if (Array.isArray(customRssUrls)) {
      for (const custom of customRssUrls.slice(0, 5)) {
        if (custom && typeof custom.rssUrl === 'string' && custom.rssUrl.startsWith('http')) {
          feedsToFetch.push({
            id: custom.id || 'CUSTOM',
            name: custom.name || 'Custom RSS Source',
            url: custom.rssUrl,
            reliabilityScore: Number(custom.reliabilityScore) || 13,
            defaultCategory: custom.category || 'Canadian Housing Market'
          });
        }
      }
    }

    // Fetch RSS feeds concurrently with 8s timeout per feed
    const feedPromises = feedsToFetch.slice(0, 6).map(async feed => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const resp = await fetch(feed.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; realtyPRESS-NewsRadar/2.0; +https://realtypress.ca)'
          }
        });
        clearTimeout(timer);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const xml = await resp.text();
        return parseRssXmlItems(xml, feed.name, feed.reliabilityScore).slice(0, 10);
      } catch (err: any) {
        errors.push(`${feed.name}: ${err.message || 'Feed unreachable'}`);
        return [];
      }
    });

    const rssResults = await Promise.all(feedPromises);
    for (const batch of rssResults) {
      for (const item of batch) {
        discovered.push({
          ...item,
          discoveryMethod: 'RSS Feed'
        });
      }
    }

    // 2. Optional Google Search Grounding via Gemini if explicitly requested
    if (useSearchGrounding) {
      if (!aiClient) {
        errors.push('Google Search Grounding skipped: GEMINI_API_KEY is not configured.');
      } else {
        try {
          const searchPrompt = `Find current, factual Canadian real estate news articles published in the last 14 days about: ${
            query || category !== 'All' ? `${query} ${category}` : 'Canadian housing market, CREA, CMHC, Bank of Canada mortgage rates, provincial real estate regulations'
          } ${province !== 'All' ? `in ${province}` : 'across Canada'}.
Do NOT invent any article URLs, dates, statistics, or publisher names. Return a JSON array of objects with fields: headline, summary, url, publisher, publicationDate (YYYY-MM-DD or null), supportingFacts (array of strings).`;

          const grounded = await executeGeminiRequest({
            endpoint: '/api/discover-news (grounding)',
            prompt: searchPrompt,
            useSearchGrounding: true
          });

          // Extract real grounding URLs from groundingChunks if present
          const chunks = grounded.groundingChunks || [];
          for (const chunk of chunks) {
            if (chunk?.web?.uri && chunk?.web?.title) {
              discovered.push({
                headline: String(chunk.web.title).trim(),
                url: String(chunk.web.uri).trim(),
                publisher: new URL(chunk.web.uri).hostname.replace(/^www\./, ''),
                publicationDate: null,
                summary: `Discovered via Google Search Grounding: ${chunk.web.title}`,
                reliabilityScore: 13,
                discoveryMethod: 'Google Search Grounding'
              });
            }
          }
        } catch (gErr: any) {
          errors.push(`Search Grounding error: ${gErr.message}`);
        }
      }
    }

    res.json({
      liveDiscovery: discovered.length > 0,
      discoveredAt: new Date().toISOString(),
      count: discovered.length,
      items: discovered,
      warnings: errors
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message || 'News discovery failed.',
      liveDiscovery: false
    });
  }
});

// ============================================================================
// 5. AI RESEARCH EXTRACTION ENDPOINT (NO FABRICATED FALLBACKS)
// ============================================================================

app.post('/api/research', async (req: Request, res: Response) => {
  const { articleText, sourceName, sourceUrl, category, province, requestedModel } = req.body || {};

  if (!articleText || typeof articleText !== 'string' || articleText.trim().length < 20) {
    return res.status(400).json({
      error: 'Please provide at least 20 characters of source article text or press release excerpt to analyze.'
    });
  }

  const reqHash = computeRequestHash('/api/research', { articleText: articleText.slice(0, 500), sourceUrl });
  if (inFlightRequests.has(reqHash)) {
    return res.status(429).json({
      error: 'An identical research request is already in progress. Please wait for it to complete.'
    });
  }

  const cached = recentResponseCache.get(reqHash);
  if (cached && Date.now() - cached.timestamp < 30_000) {
    return res.json({ ...cached.data, cached: true });
  }

  inFlightRequests.add(reqHash);
  try {
    const systemInstruction = `You are the Senior Research & Fact-Checking Editor for realtyPRESS, a Canadian real estate news publication.
Analyze the supplied source text objectively for Canadian REALTORS®, mortgage brokers, developers, and property investors.
CRITICAL INTEGRITY RULES:
1. Extract ONLY facts and statistics explicitly supported by the supplied text.
2. Do NOT fabricate quotations, dates, URLs, or statistics not present in the text.
3. Identify specific factual claims that require human verification before publication.
4. Return strict JSON matching the requested schema without markdown code fences.`;

    const prompt = `Analyze this Canadian real estate source:
Source Publisher: ${sourceName || 'Unspecified'}
Source URL: ${sourceUrl || 'Not provided'}
Category: ${category || 'Canadian Housing Market'}
Region: ${province || 'National / Canada-Wide'}

Supplied Source Text:
"""
${articleText.slice(0, 10000)}
"""

Return strict JSON with this exact structure:
{
  "summary": "2-3 concise factual sentences summarizing the text.",
  "verifiedFacts": ["Factual statement 1 from text", "Factual statement 2 from text"],
  "claimsToVerify": [
    {
      "claimText": "Specific factual or numerical claim from the text",
      "evidenceExcerpt": "Direct excerpt from the supplied text supporting this claim"
    }
  ],
  "statistics": ["Specific number/stat from the text (or empty array if none)"],
  "industryImplications": ["Actionable implication for Canadian REALTORS/brokers", "Implication for buyers/sellers"],
  "realtorRelevanceNotes": "Why this matters to Canadian real estate professionals.",
  "proposedHeadlines": [
    "UPPERCASE HEADLINE 1",
    "UPPERCASE HEADLINE 2",
    "UPPERCASE HEADLINE 3"
  ],
  "possibleBiasesOrInaccuracies": "Missing context, unverified assertions, or potential biases in the source text.",
  "suggestedScore": {
    "realtorRelevance": 20,
    "newsImportance": 16,
    "timeliness": 17,
    "audienceInterest": 12,
    "sourceReliability": 13,
    "originalAngle": 3
  }
}`;

    const { text, modelUsed } = await executeGeminiRequest({
      endpoint: '/api/research',
      prompt,
      systemInstruction,
      requestedModel
    });

    const parsed = parseAndValidateAiJson<any>(
      text,
      ['summary', 'verifiedFacts', 'industryImplications', 'proposedHeadlines', 'suggestedScore'],
      'AI Research Extraction'
    );

    const responseData = {
      ...parsed,
      modelUsed,
      analyzedAt: new Date().toISOString()
    };

    recentResponseCache.set(reqHash, { timestamp: Date.now(), data: responseData });
    return res.json(responseData);
  } catch (error: any) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({
      error: error.message || 'AI research extraction failed.',
      code: error.code || 'RESEARCH_FAILED',
      preserveInput: true
    });
  } finally {
    inFlightRequests.delete(reqHash);
  }
});

// ============================================================================
// 6. AI CONTENT STUDIO ENDPOINT (STRICT V8 COMPLIANCE, NO FABRICATED FALLBACK)
// ============================================================================

app.post('/api/generate-content', async (req: Request, res: Response) => {
  const {
    action = 'Generate News Caption',
    story,
    targetPlatform = 'Facebook',
    format = 'Facebook Post',
    tone = 'News-media editorial',
    audience = 'Canadian REALTORS®, mortgage brokers, investors',
    customInstructions = '',
    requestedModel
  } = req.body || {};

  if (!story || (!story.originalHeadline && !story.proposedHeadline && !story.articleSummary)) {
    return res.status(400).json({
      error: 'A valid source story with a headline or summary is required for content generation.'
    });
  }

  const reqHash = computeRequestHash('/api/generate-content', {
    action,
    storyId: story.id,
    targetPlatform,
    format,
    tone,
    customInstructions
  });

  if (inFlightRequests.has(reqHash)) {
    return res.status(429).json({
      error: 'An identical content generation request is already running. Please wait.'
    });
  }

  inFlightRequests.add(reqHash);
  try {
    const systemInstruction = `You are the Lead Editorial Director of realtyPRESS (Canadian Real Estate News & Industry Insights).
Write authoritative, factual Canadian English content adhering strictly to realtyPRESS V8 Editorial Standards:

1. FOR FACEBOOK / V8 NEWS CAPTIONS:
   - WORD COUNT: Strictly between 250 and 350 words (excluding hashtags). Count carefully so the 5 narrative paragraphs total 265–325 words.
   - PARAGRAPHS: Exactly five (5) non-empty paragraphs separated by double line breaks (\\n\\n):
     * Paragraph 1: Breaking news / development with clear source attribution.
     * Paragraph 2: Canadian macroeconomic, rate, or policy context.
     * Paragraph 3: Direct practical implications for Canadian REALTORS® and brokers.
     * Paragraph 4: Deeper supply, regulatory, or regional market analysis (clearly distinguishing confirmed facts from analysis).
     * Paragraph 5: Forward-looking takeaway and engagement question for real estate professionals.
   - HASHTAGS: Exactly ten (10) unique, relevant hashtags placed on a final block after the 5th paragraph. #realtyPRESS MUST be the first hashtag.
   - SPELLING & TONE: Professional Canadian English (centre, programme, labour, neighbourhood, favour), analytical, zero clickbait, zero unsupported speculation.

2. ALSO PROVIDE PLATFORM-SPECIFIC ADAPTATIONS:
   - linkedInVersion: Executive brief with bullet points, professional insights, source attribution, and 5 hashtags.
   - instagramVersion: Punchy visual-first caption with clear line breaks and hashtags.
   - shortSummaryVersion: Concise 2-3 sentence executive news brief.
   - infographicCopy: Slide-by-slide headline and data callout points for a 4:5 carousel.

Return strict JSON without markdown formatting.`;

    const prompt = `Action: ${action}
Primary Platform: ${targetPlatform}
Format: ${format}
Tone: ${tone}
Target Audience: ${audience}
${customInstructions ? `Additional Editor Instructions: ${customInstructions}` : ''}

Source Story Data:
Headline: ${story.proposedHeadline || story.originalHeadline}
Source Publication: ${story.sourcePublicationName || 'Unspecified Source'} (${story.publicationDate || 'N/A'})
Source URL: ${story.sourceUrl || ''}
Category: ${story.category || 'Canadian Housing Market'}
Region: ${story.province || 'National / Canada-Wide'}
Summary: ${story.articleSummary || ''}
Confirmed Facts: ${(story.verifiedFacts || []).join('; ')}
Statistics: ${(story.statistics || []).join('; ')}
REALTOR Implications: ${(story.industryImplications || []).join('; ')}

Return strict JSON with this exact schema:
{
  "headline": "UPPERCASE HEADLINE PRESERVING ACCURATE FACTS",
  "caption": "Paragraph 1 (approx 55 words)...\\n\\nParagraph 2 (approx 55 words)...\\n\\nParagraph 3 (approx 55 words)...\\n\\nParagraph 4 (approx 55 words)...\\n\\nParagraph 5 (approx 55 words)...\\n\\n#realtyPRESS #Tag2 #Tag3 #Tag4 #Tag5 #Tag6 #Tag7 #Tag8 #Tag9 #Tag10",
  "linkedInVersion": "Tailored LinkedIn post...",
  "instagramVersion": "Tailored Instagram caption...",
  "shortSummaryVersion": "Short-form 2-3 sentence news summary...",
  "infographicCopy": "Slide 1: ...\\nSlide 2: ...\\nSlide 3: ...",
  "callToAction": "Engaging closing question for Canadian real estate professionals",
  "hashtags": ["#realtyPRESS", "#CanadianRealEstate", "#CREA", "#HousingMarket", "#RealEstateNews", "#MortgageRates", "#TorontoRealEstate", "#VancouverRealEstate", "#RealtorLife", "#HousingSupply"],
  "sourceAttribution": "${story.sourcePublicationName || 'Official Source'}"
}`;

    const { text, modelUsed } = await executeGeminiRequest({
      endpoint: '/api/generate-content',
      prompt,
      systemInstruction,
      requestedModel
    });

    const parsed = parseAndValidateAiJson<any>(
      text,
      ['headline', 'caption', 'hashtags', 'sourceAttribution'],
      'AI Content Generation'
    );

    return res.json({
      ...parsed,
      modelUsed,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({
      error: error.message || 'AI content generation failed.',
      code: error.code || 'CONTENT_GENERATION_FAILED',
      preserveInput: true
    });
  } finally {
    inFlightRequests.delete(reqHash);
  }
});

// ============================================================================
// 7. REEL STUDIO SCRIPT GENERATION ENDPOINT (NO FABRICATED FALLBACK)
// ============================================================================

app.post('/api/generate-reel', async (req: Request, res: Response) => {
  const { story, style = 'Professional Breaking-News', targetDuration = 30, requestedModel } = req.body || {};

  if (!story || (!story.proposedHeadline && !story.originalHeadline)) {
    return res.status(400).json({
      error: 'Please select a valid source story before generating a Reel script.'
    });
  }

  try {
    const systemInstruction = `You are the Short-Form Video Producer for realtyPRESS.
Create an accurate, high-retention ${targetDuration}-second vertical video script for Canadian REALTORS® and housing professionals.
Only use facts present in the supplied story. Clearly distinguish spoken narration, on-screen text, transitions, and production instructions.
Return strict JSON without markdown fences.`;

    const prompt = `Story Headline: ${story.proposedHeadline || story.originalHeadline}
Source: ${story.sourcePublicationName || 'Official Source'}
Summary: ${story.articleSummary || ''}
Confirmed Facts: ${(story.verifiedFacts || []).join('; ')}
Statistics: ${(story.statistics || []).join('; ')}
Presentation Style: ${style}
Target Duration: ${targetDuration} seconds

Return strict JSON matching this exact structure:
{
  "title": "Short Reel Title",
  "openingHook": "0:00-0:03 scroll-stopping opening hook",
  "narration": "Complete voice-over script",
  "closingQuestion": "Closing engagement question for comments",
  "audioMood": "Background music & pacing notes",
  "scenes": [
    {
      "sceneNumber": 1,
      "durationSeconds": 6,
      "visualInstructions": "Camera and visual direction",
      "onScreenText": "UPPERCASE ON-SCREEN GRAPHIC TEXT",
      "subtitleText": "Spoken voice-over segment",
      "transitionNote": "Cut / transition instruction",
      "promptNanoBanana": "9:16 reference image prompt",
      "promptVeoSora": "9:16 b-roll motion video prompt"
    }
  ],
  "caption": "Accompanying social media caption",
  "hashtags": ["#realtyPRESS", "#CanadianRealEstate", "#RealtyExplained", "#CREA", "#HousingMarket"]
}`;

    const { text, modelUsed } = await executeGeminiRequest({
      endpoint: '/api/generate-reel',
      prompt,
      systemInstruction,
      requestedModel
    });

    const parsed = parseAndValidateAiJson<any>(
      text,
      ['title', 'openingHook', 'narration', 'scenes', 'caption'],
      'Reel Script Generation'
    );

    return res.json({
      ...parsed,
      modelUsed,
      productionStatus: 'AI-Generated Script'
    });
  } catch (error: any) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({
      error: error.message || 'Reel script generation failed.',
      code: error.code || 'REEL_GENERATION_FAILED'
    });
  }
});

// ============================================================================
// 8. VISUAL STUDIO PROMPT GENERATOR ENDPOINT (NO FABRICATED FALLBACK)
// ============================================================================

app.post('/api/generate-visual-prompt', async (req: Request, res: Response) => {
  const { story, aspectRatio = '4:5', headline, templateStyle = 'Breaking News', requestedModel } = req.body || {};

  if (!headline && !story?.proposedHeadline && !story?.originalHeadline) {
    return res.status(400).json({
      error: 'A headline or selected story is required to generate visual art direction.'
    });
  }

  try {
    const systemInstruction = `You are the Art Director for realtyPRESS.
Apply the official realtyPRESS V8 Visual Identity:
- Palette: Primary Red (#F20000), Dark Charcoal (#242626), Crisp White (#FFFFFF).
- Full-bleed ultra-realistic Canadian architectural/editorial photography.
- Dark charcoal/black gradient at the bottom 35-40% for text legibility.
- Uppercase Poppins Black headline with 1-2 key terms highlighted in #F20000.
- No watermarks, no clutter.
Return strict JSON without markdown fences.`;

    const prompt = `Headline: ${headline || story?.proposedHeadline || story?.originalHeadline}
Template Style: ${templateStyle}
Aspect Ratio: ${aspectRatio}
Category: ${story?.category || 'Canadian Housing Market'}
Region: ${story?.province || 'National / Canada-Wide'}
Summary: ${story?.articleSummary || ''}

Return strict JSON:
{
  "headline": "UPPERCASE HEADLINE",
  "highlightWords": ["WORD1", "WORD2"],
  "prompt": "Detailed editorial photography prompt for ${aspectRatio} aspect ratio...",
  "compositionGuide": "Art direction notes on lighting, subject framing, and gradient placement."
}`;

    const { text, modelUsed } = await executeGeminiRequest({
      endpoint: '/api/generate-visual-prompt',
      prompt,
      systemInstruction,
      requestedModel
    });

    const parsed = parseAndValidateAiJson<any>(
      text,
      ['headline', 'highlightWords', 'prompt', 'compositionGuide'],
      'Visual Studio Prompt Generation'
    );

    return res.json({
      ...parsed,
      modelUsed
    });
  } catch (error: any) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({
      error: error.message || 'Visual prompt generation failed.',
      code: error.code || 'VISUAL_PROMPT_FAILED'
    });
  }
});

// ============================================================================
// 9. VITE DEV MIDDLEWARE OR PRODUCTION STATIC ASSETS
// ============================================================================

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`realtyPRESS AI Media Studio server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
