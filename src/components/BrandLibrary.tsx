import React, { useState } from 'react';
import {
  BookmarkCheck,
  Palette,
  Type,
  FileText,
  Image,
  Video,
  Hash,
  Copy,
  Check,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { EDITORIAL_THEMES } from '../types';

export const BrandLibrary: React.FC = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-[#F20000]">
            <BookmarkCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-gray-900 dark:text-gray-100 font-heading">
              realtyPRESS Brand & V8 Editorial Library
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              The permanent source-of-truth for realtyPRESS visual standards, caption rules, typography & 13 content pillars
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-bold px-2.5 py-1 bg-red-100 dark:bg-red-950/60 text-[#F20000] rounded-lg">
            Version 8.0 Active
          </span>
        </div>
      </div>

      {/* BRAND COLOR PALETTE & TYPOGRAPHY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Colors */}
        <div className="p-5 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center">
            <Palette className="w-4 h-4 text-[#F20000] mr-1.5" />
            Official Brand Color Palette
          </h2>

          <div className="grid grid-cols-3 gap-3 text-xs">
            {/* Primary Red */}
            <div className="space-y-1.5">
              <div className="h-16 rounded-lg bg-[#F20000] shadow-sm flex items-end p-2 text-white font-mono text-[10px] font-bold">
                #F20000
              </div>
              <div className="font-bold text-gray-900 dark:text-gray-100">Primary Red</div>
              <div className="text-[10px] text-gray-400">Graphic emphasis & CTAs</div>
            </div>

            {/* Dark Charcoal */}
            <div className="space-y-1.5">
              <div className="h-16 rounded-lg bg-[#242626] shadow-sm flex items-end p-2 text-white font-mono text-[10px] font-bold">
                #242626
              </div>
              <div className="font-bold text-gray-900 dark:text-gray-100">Dark Charcoal</div>
              <div className="text-[10px] text-gray-400">Card backgrounds & text</div>
            </div>

            {/* White */}
            <div className="space-y-1.5">
              <div className="h-16 rounded-lg bg-[#FFFFFF] border border-gray-200 shadow-sm flex items-end p-2 text-gray-900 font-mono text-[10px] font-bold">
                #FFFFFF
              </div>
              <div className="font-bold text-gray-900 dark:text-gray-100">Clean White</div>
              <div className="text-[10px] text-gray-400">Headline typography & canvas</div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-gray-500">
            <strong>Secondary Backgrounds:</strong> <code>#F5F6F7</code> (Light Mode) • <code>#17191B</code> (Dark Mode).
          </div>
        </div>

        {/* Typography */}
        <div className="p-5 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center">
            <Type className="w-4 h-4 text-[#F20000] mr-1.5" />
            Editorial Typography Rules
          </h2>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="font-mono text-[10px] text-[#F20000] font-bold uppercase">
                V8 Graphic Headlines
              </span>
              <div className="text-xl font-black font-['Poppins'] tracking-tight uppercase mt-1">
                Poppins Black (900)
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Used exclusively for graphic overlays. Uppercase only, negative letter spacing (-0.02em), no logos.
              </p>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
              <span className="font-mono text-[10px] text-gray-500 font-bold uppercase">
                CMS Interface & Captions
              </span>
              <div className="text-base font-semibold font-['Inter'] mt-1">
                Inter (400, 500, 600, 700)
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Clean, readable neo-grotesque UI font for newsroom dashboards, editorial forms, and captions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* REALTYPRESS V8 EDITORIAL RULES MANIFESTO */}
      <div className="p-6 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-gray-100 font-heading flex items-center">
            <FileText className="w-4 h-4 text-[#F20000] mr-2" />
            Official realtyPRESS V8 Editorial Standards
          </h2>
          <span className="text-xs text-gray-400 font-mono">Mandatory on all AI generators</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Caption Rules */}
          <div className="space-y-3">
            <h3 className="font-bold text-[#F20000] uppercase text-[11px]">
              Caption Requirements (Facebook News Captions)
            </h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#F20000] mt-1 mr-2 flex-shrink-0" />
                <span><strong>250–350 Words:</strong> Never less than 250, never exceeding 350 words.</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#F20000] mt-1 mr-2 flex-shrink-0" />
                <span><strong>Exactly Five Paragraphs:</strong> Formatted with double line breaks for mobile scanning.</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#F20000] mt-1 mr-2 flex-shrink-0" />
                <span><strong>Paragraph Structure:</strong> P1: News event • P2: Macro context • P3: REALTOR implications • P4: Industry analysis • P5: Strategic takeaway.</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#F20000] mt-1 mr-2 flex-shrink-0" />
                <span><strong>Exactly 10 Hashtags:</strong> With <code>#realtyPRESS</code> as the mandatory first tag.</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#F20000] mt-1 mr-2 flex-shrink-0" />
                <span><strong>Canadian English:</strong> Enforce Canadian spelling (e.g., colour, metres, centres, labour).</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#F20000] mt-1 mr-2 flex-shrink-0" />
                <span><strong>Fact vs Implication:</strong> Explicitly separate verified historical metrics from forward-looking opinions.</span>
              </li>
            </ul>
          </div>

          {/* Visual Rules */}
          <div className="space-y-3">
            <h3 className="font-bold text-[#F20000] uppercase text-[11px]">
              V8 Visual Identity Rules
            </h3>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#242626] dark:bg-gray-400 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Ultra-Realistic Photography:</strong> High-contrast architectural, crane, and urban photography.</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#242626] dark:bg-gray-400 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Full-Bleed Composition:</strong> Photography fills the entire 4:5 or 9:16 frame with zero borders.</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#242626] dark:bg-gray-400 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Black Gradient at Bottom:</strong> Dark gradient across lower 35-40% to ensure pristine text legibility.</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#242626] dark:bg-gray-400 mt-1 mr-2 flex-shrink-0" />
                <span><strong>One Uppercase Headline Only:</strong> Poppins Black with selected key words highlighted in <code>#F20000</code>.</span>
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 rounded-full bg-[#242626] dark:bg-gray-400 mt-1 mr-2 flex-shrink-0" />
                <span><strong>Zero Clutter:</strong> NO logo, NO watermark, NO dates, NO website URLs, NO decorative emojis on graphics.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 13 EDITORIAL THEMES & STRATEGY PILLARS */}
      <div className="p-5 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center">
          <Layers className="w-4 h-4 text-[#F20000] mr-1.5" />
          The 13 90-Day Strategy Editorial Themes
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {EDITORIAL_THEMES.map((theme, i) => (
            <div
              key={theme}
              className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/80 space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-gray-400 font-bold">Theme {i + 1}</span>
                <span className="text-[9px] bg-red-100 dark:bg-red-950/60 text-[#F20000] font-bold px-1.5 py-0.2 rounded">
                  Active
                </span>
              </div>
              <h4 className="font-bold text-gray-900 dark:text-gray-100">{theme}</h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Strategic content pillar designed to drive organic shares and discussion among Canadian REALTORS®.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* COPYABLE NANO BANANA PROMPT TEMPLATE */}
      <div className="p-5 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center">
            <Sparkles className="w-4 h-4 text-[#F20000] mr-1.5" />
            Standard Nano Banana Master Prompt Template
          </h3>
          <button
            onClick={() =>
              copyText(
                'Ultra-realistic editorial photo of modern Canadian high-rise residential construction crane in downtown Toronto at golden hour, dusk lighting, glass reflections, architectural realism, full-bleed photography, heavy black gradient at the bottom 35 percent for editorial text overlay, Poppins Black typography, no watermark, no logos, 35mm lens, f/2.8, cinematic real estate news photograph, 4:5 aspect ratio',
                'master-prompt'
              )
            }
            className="flex items-center space-x-1 text-xs text-[#F20000] font-bold hover:underline"
          >
            {copiedKey === 'master-prompt' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedKey === 'master-prompt' ? 'Copied' : 'Copy Template'}</span>
          </button>
        </div>
        <textarea
          readOnly
          rows={3}
          value="Ultra-realistic editorial photo of modern Canadian high-rise residential construction crane in downtown Toronto at golden hour, dusk lighting, glass reflections, architectural realism, full-bleed photography, heavy black gradient at the bottom 35 percent for editorial text overlay, Poppins Black typography, no watermark, no logos, 35mm lens, f/2.8, cinematic real estate news photograph, 4:5 aspect ratio"
          className="w-full p-3 bg-gray-50 dark:bg-gray-800 border rounded-lg text-xs font-mono text-gray-800 dark:text-gray-200 leading-relaxed"
        />
      </div>
    </div>
  );
};
