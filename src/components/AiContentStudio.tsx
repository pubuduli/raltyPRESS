import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Save,
  Send,
  Loader2,
  FileText,
  Image as ImageIcon,
  MessageSquare,
  ShieldCheck,
  Repeat,
  RefreshCw
} from 'lucide-react';
import { db, getOperationalStories, getOperationalDrafts } from '../db';
import { Story, ContentDraft, ContentFormat } from '../types';
import { validateV8Caption } from '../utils/v8rules';

interface AiContentStudioProps {
  selectedStoryProp: Story | null;
  repurposedDraftProp?: ContentDraft | null;
  onNavigateToVisualStudio: (draft: ContentDraft) => void;
  demoMode?: boolean;
}

const ALL_FORMATS: ContentFormat[] = [
  'Facebook Post',
  'LinkedIn Post',
  'Instagram Caption',
  'Short-Form News Summary',
  'Editorial Analysis',
  'Educational Content',
  'Carousel',
  'News Infographic Brief',
  'Reel Script',
  'Reel Caption'
];

export const AiContentStudio: React.FC<AiContentStudioProps> = ({
  selectedStoryProp,
  repurposedDraftProp,
  onNavigateToVisualStudio,
  demoMode = false
}) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string>('');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [repurposedFromPostId, setRepurposedFromPostId] = useState<
    string | undefined
  >(undefined);

  // Generation parameters
  const [format, setFormat] = useState<ContentFormat>('Facebook Post');
  const [targetPlatform, setTargetPlatform] = useState<
    'Facebook' | 'LinkedIn' | 'Instagram' | 'Multi-platform'
  >('Facebook');
  const [editorialAngle, setEditorialAngle] = useState(
    'Strategic Impact for Canadian REALTORS® & Brokers'
  );
  const [tone, setTone] = useState('News-media editorial');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Editable draft fields
  const [headline, setHeadline] = useState('');
  const [caption, setCaption] = useState('');
  const [linkedInContent, setLinkedInContent] = useState('');
  const [instagramContent, setInstagramContent] = useState('');
  const [shortSummaryContent, setShortSummaryContent] = useState('');
  const [infographicCopy, setInfographicCopy] = useState('');
  const [hashtagsText, setHashtagsText] = useState(
    '#realtyPRESS #CanadianRealEstate #CREA #REALTOR #TorontoRealEstate #VancouverRealEstate #CanadianHousing #MortgageRatesCanada #RealEstateNews #PropertyInvestment'
  );
  const [callToAction, setCallToAction] = useState(
    'How is this shifting your buyer or seller strategy this quarter? Share your local market observations below.'
  );
  const [sourceAttribution, setSourceAttribution] = useState('Official Source');
  const [activeOutputTab, setActiveOutputTab] = useState<
    'caption' | 'platforms' | 'infographic'
  >('caption');
  const [copied, setCopied] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadDraftIntoEditor = useCallback((d: ContentDraft) => {
    setActiveDraftId(d.id);
    if (d.storyId) setSelectedStoryId(d.storyId);
    setRepurposedFromPostId(d.repurposedFromPostId);
    setFormat(d.format);
    setTargetPlatform(d.targetPlatform || 'Facebook');
    setHeadline(d.headline);
    setCaption(d.content);
    setLinkedInContent(d.linkedInContent || '');
    setInstagramContent(d.instagramContent || '');
    setShortSummaryContent(d.shortSummaryContent || '');
    setInfographicCopy(d.infographicCopy || '');
    setHashtagsText((d.hashtags || []).join(' '));
    setCallToAction(d.callToAction || '');
    setSourceAttribution(d.sourceAttribution || 'Official Source');
  }, []);

  const loadData = useCallback(async () => {
    const [allStories, allDrafts] = await Promise.all([
      getOperationalStories(demoMode),
      getOperationalDrafts(demoMode)
    ]);
    setStories(allStories);
    setDrafts(allDrafts);

    if (repurposedDraftProp) {
      loadDraftIntoEditor(repurposedDraftProp);
    } else if (selectedStoryProp) {
      setSelectedStoryId(selectedStoryProp.id);
      setHeadline(selectedStoryProp.proposedHeadline);
      setSourceAttribution(selectedStoryProp.sourcePublicationName);
      setEditorialAngle(
        selectedStoryProp.realtorRelevanceNotes ||
          'Strategic Impact for Canadian REALTORS®'
      );
    } else if (allStories.length > 0 && !selectedStoryId) {
      setSelectedStoryId(allStories[0].id);
      setHeadline(allStories[0].proposedHeadline);
      setSourceAttribution(allStories[0].sourcePublicationName);
    }
  }, [
    demoMode,
    selectedStoryProp,
    repurposedDraftProp,
    selectedStoryId,
    loadDraftIntoEditor
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentStory =
    stories.find(s => s.id === selectedStoryId) || stories[0];

  const handleSelectStory = (id: string) => {
    setSelectedStoryId(id);
    const st = stories.find(s => s.id === id);
    if (st) {
      setHeadline(st.proposedHeadline);
      setSourceAttribution(st.sourcePublicationName);
      setEditorialAngle(
        st.realtorRelevanceNotes || 'Strategic Impact for Canadian REALTORS®'
      );
    }
  };

  const handleGenerate = async () => {
    if (!currentStory) {
      setErrorMsg(
        'Please select or create a story in News Radar or Story Manager before generating content.'
      );
      return;
    }
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: currentStory,
          targetPlatform,
          format,
          tone,
          customInstructions: editorialAngle
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'AI content generation failed.');
      }

      setHeadline(data.headline || currentStory.proposedHeadline);
      setCaption(data.caption || '');
      setLinkedInContent(data.linkedInVersion || '');
      setInstagramContent(data.instagramVersion || '');
      setShortSummaryContent(data.shortSummaryVersion || '');
      setInfographicCopy(data.infographicCopy || '');
      if (Array.isArray(data.hashtags) && data.hashtags.length > 0) {
        setHashtagsText(data.hashtags.join(' '));
      }
      setCallToAction(data.callToAction || callToAction);
      setSourceAttribution(
        data.sourceAttribution || currentStory.sourcePublicationName
      );
    } catch (err: any) {
      // Section 3 & Section 6: Never silently substitute fabricated caption text on failure!
      setErrorMsg(
        err.message ||
          'AI generation failed. Your existing input is preserved—you may retry or compose manually below.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const parsedHashtags = hashtagsText
    .split(/[\s,]+/)
    .map(h => h.trim())
    .filter(Boolean)
    .map(h => (h.startsWith('#') ? h : `#${h}`));

  const verifiedClaimsCount = currentStory
    ? (currentStory.claimsEvidence?.filter(
        c => c.verificationStatus === 'Verified'
      ).length || 0) + (currentStory.verifiedFacts?.length || 0)
    : 0;

  const v8Result = validateV8Caption(caption, parsedHashtags, {
    verifiedClaimsCount
  });

  const handleSaveDraft = async (submitForApproval = false) => {
    const id = activeDraftId || `draft-${Date.now()}`;
    const now = new Date().toISOString();
    const newDraft: ContentDraft = {
      id,
      storyId: currentStory?.id,
      repurposedFromPostId,
      title: headline || currentStory?.proposedHeadline || 'Untitled realtyPRESS Post',
      format,
      targetPlatform,
      headline:
        headline || currentStory?.proposedHeadline || 'UNTITLED REALTYPRESS POST',
      content: caption,
      linkedInContent,
      instagramContent,
      shortSummaryContent,
      infographicCopy,
      callToAction,
      hashtags: parsedHashtags,
      sourceAttribution,
      tone,
      wordCount: v8Result.wordCount,
      audience: 'Canadian REALTORS®, mortgage brokers, investors',
      modelUsed: 'gemini-3.8-flash',
      v8Validation: {
        isValid: v8Result.isValid,
        wordCountValid: v8Result.wordCountValid,
        paragraphCountValid: v8Result.paragraphCountValid,
        hashtagCountValid: v8Result.hashtagCountValid,
        hasBrandHashtag: v8Result.hasBrandHashtag,
        issues: v8Result.issues
      },
      status: submitForApproval ? 'Awaiting Approval' : 'Draft',
      isSampleData: false,
      createdAt: now,
      updatedAt: now
    };

    await db.contentDrafts.put(newDraft);

    if (submitForApproval) {
      await db.approvals.put({
        id: `app-${id}`,
        contentType: 'Content Draft',
        targetId: id,
        title: newDraft.headline,
        stage: 'Editorial Review',
        submittedAt: now,
        status: 'Pending',
        reviewerName: 'Editorial Desk',
        feedbackNotes:
          'Awaiting human editorial verification of V8 compliance and Canadian facts.',
        isSampleData: false
      });
    }

    setActiveDraftId(id);
    const updatedDrafts = await getOperationalDrafts(demoMode);
    setDrafts(updatedDrafts);
    setSaveMessage(
      submitForApproval
        ? 'Submitted to Approval Centre!'
        : 'Draft saved to IndexedDB!'
    );
    setTimeout(() => setSaveMessage(null), 3000);
    return newDraft;
  };

  const handleCopyFullPost = () => {
    const fullText = `${caption}\n\n${parsedHashtags.join(' ')}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#F20000]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#F20000]">
              realtyPRESS V8 Editorial Content Engine
            </span>
            {repurposedFromPostId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300">
                <Repeat className="w-3 h-3" /> Repurposed from Published Post (
                {repurposedFromPostId})
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
            AI Content Studio & Programmatic V8 Validator
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Enforces 250–350 words (excluding hashtags), 5 non-empty paragraphs, 10 unique hashtags including #realtyPRESS, and grounded claim verification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Model: gemini-3.8-flash (Free-Tier Protected)
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-red-700 dark:text-red-300">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#F20000]" />
            <div>
              <p className="font-bold">AI Content Generation Error</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F20000] text-white font-semibold hover:bg-[#D00000]"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Generation
            </button>
            <button
              onClick={() => setErrorMsg(null)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Story Context & Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#F20000]" />
              1. Source Story & Editorial Parameters
            </h3>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Select Story from Pipeline
              </label>
              <select
                value={selectedStoryId}
                onChange={e => handleSelectStory(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
              >
                {stories.length === 0 && (
                  <option value="">
                    No stories in pipeline — add one in News Radar
                  </option>
                )}
                {stories.map(s => (
                  <option key={s.id} value={s.id}>
                    [{s.verificationStatus}] {s.proposedHeadline} ({s.province})
                  </option>
                ))}
              </select>
            </div>

            {currentStory && (
              <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#F20000] uppercase text-[10px]">
                    {currentStory.sourcePublicationName} • {currentStory.province}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {currentStory.verificationStatus}
                  </span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {currentStory.articleSummary}
                </p>
                {currentStory.verifiedFacts.length > 0 && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">
                      Grounded Facts & Claims ({currentStory.verifiedFacts.length}):
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-gray-600 dark:text-gray-400">
                      {currentStory.verifiedFacts.slice(0, 4).map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Publication Format (10 Formats)
                </label>
                <select
                  value={format}
                  onChange={e => setFormat(e.target.value as ContentFormat)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                >
                  {ALL_FORMATS.map(fmt => (
                    <option key={fmt} value={fmt}>
                      {fmt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target Platform
                </label>
                <select
                  value={targetPlatform}
                  onChange={e => setTargetPlatform(e.target.value as any)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                >
                  <option value="Facebook">Facebook</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Multi-platform">Multi-platform</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Editorial Angle / Instructions
              </label>
              <input
                type="text"
                value={editorialAngle}
                onChange={e => setEditorialAngle(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#F20000] hover:bg-[#D00000] disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating
                ? 'Generating V8 Editorial Package...'
                : 'Generate V8 Content Package'}
            </button>
          </div>

          {/* Saved Drafts List */}
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white">
              Saved Content Drafts ({drafts.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {drafts.map(d => (
                <div
                  key={d.id}
                  onClick={() => loadDraftIntoEditor(d)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    activeDraftId === d.id
                      ? 'bg-red-50/50 dark:bg-red-950/30 border-[#F20000]'
                      : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase text-[#F20000]">
                        {d.format}
                      </span>
                      {d.repurposedFromPostId && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                          Repurposed
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        d.status === 'Approved'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : d.status === 'Awaiting Approval'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#242626] dark:text-white mt-1 line-clamp-1">
                    {d.headline}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {d.wordCount} words •{' '}
                    {d.v8Validation?.isValid ? 'V8 Compliant' : 'Needs V8 Fix'}
                  </p>
                </div>
              ))}
              {drafts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No drafts saved yet. Generate or compose a post to save.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: V8 Validator & Multi-Tab Editor */}
        <div className="lg:col-span-7 space-y-6">
          {/* V8 Compliance Meter */}
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {v8Result.isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                )}
                <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white">
                  realtyPRESS V8 Programmatic Compliance Validator
                </h3>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                  v8Result.isValid
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}
              >
                {v8Result.isValid
                  ? 'V8 COMPLIANT — READY FOR APPROVAL'
                  : 'ADJUST TO MEET V8 RULES'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
              <div
                className={`p-2.5 rounded-lg border ${
                  v8Result.wordCountValid
                    ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50'
                    : 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50'
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-gray-400">
                  Words (250–350)
                </p>
                <p className="text-base font-bold text-[#242626] dark:text-white mt-0.5">
                  {v8Result.wordCount}
                </p>
              </div>

              <div
                className={`p-2.5 rounded-lg border ${
                  v8Result.paragraphCountValid && !v8Result.hasEmptyParagraphs
                    ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50'
                    : 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50'
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-gray-400">
                  Paragraphs (5)
                </p>
                <p className="text-base font-bold text-[#242626] dark:text-white mt-0.5">
                  {v8Result.paragraphCount}
                </p>
              </div>

              <div
                className={`p-2.5 rounded-lg border ${
                  v8Result.hashtagCountValid
                    ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50'
                    : 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50'
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-gray-400">
                  Hashtags (10)
                </p>
                <p className="text-base font-bold text-[#242626] dark:text-white mt-0.5">
                  {v8Result.hashtagCount}
                </p>
              </div>

              <div
                className={`p-2.5 rounded-lg border ${
                  v8Result.hasBrandHashtag
                    ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50'
                    : 'bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50'
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-gray-400">
                  #realtyPRESS
                </p>
                <p className="text-base font-bold text-[#242626] dark:text-white mt-0.5">
                  {v8Result.hasBrandHashtag ? 'Included' : 'Missing'}
                </p>
              </div>

              <div
                className={`p-2.5 rounded-lg border ${
                  !v8Result.unsupportedClaimsWarning
                    ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50'
                    : 'bg-amber-50/50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50'
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-gray-400">
                  Claims Grounded
                </p>
                <p className="text-xs font-bold text-[#242626] dark:text-white mt-1">
                  {!v8Result.unsupportedClaimsWarning
                    ? 'Grounded'
                    : 'Check Numbers'}
                </p>
              </div>
            </div>

            {v8Result.issues.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-1">
                {v8Result.issues.map((issue, i) => (
                  <p
                    key={i}
                    className="text-xs text-amber-800 dark:text-amber-300 font-medium"
                  >
                    • {issue}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Editor Tabs */}
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setActiveOutputTab('caption')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeOutputTab === 'caption'
                      ? 'bg-[#242626] dark:bg-white text-white dark:text-[#242626]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  V8 5-Para Caption
                </button>
                <button
                  onClick={() => setActiveOutputTab('platforms')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeOutputTab === 'platforms'
                      ? 'bg-[#242626] dark:bg-white text-white dark:text-[#242626]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  LinkedIn / IG / Summary
                </button>
                <button
                  onClick={() => setActiveOutputTab('infographic')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeOutputTab === 'infographic'
                      ? 'bg-[#242626] dark:bg-white text-white dark:text-[#242626]'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Infographic & Carousel Copy
                </button>
              </div>

              <button
                onClick={handleCopyFullPost}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? 'Copied Post' : 'Copy Post'}
              </button>
            </div>

            {activeOutputTab === 'caption' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Post Headline
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold text-[#242626] dark:text-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Main 5-Paragraph Caption (Separate paragraphs with a blank line)
                    </label>
                    <span className="text-[11px] text-gray-400">
                      P1 Hook • P2 Facts • P3 Context • P4 REALTOR® Takeaway • P5 CTA
                    </span>
                  </div>
                  <textarea
                    rows={12}
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Paragraph 1: Hook&#10;&#10;Paragraph 2: Verified Facts&#10;&#10;Paragraph 3: Canadian Context&#10;&#10;Paragraph 4: REALTOR® Takeaway&#10;&#10;Paragraph 5: Engagement Question"
                    className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#242626] dark:text-white leading-relaxed font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    10 Unique Hashtags (Must include #realtyPRESS)
                  </label>
                  <input
                    type="text"
                    value={hashtagsText}
                    onChange={e => setHashtagsText(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono text-[#242626] dark:text-white"
                  />
                </div>
              </div>
            )}

            {activeOutputTab === 'platforms' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    LinkedIn Professional Adaptation
                  </label>
                  <textarea
                    rows={4}
                    value={linkedInContent}
                    onChange={e => setLinkedInContent(e.target.value)}
                    placeholder="Executive LinkedIn commentary for Canadian brokers, lenders, and developers..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Instagram Caption Adaptation
                  </label>
                  <textarea
                    rows={4}
                    value={instagramContent}
                    onChange={e => setInstagramContent(e.target.value)}
                    placeholder="Concise, high-impact Instagram caption..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Short-Form News Summary
                  </label>
                  <textarea
                    rows={3}
                    value={shortSummaryContent}
                    onChange={e => setShortSummaryContent(e.target.value)}
                    placeholder="60–90 word rapid briefing..."
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                  />
                </div>
              </div>
            )}

            {activeOutputTab === 'infographic' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Slide-by-Slide Infographic & Carousel Copy
                </label>
                <textarea
                  rows={6}
                  value={infographicCopy}
                  onChange={e => setInfographicCopy(e.target.value)}
                  placeholder="Slide 1: Headline&#10;Slide 2: Key Metric&#10;Slide 3: REALTOR® Takeaway..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white leading-relaxed"
                />
              </div>
            )}

            {/* Action Footer */}
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                {saveMessage && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {saveMessage}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => handleSaveDraft(false)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-[#242626] dark:text-white transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Draft
                </button>

                <button
                  onClick={async () => {
                    const saved = await handleSaveDraft(false);
                    onNavigateToVisualStudio(saved);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#242626] dark:bg-white text-white dark:text-[#242626] text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Send to Visual Studio
                </button>

                <button
                  onClick={() => handleSaveDraft(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit for Editorial Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
