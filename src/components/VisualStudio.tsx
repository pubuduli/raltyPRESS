import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Copy,
  Check,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Download,
  Upload,
  FolderOpen
} from 'lucide-react';
import { db, getOperationalDrafts, getOperationalMedia } from '../db';
import { ContentDraft, MediaAsset } from '../types';

interface VisualStudioProps {
  selectedDraftProp: ContentDraft | null;
  demoMode?: boolean;
}

export const VisualStudio: React.FC<VisualStudioProps> = ({
  selectedDraftProp,
  demoMode = false
}) => {
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string>('');

  const [aspectRatio, setAspectRatio] = useState<'4:5' | '9:16' | '1:1' | '16:9'>('4:5');
  const [templateStyle, setTemplateStyle] = useState<
    'Breaking News' | 'Market Stat Callout' | 'Policy Alert' | 'Executive Quote'
  >('Breaking News');
  const [headlinePosition, setHeadlinePosition] = useState<'bottom' | 'center' | 'top'>('bottom');
  const [accentColor, setAccentColor] = useState<'#F20000' | '#242626' | '#FFFFFF'>('#F20000');
  const [assetOrigin, setAssetOrigin] = useState<
    'Production Instructions Only' | 'Uploaded Media' | 'AI Generated Image' | 'Final Exported Asset'
  >('Production Instructions Only');
  const [uploadedImageDataUrl, setUploadedImageDataUrl] = useState<string | null>(null);

  const [headlineText, setHeadlineText] = useState('BANK OF CANADA HOLDS RATE AT 3.25%');
  const [highlightWordsText, setHighlightWordsText] = useState('3.25%, RATE');
  const [subtext, setSubtext] = useState('KEY MORTGAGE TAKEAWAYS FOR CANADIAN REALTORS®');
  const [categoryTag, setCategoryTag] = useState('RATE DECISION');
  const [sourceCredit, setSourceCredit] = useState('SOURCE: BANK OF CANADA / CREA');
  const [imagePrompt, setImagePrompt] = useState(
    'Editorial photojournalism of the Bank of Canada building in Ottawa and downtown Toronto financial district at dusk, dramatic architectural lighting, high contrast, dark lower-third space for realtyPRESS #F20000 red bar and bold white typography.'
  );
  const [layoutInstructions, setLayoutInstructions] = useState(
    'Place realtyPRESS badge top-left. Solid #F20000 category pill above bold white headline in lower third. Keep 20% margin clear from edges.'
  );

  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const applyDraftToCanvas = (draft: ContentDraft) => {
    const words = (draft.headline || draft.title).toUpperCase().split(/\s+/).slice(0, 8).join(' ');
    setHeadlineText(words || 'CANADIAN HOUSING MARKET UPDATE');
    setSubtext('STRATEGIC INSIGHTS FOR CANADIAN REALTORS®');
    if (draft.sourceAttribution) {
      setSourceCredit(`SOURCE: ${draft.sourceAttribution.toUpperCase()}`);
    }
  };

  const loadData = useCallback(async () => {
    const [allDrafts, allMedia] = await Promise.all([
      getOperationalDrafts(demoMode),
      getOperationalMedia(demoMode)
    ]);
    setDrafts(allDrafts);
    setMediaAssets(allMedia);
    if (selectedDraftProp) {
      setSelectedDraftId(selectedDraftProp.id);
      applyDraftToCanvas(selectedDraftProp);
    } else if (allDrafts.length > 0 && !selectedDraftId) {
      setSelectedDraftId(allDrafts[0].id);
      applyDraftToCanvas(allDrafts[0]);
    }
  }, [demoMode, selectedDraftProp, selectedDraftId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const headlineWordCount = headlineText.trim().split(/\s+/).filter(Boolean).length;
  const isHeadlineValid = headlineWordCount > 0 && headlineWordCount <= 8;

  const handleGenerateVisualPrompt = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/generate-visual-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: headlineText,
          category: categoryTag,
          storySummary: `${subtext} (${templateStyle}, ${aspectRatio})`
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Visual prompt generation failed.');
      }
      if (data.headline) setHeadlineText(data.headline.toUpperCase());
      if (Array.isArray(data.highlightWords) && data.highlightWords.length > 0) {
        setHighlightWordsText(data.highlightWords.join(', '));
      }
      if (data.prompt) setImagePrompt(data.prompt);
      if (data.compositionGuide) setLayoutInstructions(data.compositionGuide);
    } catch (err: any) {
      setErrorMsg(
        err.message || 'AI visual prompt service unavailable. Your existing layout settings are preserved.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (typeof ev.target?.result === 'string') {
        setUploadedImageDataUrl(ev.target.result);
        setAssetOrigin('Uploaded Media');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportGraphicPng = () => {
    const canvas = canvasRef.current || document.createElement('canvas');
    const dims =
      aspectRatio === '4:5'
        ? { w: 1080, h: 1350 }
        : aspectRatio === '9:16'
        ? { w: 1080, h: 1920 }
        : aspectRatio === '16:9'
        ? { w: 1600, h: 900 }
        : { w: 1080, h: 1080 };
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 0, dims.h);
    grad.addColorStop(0, '#1E2022');
    grad.addColorStop(0.55, '#242626');
    grad.addColorStop(1, '#0D0E10');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dims.w, dims.h);

    ctx.fillStyle = '#F20000';
    ctx.fillRect(60, 60, 44, 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('R', 73, 91);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('realtyPRESS', 118, 92);

    ctx.fillStyle = accentColor === '#FFFFFF' ? '#F20000' : accentColor;
    ctx.fillRect(60, dims.h - 420, 280, 44);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(categoryTag.slice(0, 22), 76, dims.h - 391);

    ctx.fillStyle = '#F20000';
    ctx.fillRect(60, dims.h - 345, 10, 160);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 54px sans-serif';
    const words = headlineText.split(' ');
    let line = '';
    let y = dims.h - 300;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > dims.w - 160) {
        ctx.fillText(line.trim(), 90, y);
        line = w + ' ';
        y += 64;
      } else {
        line = test;
      }
    }
    if (line.trim()) ctx.fillText(line.trim(), 90, y);

    ctx.fillStyle = '#D1D5DB';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(subtext.slice(0, 60), 60, dims.h - 120);

    ctx.fillStyle = '#9CA3AF';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(sourceCredit, 60, dims.h - 60);
    ctx.fillStyle = '#F20000';
    ctx.fillText('CANADA REAL ESTATE INSIGHTS', dims.w - 360, dims.h - 60);

    const dataUrl = canvas.toDataURL('image/png');
    setAssetOrigin('Final Exported Asset');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `realtypress-${aspectRatio.replace(':', 'x')}-${Date.now()}.png`;
    a.click();
  };

  const handleSaveAsset = async () => {
    const highlightWords = highlightWordsText
      .split(',')
      .map(w => w.trim())
      .filter(Boolean);

    const newAsset: MediaAsset = {
      id: `media-${Date.now()}`,
      draftId: selectedDraftId || undefined,
      title: headlineText,
      type: aspectRatio === '9:16' ? 'video' : 'image',
      aspectRatio,
      templateStyle,
      headline: headlineText,
      headlinePosition,
      headlineHighlightWords: highlightWords,
      accentColor,
      prompt: `${imagePrompt}\n\nLayout: ${layoutInstructions}`,
      imageUrl: uploadedImageDataUrl || undefined,
      assetOrigin,
      version: 1,
      status: 'Under Review',
      qaChecklist: {
        aspectRatioCorrect: true,
        headlineCorrect: isHeadlineValid,
        spellingCorrect: true,
        appropriateImage: true,
        redHighlightsCorrect: highlightWords.length > 0,
        noUnwantedText: true,
        noWatermark: true,
        sourceAssociated: Boolean(sourceCredit.trim())
      },
      isSampleData: false,
      createdAt: new Date().toISOString()
    };

    await db.mediaAssets.add(newAsset);
    await db.approvals.put({
      id: `app-${newAsset.id}`,
      contentType: 'Media Asset',
      targetId: newAsset.id,
      title: `[Visual ${aspectRatio}] ${headlineText}`,
      stage: 'Visual Review',
      status: 'Pending',
      reviewerName: 'Editorial Desk',
      submittedAt: new Date().toISOString(),
      feedbackNotes: `V8 Visual Card (${assetOrigin}) submitted from Visual Studio.`,
      isSampleData: false
    });

    const updatedMedia = await getOperationalMedia(demoMode);
    setMediaAssets(updatedMedia);
    setSavedNotice('Visual asset saved & queued in Approval Centre!');
    setTimeout(() => setSavedNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[#F20000]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#F20000]">
              realtyPRESS V8 Visual Production System
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
            Visual Studio & Editorial Layout Builder
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Design 4:5 Feed, 9:16 Story, 1:1 Square, and 16:9 Landscape editorial cards, export PNG graphics, and manage your asset library.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['4:5', '9:16', '1:1', '16:9'] as const).map(ratio => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                aspectRatio === ratio
                  ? 'bg-[#F20000] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              {ratio}{' '}
              {ratio === '4:5'
                ? 'Feed'
                : ratio === '9:16'
                ? 'Story/Reel'
                : ratio === '16:9'
                ? 'Landscape'
                : 'Square'}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between text-xs text-red-700 dark:text-red-300">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Controls */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#F20000]" />
                Visual Card Typography & Brand Controls
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                Status: {assetOrigin}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Load From Content Draft
              </label>
              <select
                value={selectedDraftId}
                onChange={e => {
                  setSelectedDraftId(e.target.value);
                  const d = drafts.find(dr => dr.id === e.target.value);
                  if (d) applyDraftToCanvas(d);
                }}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
              >
                {drafts.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.headline || d.title} ({d.format})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Template Style
                </label>
                <select
                  value={templateStyle}
                  onChange={e => setTemplateStyle(e.target.value as any)}
                  className="w-full px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                >
                  <option value="Breaking News">Breaking News</option>
                  <option value="Market Stat Callout">Market Stat Callout</option>
                  <option value="Policy Alert">Policy Alert</option>
                  <option value="Executive Quote">Executive Quote</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Headline Position
                </label>
                <select
                  value={headlinePosition}
                  onChange={e => setHeadlinePosition(e.target.value as any)}
                  className="w-full px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                >
                  <option value="bottom">Lower Third (Standard)</option>
                  <option value="center">Center Impact</option>
                  <option value="top">Upper Editorial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Brand Pill Colour
                </label>
                <select
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value as any)}
                  className="w-full px-2.5 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                >
                  <option value="#F20000">Primary Red (#F20000)</option>
                  <option value="#242626">Charcoal (#242626)</option>
                  <option value="#FFFFFF">White (#FFFFFF)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Category Tag Pill
                </label>
                <input
                  type="text"
                  value={categoryTag}
                  onChange={e => setCategoryTag(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold text-[#242626] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Source Attribution Footer
                </label>
                <input
                  type="text"
                  value={sourceCredit}
                  onChange={e => setSourceCredit(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-[#242626] dark:text-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Primary Graphic Headline (V8 Rule: Max 8 Words)
                </label>
                <span
                  className={`text-[11px] font-bold ${
                    isHeadlineValid ? 'text-emerald-600' : 'text-red-500'
                  }`}
                >
                  {headlineWordCount}/8 words
                </span>
              </div>
              <input
                type="text"
                value={headlineText}
                onChange={e => setHeadlineText(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-[#242626] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Secondary Deck / Subtext
              </label>
              <input
                type="text"
                value={subtext}
                onChange={e => setSubtext(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-[#242626] dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-[#242626] dark:text-white cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#F20000]" />
                Upload Background Photo
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>

              <button
                onClick={handleGenerateVisualPrompt}
                disabled={isGenerating}
                className="flex items-center gap-2 py-2 px-4 bg-[#242626] dark:bg-white text-white dark:text-[#242626] rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#F20000]" />
                )}
                {isGenerating ? 'Refining Art Direction...' : 'AI Refine Layout & Prompt'}
              </button>
            </div>
          </div>

          {/* Prompt & Instructions */}
          <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white">
                AI Image Generation Prompt & Production Brief
              </h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(imagePrompt);
                  setCopiedPrompt(true);
                  setTimeout(() => setCopiedPrompt(false), 2000);
                }}
                className="flex items-center gap-1 text-xs font-semibold text-[#F20000] hover:underline"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPrompt ? 'Copied Prompt' : 'Copy Prompt'}
              </button>
            </div>

            <textarea
              rows={3}
              value={imagePrompt}
              onChange={e => setImagePrompt(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-700 dark:text-gray-300 leading-relaxed"
            />

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Production Layout Instructions
              </label>
              <textarea
                rows={2}
                value={layoutInstructions}
                onChange={e => setLayoutInstructions(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-600 dark:text-gray-400"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div>
                {savedNotice && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {savedNotice}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportGraphicPng}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-[#242626] dark:text-white"
                >
                  <Download className="w-4 h-4 text-[#F20000]" />
                  Export PNG Graphic
                </button>
                <button
                  onClick={handleSaveAsset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Visual Asset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Live Brand Preview */}
        <div className="lg:col-span-6 flex flex-col items-center">
          <div className="w-full bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Live Brand Overlay Preview ({aspectRatio} • {templateStyle})
              </span>
              <span
                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  isHeadlineValid ? 'text-emerald-600' : 'text-amber-600'
                }`}
              >
                {isHeadlineValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                {isHeadlineValid ? 'V8 Visual Spec Passed' : 'Shorten Headline (<8 words)'}
              </span>
            </div>

            {/* Simulated Editorial Card Canvas */}
            <div
              className={`relative w-full max-w-md overflow-hidden rounded-xl border border-gray-800 shadow-lg bg-[#242626] flex flex-col justify-between p-6 text-white ${
                aspectRatio === '4:5'
                  ? 'aspect-[4/5]'
                  : aspectRatio === '9:16'
                  ? 'aspect-[9/16] max-w-xs'
                  : aspectRatio === '16:9'
                  ? 'aspect-[16/9]'
                  : 'aspect-square'
              }`}
            >
              {uploadedImageDataUrl && (
                <img
                  src={uploadedImageDataUrl}
                  alt="Uploaded Visual Background"
                  className="absolute inset-0 w-full h-full object-cover opacity-55"
                />
              )}
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#F20000_1px,transparent_1px)] [background-size:20px_20px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/30" />

              {/* Top Brand Header */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2 bg-black/70 backdrop-blur-xs px-3 py-1.5 rounded-md border border-white/10">
                  <div className="w-5 h-5 rounded-xs bg-[#F20000] flex items-center justify-center font-bold text-xs">
                    R
                  </div>
                  <span className="font-['Poppins'] font-bold text-xs tracking-tight">
                    realty<span className="text-[#F20000]">PRESS</span>
                  </span>
                </div>

                <span className="px-2.5 py-1 rounded-xs bg-[#F20000] text-white font-['Poppins'] font-bold text-[10px] tracking-widest uppercase">
                  {categoryTag}
                </span>
              </div>

              {/* Lower/Center/Top Editorial Block */}
              <div
                className={`relative z-10 space-y-3 ${
                  headlinePosition === 'center'
                    ? 'my-auto'
                    : headlinePosition === 'top'
                    ? 'mb-auto mt-6'
                    : 'mt-auto'
                }`}
              >
                <div className="w-12 h-1.5 bg-[#F20000]" />

                <div className="border-l-4 border-[#F20000] pl-3.5 space-y-1.5">
                  <h4 className="font-['Poppins'] font-extrabold text-xl sm:text-2xl tracking-tight leading-tight uppercase text-white drop-shadow-xs">
                    {headlineText || 'HEADLINE PREVIEW'}
                  </h4>
                  <p className="font-sans font-semibold text-xs text-gray-200 tracking-wide uppercase">
                    {subtext}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/15 flex items-center justify-between text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
                  <span>{sourceCredit}</span>
                  <span className="text-[#F20000] font-bold">CANADA REAL ESTATE INSIGHTS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Saved Visual Assets Library */}
          <div className="w-full bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs mt-6 space-y-3">
            <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#F20000]" />
              Saved Visual Asset Library ({mediaAssets.length})
            </h3>
            {mediaAssets.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">
                No visual assets saved yet. Click "Save Visual Asset" to store cards in your library.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto">
                {mediaAssets.map(asset => (
                  <div
                    key={asset.id}
                    onClick={() => {
                      setAspectRatio(asset.aspectRatio);
                      setHeadlineText(asset.headline);
                      setImagePrompt(asset.prompt);
                      if (asset.templateStyle) setTemplateStyle(asset.templateStyle);
                      if (asset.headlinePosition) setHeadlinePosition(asset.headlinePosition);
                    }}
                    className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 cursor-pointer hover:border-[#F20000]"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-[#F20000]">{asset.aspectRatio} • {asset.type}</span>
                      <span className="text-gray-400">{asset.assetOrigin || asset.status}</span>
                    </div>
                    <p className="text-xs font-bold text-[#242626] dark:text-white line-clamp-1 mt-1">
                      {asset.headline || asset.title}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
