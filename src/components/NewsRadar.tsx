import React, { useState, useEffect, useCallback } from 'react';
import {
  Radar,
  Search,
  Globe,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Plus,
  Filter,
  Loader2,
  ShieldCheck,
  MapPin,
  Rss,
  RefreshCw,
  Clock,
  FileCheck2,
  CopyCheck
} from 'lucide-react';
import { db, getOperationalStories } from '../db';
import {
  Story,
  EditorialCategory,
  EDITORIAL_CATEGORIES,
  CanadianRegion,
  CANADIAN_REGIONS,
  DiscoveredNewsItem,
  ClaimEvidence,
  NewsSource
} from '../types';
import { calculateEditorialScore } from '../utils/scoring';
import {
  normalizeArticleUrl,
  findDuplicateStory,
  validatePublicationDate,
  classifyCanadianRealEstateArticle
} from '../utils/newsQuality';

interface NewsRadarProps {
  onSelectStoryForStudio: (story: Story) => void;
  demoMode?: boolean;
}

const RESEARCH_STATUS_FILTERS = [
  'All',
  'Discovered',
  'Research Pending',
  'Research Completed',
  'Awaiting Verification',
  'Verified',
  'Rejected',
  'Archived'
] as const;

export const NewsRadar: React.FC<NewsRadarProps> = ({
  onSelectStoryForStudio,
  demoMode = false
}) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [discoveredFeed, setDiscoveredFeed] = useState<DiscoveredNewsItem[]>([]);
  const [hasLiveFeedFetched, setHasLiveFeedFetched] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const [feedWarnings, setFeedWarnings] = useState<string[]>([]);
  const [isDiscoveringFeed, setIsDiscoveringFeed] = useState(false);
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [discoveryQuery, setDiscoveryQuery] = useState(
    'Canada housing market mortgage rates CREA CMHC'
  );

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedResearchStatus, setSelectedResearchStatus] = useState<string>('All');
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>('All');
  const [minRelevanceFilter, setMinRelevanceFilter] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'discover' | 'manual'>('pipeline');

  // Research & Discovery state
  const [articleUrl, setArticleUrl] = useState('');
  const [articleHeadline, setArticleHeadline] = useState('');
  const [articleRawText, setArticleRawText] = useState('');
  const [sourceNameInput, setSourceNameInput] = useState('');
  const [publishedAtInput, setPublishedAtInput] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [isResearching, setIsResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const loadStories = useCallback(async () => {
    const [allStories, allSources] = await Promise.all([
      getOperationalStories(demoMode),
      db.sources.toArray()
    ]);
    setStories(allStories);
    setSources(allSources);
  }, [demoMode]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const handleDiscoverCanadianNews = async () => {
    setIsDiscoveringFeed(true);
    setErrorMsg(null);
    try {
      const enabledCustomSources = sources.filter(s => s.enabled && s.rssUrl);
      const response = await fetch('/api/discover-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: discoveryQuery,
          province: selectedRegion,
          category: selectedCategory,
          useSearchGrounding,
          customRssUrls: enabledCustomSources
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to discover Canadian real estate news.');
      }

      const existingStories = await db.stories.toArray();
      const enriched: DiscoveredNewsItem[] = (data.items || []).map(
        (item: any, index: number) => {
          const classification = classifyCanadianRealEstateArticle(
            item.headline || '',
            item.summary || ''
          );
          const dateCheck = validatePublicationDate(item.publicationDate || undefined);
          const duplicate = findDuplicateStory(
            item.headline || '',
            item.url || '',
            existingStories
          );

          return {
            id: `disc-${Date.now()}-${index}`,
            headline: item.headline || 'Untitled Canadian Real Estate Article',
            summary: item.summary || item.headline || '',
            url: item.url || '',
            normalizedUrl: normalizeArticleUrl(item.url || ''),
            publisher: item.publisher || 'Canadian News Source',
            publicationDate: dateCheck.normalizedDate,
            isOutdated: dateCheck.isOutdated,
            province: classification.province,
            category: classification.category,
            whyItMatters: classification.whyItMatters,
            supportingFacts: item.supportingFacts || [],
            researchStatus: 'Discovered',
            relevanceScore: classification.realtorRelevanceScore,
            reliabilityScore: Number(item.reliabilityScore) || 13,
            discoveryTimestamp: new Date().toISOString(),
            discoveryMethod: item.discoveryMethod || 'RSS Feed',
            duplicateOfStoryId: duplicate?.id
          };
        }
      );

      setDiscoveredFeed(enriched);
      setFeedWarnings(data.warnings || []);
      setHasLiveFeedFetched(Boolean(data.liveDiscovery && enriched.length > 0));
      setLastFetchedAt(data.discoveredAt || new Date().toISOString());

      await db.discoveredNews.clear();
      if (enriched.length > 0) {
        await db.discoveredNews.bulkPut(enriched);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to fetch Canadian real estate news feeds.');
    } finally {
      setIsDiscoveringFeed(false);
    }
  };

  const handleIngestDiscoveredItem = async (item: DiscoveredNewsItem) => {
    const existingStories = await db.stories.toArray();
    const dup = findDuplicateStory(item.headline, item.url, existingStories);
    if (dup) {
      setErrorMsg(
        `Duplicate prevented: "${item.headline}" already exists in Story Pipeline as "${dup.proposedHeadline}".`
      );
      return;
    }

    const breakdown = {
      realtorRelevance: item.relevanceScore || 20,
      newsImportance: 16,
      timeliness: item.isOutdated ? 8 : 18,
      audienceInterest: 12,
      sourceReliability: item.reliabilityScore || 13,
      originalAngle: 3
    };
    const scoreRes = calculateEditorialScore(breakdown);
    const now = new Date().toISOString();

    const newStory: Story = {
      id: `story-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      originalHeadline: item.headline,
      proposedHeadline: item.headline.toUpperCase(),
      sourceUrl: item.url,
      sourcePublicationName: item.publisher,
      publicationDate: item.publicationDate || now.slice(0, 10),
      dateDiscovered: now.slice(0, 10),
      category: item.category,
      province: item.province,
      articleSummary:
        item.summary ||
        'Discovered via Canadian Real Estate RSS / Search Feed. Pending full editorial verification.',
      verifiedFacts: item.supportingFacts || [],
      statistics: [],
      industryImplications: [item.whyItMatters],
      realtorRelevanceNotes: item.whyItMatters,
      claimsEvidence: [],
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: now,
          actor: 'News Radar Ingestion',
          action: 'Story Discovered & Added to Pipeline',
          previousState: 'None',
          newState: 'Unverified',
          notes: `Source: ${item.publisher} (${item.url})`
        }
      ],
      editorialScore: scoreRes.total,
      scoreBreakdown: breakdown,
      verificationStatus: 'Unverified',
      editorialStatus: 'Research Pending',
      assignedFormats: ['Facebook Post'],
      internalNotes: `Discovered via ${item.discoveryMethod}. Requires claim evidence before marking Verified.`,
      isSampleData: false,
      createdAt: now,
      updatedAt: now
    };

    await db.stories.put(newStory);
    await loadStories();
    setStatusBanner(
      `Added "${item.headline}" to Story Pipeline as Unverified (Research Pending).`
    );
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleLoadFeedItemIntoResearch = (item: DiscoveredNewsItem) => {
    setArticleHeadline(item.headline);
    setArticleUrl(item.url);
    setSourceNameInput(item.publisher);
    setArticleRawText(item.summary || item.headline);
    if (item.publicationDate) {
      setPublishedAtInput(item.publicationDate);
    }
    setActiveTab('manual');
  };

  const handleRunResearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToAnalyze = `${articleHeadline}\n\n${articleRawText}`.trim();
    if (textToAnalyze.length < 20) {
      setErrorMsg(
        'Please enter at least 20 characters of Canadian real estate headline + source article excerpt to analyze.'
      );
      return;
    }

    setIsResearching(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleText: textToAnalyze,
          sourceName: sourceNameInput || 'Canadian Real Estate Source',
          sourceUrl: articleUrl
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Research extraction failed.');
      }
      setResearchResult(data);
    } catch (err: any) {
      // Never fabricate research output on failure. Preserve input and offer retry or manual save.
      setErrorMsg(
        err.message ||
          'AI research service unavailable. Your input is preserved—you can retry or save directly as a manual story record.'
      );
    } finally {
      setIsResearching(false);
    }
  };

  const handleSaveManualStoryWithoutAi = async () => {
    if (!articleHeadline.trim()) {
      setErrorMsg('Headline is required to save a story to the pipeline.');
      return;
    }
    const existingStories = await db.stories.toArray();
    const dup = findDuplicateStory(articleHeadline, articleUrl, existingStories);
    if (dup) {
      setErrorMsg(`Duplicate detected: "${dup.proposedHeadline}" is already in the database.`);
      return;
    }

    const classification = classifyCanadianRealEstateArticle(
      articleHeadline,
      articleRawText
    );
    const dateCheck = validatePublicationDate(publishedAtInput);
    const breakdown = {
      realtorRelevance: classification.realtorRelevanceScore,
      newsImportance: 16,
      timeliness: dateCheck.isOutdated ? 8 : 17,
      audienceInterest: 12,
      sourceReliability: 13,
      originalAngle: 3
    };
    const scoreRes = calculateEditorialScore(breakdown);
    const now = new Date().toISOString();

    const newStory: Story = {
      id: `story-${Date.now()}`,
      originalHeadline: articleHeadline.trim(),
      proposedHeadline: articleHeadline.trim().toUpperCase(),
      sourceUrl: articleUrl.trim(),
      sourcePublicationName: sourceNameInput.trim() || 'Manual Source Entry',
      publicationDate: dateCheck.normalizedDate || now.slice(0, 10),
      dateDiscovered: now.slice(0, 10),
      category: classification.category,
      province: classification.province,
      articleSummary:
        articleRawText.trim() ||
        'Manual story entry logged for research and verification.',
      verifiedFacts: [],
      statistics: [],
      industryImplications: [classification.whyItMatters],
      realtorRelevanceNotes: classification.whyItMatters,
      claimsEvidence: [],
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: now,
          actor: 'Editor (Manual Entry)',
          action: 'Manual Story Logged',
          previousState: 'None',
          newState: 'Unverified',
          notes: 'Saved directly without AI fabrication.'
        }
      ],
      editorialScore: scoreRes.total,
      scoreBreakdown: breakdown,
      verificationStatus: 'Unverified',
      editorialStatus: 'Research Pending',
      assignedFormats: ['Facebook Post'],
      internalNotes: 'Created manually. Requires claim evidence verification before approval.',
      isSampleData: false,
      createdAt: now,
      updatedAt: now
    };

    await db.stories.add(newStory);
    await loadStories();
    setArticleUrl('');
    setArticleHeadline('');
    setArticleRawText('');
    setSourceNameInput('');
    setActiveTab('pipeline');
    setStatusBanner(
      `Saved "${newStory.proposedHeadline}" as Unverified in Story Pipeline.`
    );
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const handleSaveResearchedStory = async () => {
    if (!researchResult) return;

    const candidateHead =
      researchResult.proposedHeadlines?.[0] || articleHeadline || 'CANADIAN REAL ESTATE UPDATE';
    const existingStories = await db.stories.toArray();
    const dup = findDuplicateStory(candidateHead, articleUrl, existingStories);
    if (dup) {
      setErrorMsg(
        `Duplicate story detected: "${dup.proposedHeadline}" already exists in the pipeline.`
      );
      return;
    }

    const classification = classifyCanadianRealEstateArticle(
      candidateHead,
      researchResult.summary || articleRawText
    );
    const dateCheck = validatePublicationDate(publishedAtInput);
    const breakdown = researchResult.suggestedScore || {
      realtorRelevance: classification.realtorRelevanceScore,
      newsImportance: 17,
      timeliness: dateCheck.isOutdated ? 8 : 17,
      audienceInterest: 13,
      sourceReliability: 13,
      originalAngle: 3
    };
    const scoreRes = calculateEditorialScore(breakdown);
    const now = new Date().toISOString();

    const initialClaims: ClaimEvidence[] = (researchResult.claimsToVerify || []).map(
      (c: any, idx: number) => ({
        id: `claim-${Date.now()}-${idx}`,
        claimText: c.claimText || '',
        supportingSource: sourceNameInput || 'Primary Source',
        sourceUrl: articleUrl || '',
        publicationDate: publishedAtInput,
        evidenceExcerpt: c.evidenceExcerpt || c.claimText || '',
        verificationStatus: 'Evidence Collected',
        reviewer: 'AI Research Extraction (Pending Human Review)',
        reviewerNotes: 'Candidate claim extracted from source text.'
      })
    );

    const newStory: Story = {
      id: `story-${Date.now()}`,
      originalHeadline: articleHeadline || candidateHead,
      proposedHeadline: candidateHead.toUpperCase(),
      sourceUrl: articleUrl || '',
      sourcePublicationName: sourceNameInput || 'Canadian News Source',
      publicationDate: dateCheck.normalizedDate || now.slice(0, 10),
      dateDiscovered: now.slice(0, 10),
      category: classification.category,
      province: classification.province,
      articleSummary: researchResult.summary || '',
      verifiedFacts: researchResult.verifiedFacts || [],
      statistics: researchResult.statistics || [],
      industryImplications: researchResult.industryImplications || [],
      realtorRelevanceNotes:
        researchResult.realtorRelevanceNotes || classification.whyItMatters,
      claimsEvidence: initialClaims,
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: now,
          actor: 'News Radar AI Research Assistant',
          action: 'Extracted Claims & Created Story Record',
          previousState: 'None',
          newState: initialClaims.length > 0 ? 'Evidence Collected' : 'Unverified',
          notes: `Extracted ${initialClaims.length} candidate claims for human verification.`
        }
      ],
      editorialScore: scoreRes.total,
      scoreBreakdown: breakdown,
      // CRITICAL: Never auto-verify AI-extracted claims without human review
      verificationStatus: initialClaims.length > 0 ? 'Evidence Collected' : 'Unverified',
      editorialStatus: 'Research Completed',
      assignedFormats: ['Facebook Post'],
      internalNotes:
        researchResult.possibleBiasesOrInaccuracies ||
        'AI extraction complete. Awaiting human fact-check in Story Manager.',
      isSampleData: false,
      createdAt: now,
      updatedAt: now
    };

    await db.stories.add(newStory);
    await loadStories();
    setResearchResult(null);
    setArticleUrl('');
    setArticleHeadline('');
    setArticleRawText('');
    setActiveTab('pipeline');
    setStatusBanner(
      `Saved "${newStory.proposedHeadline}" (${newStory.verificationStatus}) — ready for human verification.`
    );
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const uniqueSources = Array.from(
    new Set(stories.map(s => s.sourcePublicationName))
  ).filter(Boolean);

  const filteredStories = stories.filter(s => {
    const matchesSearch =
      s.proposedHeadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.originalHeadline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.articleSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.sourcePublicationName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = selectedRegion === 'All' || s.province === selectedRegion;
    const matchesCategory = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesStatus =
      selectedResearchStatus === 'All' || s.editorialStatus === selectedResearchStatus;
    const matchesSource =
      selectedSourceFilter === 'All' || s.sourcePublicationName === selectedSourceFilter;
    const matchesRelevance =
      (s.scoreBreakdown?.realtorRelevance || 0) >= minRelevanceFilter;
    return (
      matchesSearch &&
      matchesRegion &&
      matchesCategory &&
      matchesStatus &&
      matchesSource &&
      matchesRelevance
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-[#F20000]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#F20000]">
                Canadian Real Estate Intelligence
              </span>
              {hasLiveFeedFetched ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live RSS Discovery Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  Local Pipeline ({stories.length} stories)
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
              News Radar & Source Discovery Engine
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Discover live Canadian real estate news via official RSS feeds (Bank of Canada, CREA, CMHC, OSFI, StatCan, RECO, BCFSA), screen duplicates, and prepare evidence for human verification.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'pipeline'
                  ? 'bg-[#242626] dark:bg-white text-white dark:text-[#242626]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              Story Pipeline ({stories.length})
            </button>
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'discover'
                  ? 'bg-[#F20000] text-white'
                  : 'bg-red-50 dark:bg-red-950/40 text-[#F20000] hover:bg-red-100'
              }`}
            >
              <Rss className="w-3.5 h-3.5" />
              Discover Canadian Feeds
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'manual'
                  ? 'bg-[#242626] dark:bg-white text-white dark:text-[#242626]'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Research & Extract Article
            </button>
          </div>
        </div>
      </div>

      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="text-emerald-600 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-700 dark:text-red-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#F20000]" />
            <div>
              <p className="font-bold">Operational Notice</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'manual' && (
              <button
                onClick={() => handleRunResearch()}
                className="px-3 py-1.5 rounded-lg bg-[#F20000] text-white font-semibold hover:bg-[#D00000]"
              >
                Retry AI Research
              </button>
            )}
            <button
              onClick={() => setErrorMsg(null)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: GENUINE CANADIAN RSS & SEARCH NEWS DISCOVERY */}
      {activeTab === 'discover' && (
        <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white flex items-center gap-2">
                <Rss className="w-4 h-4 text-[#F20000]" />
                Live Canadian Real Estate RSS & Web Discovery
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Queries official Bank of Canada feeds and Canadian housing RSS indexes (CREA, CMHC, OSFI, StatCan, RECO, BCFSA). Articles are screened for duplicates and 30-day freshness.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useSearchGrounding}
                  onChange={e => setUseSearchGrounding(e.target.checked)}
                  className="rounded border-gray-300 text-[#F20000] focus:ring-[#F20000]"
                />
                Include Gemini Search Grounding (Free Tier)
              </label>
              <button
                onClick={handleDiscoverCanadianNews}
                disabled={isDiscoveringFeed}
                className="flex items-center gap-2 px-4 py-2 bg-[#F20000] hover:bg-[#D00000] disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                {isDiscoveringFeed ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isDiscoveringFeed
                  ? 'Fetching Live Feeds...'
                  : 'Fetch Live Canadian Feeds'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Search / Topic Focus for Canadian Feeds
              </label>
              <input
                type="text"
                value={discoveryQuery}
                onChange={e => setDiscoveryQuery(e.target.value)}
                placeholder="e.g., Bank of Canada rate announcement, Toronto condo inventory, CMHC housing starts"
                className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#242626] dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Feed Status
              </label>
              <div className="px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-400 flex items-center justify-between">
                <span>
                  {lastFetchedAt
                    ? `Fetched ${new Date(lastFetchedAt).toLocaleTimeString()}`
                    : 'Not yet queried this session'}
                </span>
                <span className="font-bold text-[#242626] dark:text-white">
                  {discoveredFeed.length} items
                </span>
              </div>
            </div>
          </div>

          {feedWarnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold">External feed notes:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                {feedWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {discoveredFeed.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
              <Globe className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#242626] dark:text-white">
                Click "Fetch Live Canadian Feeds" to retrieve real-time Canadian real estate news
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                No fake or pre-generated "live" feed items are shown until a genuine external RSS/search request completes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {discoveredFeed.map(item => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                        {item.publisher}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                        Reliability: {item.reliabilityScore}/15
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {item.province}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {item.category}
                      </span>
                      {item.isOutdated && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                          Outdated (&gt;30 Days)
                        </span>
                      )}
                      {item.duplicateOfStoryId && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                          Already in Pipeline
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-[#242626] dark:text-white">
                      {item.headline}
                    </h4>
                    {item.summary && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Published: {item.publicationDate || 'Recent'}
                      </span>
                      <span>REALTOR® Relevance: {item.relevanceScore}/25</span>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#F20000] hover:underline"
                        >
                          Source Link <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleLoadFeedItemIntoResearch(item)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 text-xs font-semibold text-[#242626] dark:text-white"
                    >
                      Research & Extract
                    </button>
                    <button
                      onClick={() => handleIngestDiscoveredItem(item)}
                      disabled={Boolean(item.duplicateOfStoryId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242626] dark:bg-white text-white dark:text-[#242626] disabled:opacity-40 text-xs font-semibold"
                    >
                      {item.duplicateOfStoryId ? (
                        <CopyCheck className="w-3.5 h-3.5" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      {item.duplicateOfStoryId ? 'In Pipeline' : 'Save to Pipeline'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MANUAL / AI-ASSISTED ARTICLE RESEARCH */}
      {activeTab === 'manual' && (
        <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
            <div>
              <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#F20000]" />
                Source Research & Fact Extraction Assistant
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Uses free-tier Gemini (`gemini-3.8-flash`) to structure claims from your source text, or lets you log a story manually if AI is offline.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Free-Tier Safe (gemini-3.8-flash)
            </span>
          </div>

          <form onSubmit={handleRunResearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Canadian News Headline / Topic *
                </label>
                <input
                  type="text"
                  value={articleHeadline}
                  onChange={e => setArticleHeadline(e.target.value)}
                  placeholder="e.g., Bank of Canada holds overnight rate at 3.25%"
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#242626] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Source Publication Name
                </label>
                <input
                  type="text"
                  value={sourceNameInput}
                  onChange={e => setSourceNameInput(e.target.value)}
                  placeholder="e.g., CREA / Bank of Canada / Globe and Mail"
                  className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#242626] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Original Source URL & Publication Date
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={articleUrl}
                    onChange={e => setArticleUrl(e.target.value)}
                    placeholder="https://www.crea.ca/..."
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#242626] dark:text-white"
                  />
                  <input
                    type="date"
                    value={publishedAtInput}
                    onChange={e => setPublishedAtInput(e.target.value)}
                    className="w-36 px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Paste Source Article Excerpt / Press Release Text (Required for Grounded Fact Extraction)
              </label>
              <textarea
                rows={4}
                value={articleRawText}
                onChange={e => setArticleRawText(e.target.value)}
                placeholder="Paste press release, MLS® statistics summary, or news text here..."
                className="w-full px-3.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#242626] dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>
                  Extracted stories enter the pipeline as Unverified / Evidence Collected until human review.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveManualStoryWithoutAi}
                  className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[#242626] dark:text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Save Directly Without AI
                </button>
                <button
                  type="submit"
                  disabled={isResearching}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#F20000] hover:bg-[#D00000] disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  {isResearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isResearching
                    ? 'Extracting Claims...'
                    : 'Run AI Research & Fact Extraction'}
                </button>
              </div>
            </div>
          </form>

          {researchResult && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Candidate Claims Extracted — Requires Human Fact-Check
                  </span>
                  <h4 className="text-lg font-bold font-['Poppins'] text-[#242626] dark:text-white mt-0.5">
                    {researchResult.proposedHeadlines?.[0] || articleHeadline}
                  </h4>
                </div>
                <button
                  onClick={handleSaveResearchedStory}
                  className="flex items-center gap-2 px-4 py-2 bg-[#242626] dark:bg-white text-white dark:text-[#242626] rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Save to Pipeline for Human Verification
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                  <p className="text-xs font-bold uppercase text-gray-400">Executive Summary</p>
                  <p className="text-sm text-[#242626] dark:text-gray-200 leading-relaxed">
                    {researchResult.summary}
                  </p>
                  <p className="text-xs font-bold uppercase text-gray-400 pt-2">
                    REALTOR® Impact
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {researchResult.realtorRelevanceNotes}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
                  <p className="text-xs font-bold uppercase text-gray-400">
                    Extracted Candidate Facts
                  </p>
                  <ul className="space-y-1.5">
                    {researchResult.verifiedFacts?.map((fact: string, i: number) => (
                      <li
                        key={i}
                        className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: STORY PIPELINE & ADVANCED FILTERS */}
      {activeTab === 'pipeline' && (
        <>
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter stories by headline, source, or keyword..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white focus:outline-none focus:border-[#F20000]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <select
                    value={selectedRegion}
                    onChange={e => setSelectedRegion(e.target.value)}
                    className="px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                  >
                    <option value="All">All Canadian Regions</option>
                    {CANADIAN_REGIONS.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                  >
                    <option value="All">All Topics</option>
                    {EDITORIAL_CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={selectedResearchStatus}
                  onChange={e => setSelectedResearchStatus(e.target.value)}
                  className="px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                >
                  {RESEARCH_STATUS_FILTERS.map(rs => (
                    <option key={rs} value={rs}>
                      {rs === 'All' ? 'All Research Statuses' : rs}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSourceFilter}
                  onChange={e => setSelectedSourceFilter(e.target.value)}
                  className="px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                >
                  <option value="All">All Sources</option>
                  {uniqueSources.map(src => (
                    <option key={src} value={src}>
                      {src}
                    </option>
                  ))}
                </select>

                <select
                  value={minRelevanceFilter}
                  onChange={e => setMinRelevanceFilter(Number(e.target.value))}
                  className="px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                >
                  <option value={0}>Any REALTOR® Relevance</option>
                  <option value={15}>Relevance 15+/25</option>
                  <option value={20}>Relevance 20+/25</option>
                </select>
              </div>
            </div>
          </div>

          {filteredStories.length === 0 ? (
            <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center space-y-3">
              <Radar className="w-8 h-8 text-gray-400 mx-auto" />
              <h3 className="text-base font-bold text-[#242626] dark:text-white">
                No Canadian Real Estate Stories in Pipeline
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Click "Discover Canadian Feeds" above to pull live RSS articles from Bank of Canada, CREA, CMHC, and OSFI, or use "Research & Extract Article" to add a story manually.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('discover')}
                  className="px-4 py-2 rounded-lg bg-[#F20000] text-white text-xs font-semibold hover:bg-[#D00000]"
                >
                  Discover Live Canadian Feeds
                </button>
                <button
                  onClick={() => setActiveTab('manual')}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-[#242626] dark:text-white"
                >
                  Add Story Manually
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredStories.map(story => {
                const dateCheck = validatePublicationDate(story.publicationDate);
                return (
                  <div
                    key={story.id}
                    className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs flex flex-col justify-between hover:border-gray-300 dark:hover:border-gray-700 transition-all"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {story.isSampleData && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                              DEMO SAMPLE
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-100 text-[#F20000] dark:bg-red-950/60 dark:text-red-400">
                            Score: {story.editorialScore}/100
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            {story.province}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            {story.category}
                          </span>
                          {dateCheck.isOutdated && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              Outdated ({dateCheck.daysOld}d old)
                            </span>
                          )}
                        </div>

                        <span
                          className={`flex items-center gap-1 text-[11px] font-semibold ${
                            story.verificationStatus === 'Verified'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : story.verificationStatus === 'Rejected'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {story.verificationStatus === 'Verified' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          {story.verificationStatus}
                        </span>
                      </div>

                      <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white leading-snug">
                        {story.proposedHeadline}
                      </h3>

                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                        {story.articleSummary}
                      </p>

                      <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[#F20000] mb-1">
                          Why This Matters to Canadian REALTORS®
                        </p>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                          {story.realtorRelevanceNotes}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Globe className="w-3.5 h-3.5" />
                        <span className="font-medium text-[#242626] dark:text-gray-300">
                          {story.sourcePublicationName}
                        </span>
                        <span>• {story.publicationDate}</span>
                        {story.sourceUrl && (
                          <a
                            href={story.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-[#F20000] hover:underline"
                          >
                            Source <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <button
                        onClick={() => onSelectStoryForStudio(story)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Produce in AI Studio
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
