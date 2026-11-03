import React, { useState, useEffect, useCallback } from 'react';
import {
  Film,
  Sparkles,
  Play,
  Copy,
  Check,
  Save,
  Loader2,
  Clock,
  CheckCircle2,
  Subtitles,
  Download,
  AlertTriangle
} from 'lucide-react';
import { db, getOperationalStories, getOperationalReels } from '../db';
import { Story, ReelScript, ReelScene } from '../types';

interface ReelStudioProps {
  demoMode?: boolean;
}

export const ReelStudio: React.FC<ReelStudioProps> = ({ demoMode = false }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<ReelScript[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string>('');
  const [durationSeconds, setDurationSeconds] = useState<30 | 45 | 60>(45);
  const [style, setStyle] = useState<ReelScript['style']>('Professional Breaking-News');
  const [productionStatus, setProductionStatus] = useState<
    'AI-Generated Script' | 'Production Instructions' | 'Uploaded Video Media' | 'Final Exported Reel'
  >('Production Instructions');

  const [title, setTitle] = useState('');
  const [openingHook, setOpeningHook] = useState('');
  const [narration, setNarration] = useState('');
  const [scenes, setScenes] = useState<ReelScene[]>([]);
  const [closingQuestion, setClosingQuestion] = useState(
    'How is this shifting buyer strategy in your local market? Share your thoughts below.'
  );
  const [audioMood, setAudioMood] = useState('Modern Urgent News Broadcast');
  const [caption, setCaption] = useState('');
  const [hashtagsText, setHashtagsText] = useState(
    '#realtyPRESS #CanadianRealEstate #CREA #REALTOR #CanadianHousing #TorontoRealEstate #VancouverRealEstate #MortgageRatesCanada #RealEstateReels #BrokerageLife'
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedVoiceover, setCopiedVoiceover] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [allStories, allReels] = await Promise.all([
      getOperationalStories(demoMode),
      getOperationalReels(demoMode)
    ]);
    setStories(allStories);
    setReels(allReels);
    if (allStories.length > 0 && !selectedStoryId) {
      setSelectedStoryId(allStories[0].id);
      setTitle(allStories[0].proposedHeadline || allStories[0].originalHeadline);
    }
  }, [demoMode, selectedStoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentStory = stories.find(s => s.id === selectedStoryId) || stories[0];

  const handleGenerateReel = async () => {
    if (!currentStory) {
      setErrorMsg('Please select or create a story in News Radar first.');
      return;
    }
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/generate-reel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: currentStory.proposedHeadline || currentStory.originalHeadline,
          summary: currentStory.articleSummary,
          verifiedFacts: currentStory.verifiedFacts || [],
          style,
          durationSeconds
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Reel script generation failed.');
      }

      setTitle(currentStory.proposedHeadline || currentStory.originalHeadline);
      setOpeningHook(data.openingHook || '');
      setNarration(data.narration || '');
      setScenes(Array.isArray(data.scenes) ? data.scenes : []);
      setClosingQuestion(data.closingQuestion || closingQuestion);
      setCaption(data.caption || '');
      setAudioMood(data.audioMood || audioMood);
      setProductionStatus('AI-Generated Script');
      if (Array.isArray(data.hashtags) && data.hashtags.length > 0) {
        setHashtagsText(data.hashtags.join(' '));
      }
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          'AI Reel generation failed. Your existing script is preserved—you may retry or edit scenes manually.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddManualScene = () => {
    setScenes(prev => [
      ...prev,
      {
        sceneNumber: prev.length + 1,
        durationSeconds: 7,
        visualInstructions: 'B-roll of Canadian residential street or chart graphic',
        onScreenText: 'KEY MARKET METRIC',
        subtitleText: 'Enter timed subtitle narration...',
        transitionNote: 'Quick cut with subtle whoosh',
        promptNanoBanana: 'Editorial 9:16 vertical real estate b-roll',
        promptVeoSora: 'Cinematic vertical pan of Canadian city skyline'
      }
    ]);
  };

  const handleExportProductionBrief = () => {
    const content = [
      `realtyPRESS REEL PRODUCTION BRIEF`,
      `Title: ${title}`,
      `Target Duration: ${durationSeconds}s | Style: ${style} | Status: ${productionStatus}`,
      `Opening 3s Hook: ${openingHook}`,
      `Audio Mood: ${audioMood}`,
      ``,
      `--- FULL NARRATION ---`,
      narration,
      ``,
      `--- SCENE BREAKDOWN ---`,
      ...scenes.map(
        s =>
          `[Scene ${s.sceneNumber} | ${s.durationSeconds}s]\nOn-Screen Text: ${s.onScreenText}\nSubtitle/VO: ${s.subtitleText}\nVisual Instructions: ${s.visualInstructions}\nTransition: ${s.transitionNote || 'Standard Cut'}\n`
      ),
      `--- CLOSING QUESTION ---`,
      closingQuestion,
      ``,
      `--- CAPTION & HASHTAGS ---`,
      caption,
      hashtagsText
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `realtypress-reel-brief-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveReel = async () => {
    const parsedTags = hashtagsText
      .split(/[\s,]+/)
      .map(h => h.trim())
      .filter(Boolean)
      .map(h => (h.startsWith('#') ? h : `#${h}`));

    const newReel: ReelScript = {
      id: `reel-${Date.now()}`,
      storyId: currentStory?.id,
      title:
        title ||
        currentStory?.proposedHeadline ||
        currentStory?.originalHeadline ||
        'Untitled Canadian Real Estate Reel',
      style,
      durationSeconds,
      openingHook,
      narration,
      scenes,
      closingQuestion,
      caption,
      hashtags: parsedTags,
      audioMood,
      productionStatus,
      status: 'Awaiting Approval',
      createdAt: new Date().toISOString(),
      isSampleData: false
    };

    await db.reelScripts.add(newReel);
    await db.approvals.put({
      id: `app-${newReel.id}`,
      contentType: 'Reel',
      targetId: newReel.id,
      title: `[Reel ${durationSeconds}s] ${newReel.title}`,
      stage: 'Editorial Review',
      status: 'Pending',
      reviewerName: 'Editorial Desk',
      submittedAt: new Date().toISOString(),
      feedbackNotes: `Reel production script (${productionStatus}) submitted from Reel Studio.`,
      isSampleData: false
    });

    const allReels = await getOperationalReels(demoMode);
    setReels(allReels);
    setSavedNotice('Reel script saved & queued in Approval Centre!');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleCopyVoiceover = () => {
    const fullVO = [
      openingHook,
      narration,
      ...scenes.map(s => s.subtitleText),
      closingQuestion
    ]
      .filter(Boolean)
      .join('\n\n');
    navigator.clipboard.writeText(fullVO);
    setCopiedVoiceover(true);
    setTimeout(() => setCopiedVoiceover(false), 2000);
  };

  const loadReelIntoEditor = (r: ReelScript) => {
    setTitle(r.title);
    setDurationSeconds((r.durationSeconds as 30 | 45 | 60) || 45);
    setStyle(r.style);
    setOpeningHook(r.openingHook);
    setNarration(r.narration);
    setScenes(r.scenes || []);
    setClosingQuestion(r.closingQuestion);
    setAudioMood(r.audioMood);
    setCaption(r.caption);
    setProductionStatus(r.productionStatus || 'Production Instructions');
    setHashtagsText((r.hashtags || []).join(' '));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-[#F20000]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#F20000]">
              Short-Form Vertical Video Production (3 Reels / Week Target)
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
            Reel Studio & Scene-by-Scene Script Engine
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Generate 30s, 45s, and 60s Canadian real estate Reels with 3-second hooks, timed voiceovers, transitions, and downloadable production briefs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {([30, 45, 60] as const).map(dur => (
            <button
              key={dur}
              onClick={() => setDurationSeconds(dur)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                durationSeconds === dur
                  ? 'bg-[#F20000] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {dur}s Reel
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F20000]" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Configuration & Saved Reels */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white">
              1. Select Canadian News Story
            </h3>
            <select
              value={selectedStoryId}
              onChange={e => {
                setSelectedStoryId(e.target.value);
                const st = stories.find(s => s.id === e.target.value);
                if (st) setTitle(st.proposedHeadline || st.originalHeadline);
              }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
            >
              {stories.map(s => (
                <option key={s.id} value={s.id}>
                  {s.proposedHeadline || s.originalHeadline} ({s.province})
                </option>
              ))}
            </select>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Editorial Reel Style
              </label>
              <select
                value={style}
                onChange={e => setStyle(e.target.value as ReelScript['style'])}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
              >
                <option value="Professional Breaking-News">Professional Breaking-News</option>
                <option value="Cinematic Real Estate">Cinematic Real Estate</option>
                <option value="Presenter-Style Explainer">Presenter-Style Explainer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Asset Production Classification
              </label>
              <select
                value={productionStatus}
                onChange={e => setProductionStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
              >
                <option value="AI-Generated Script">AI-Generated Script</option>
                <option value="Production Instructions">Production Instructions</option>
                <option value="Uploaded Video Media">Uploaded Video Media</option>
                <option value="Final Exported Reel">Final Exported Reel</option>
              </select>
            </div>

            <button
              onClick={handleGenerateReel}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#F20000] hover:bg-[#D00000] disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isGenerating
                ? `Scripting ${durationSeconds}s Reel...`
                : `Generate ${durationSeconds}s Reel Script`}
            </button>
          </div>

          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white">
              Saved Reel Scripts ({reels.length})
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {reels.map(r => (
                <div
                  key={r.id}
                  onClick={() => loadReelIntoEditor(r)}
                  className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-[#F20000] cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-[#F20000] uppercase">{r.durationSeconds}s REEL</span>
                    <span className="text-gray-400">{r.productionStatus || r.status}</span>
                  </div>
                  <p className="text-xs font-semibold text-[#242626] dark:text-white mt-1 line-clamp-2">
                    {r.title}
                  </p>
                </div>
              ))}
              {reels.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">
                  No Reel scripts saved yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Script & Scene Timeline */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <span className="text-xs font-bold uppercase text-[#F20000]">
                  Vertical Video Storyboard ({durationSeconds}s • {productionStatus})
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Reel Title..."
                  className="block w-full mt-1 text-base font-bold font-['Poppins'] bg-transparent text-[#242626] dark:text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyVoiceover}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200"
                >
                  {copiedVoiceover ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedVoiceover ? 'Copied VO' : 'Copy Voiceover'}
                </button>
                <button
                  onClick={handleExportProductionBrief}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-[#242626] dark:text-white"
                >
                  <Download className="w-3.5 h-3.5 text-[#F20000]" />
                  Export Brief (.txt)
                </button>
                <button
                  onClick={handleSaveReel}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save & Queue Approval
                </button>
              </div>
            </div>

            {savedNotice && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {savedNotice}
              </div>
            )}

            {/* 3-Second Hook */}
            <div className="p-4 rounded-xl bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#F20000] flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  0–3s Scroll-Stopping Opening Hook
                </span>
                <span className="text-[11px] font-semibold text-gray-500">
                  Audio Mood: {audioMood}
                </span>
              </div>
              <textarea
                rows={2}
                value={openingHook}
                onChange={e => setOpeningHook(e.target.value)}
                placeholder="Click Generate Reel Script or type your 3-second opening hook..."
                className="w-full bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border border-red-100 dark:border-red-900/50 text-xs font-semibold text-[#242626] dark:text-white"
              />
            </div>

            {/* Scene Breakdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Timed Scene-by-Scene Production Table
                </h4>
                <button
                  type="button"
                  onClick={handleAddManualScene}
                  className="text-xs font-semibold text-[#F20000] hover:underline"
                >
                  + Add Scene
                </button>
              </div>
              {scenes.length > 0 ? (
                <div className="space-y-3">
                  {scenes.map((sc, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded bg-[#242626] text-white text-[10px] font-bold">
                          Scene {sc.sceneNumber}
                        </span>
                        <span className="flex items-center gap-1 text-xs font-mono font-semibold text-[#F20000]">
                          <Clock className="w-3.5 h-3.5" />
                          {sc.durationSeconds}s
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">
                            Voiceover / Subtitle Copy
                          </p>
                          <p className="text-[#242626] dark:text-gray-200 font-medium leading-relaxed">
                            {sc.subtitleText}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-[#F20000]">
                              On-Screen Text Overlay:{' '}
                            </span>
                            <span className="font-bold text-[#242626] dark:text-white">
                              {sc.onScreenText}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400">
                              Visual Instructions:{' '}
                            </span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {sc.visualInstructions}
                            </span>
                          </div>
                          {sc.transitionNote && (
                            <div>
                              <span className="text-[10px] font-bold uppercase text-gray-400">
                                Transition:{' '}
                              </span>
                              <span className="text-gray-500">{sc.transitionNote}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400">
                  Click "Generate {durationSeconds}s Reel Script" on the left or "+ Add Scene" to populate the storyboard.
                </div>
              )}
            </div>

            {/* Narration & Companion Caption */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  <Subtitles className="w-3.5 h-3.5 text-[#F20000]" />
                  Full Spoken Narration Script
                </label>
                <textarea
                  rows={4}
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Reel Companion Caption
                </label>
                <textarea
                  rows={4}
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
