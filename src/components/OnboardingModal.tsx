import React from 'react';
import {
  Sparkles,
  Radar,
  ShieldCheck,
  Calendar,
  TrendingUp,
  CheckCircle2,
  X,
  ArrowRight
} from 'lucide-react';

interface OnboardingModalProps {
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onClose }) => {
  const steps = [
    {
      icon: Radar,
      title: '1. Genuine Canadian News Radar',
      desc: 'Fetch live Canadian real estate RSS feeds (Bank of Canada, CREA, CMHC, OSFI, StatCan, RECO, BCFSA) with duplicate and 30-day freshness screening.'
    },
    {
      icon: ShieldCheck,
      title: '2. Evidence-Based Fact-Checking & V8 Studio',
      desc: 'Verify claims with source URLs and excerpts, complete the 10-point editorial checklist, and validate 250–350 word 5-paragraph captions.'
    },
    {
      icon: Calendar,
      title: '3. IANA Dual-Timezone Calendar',
      desc: 'Schedule across Month, Week, Day, and List views with automatic DST-aware America/Toronto to Asia/Colombo conversion.'
    },
    {
      icon: TrendingUp,
      title: '4. Clean Production Mode & Zero-Cost Guardrails',
      desc: 'Starts clean in Production Mode (with optional isolated Demo Mode) and locks to free-tier Gemini (gemini-3.8-flash) for $0 API cost.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden">
        <div className="bg-[#242626] p-6 text-white flex items-start justify-between gap-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#F20000] flex items-center justify-center font-['Poppins'] font-bold text-xl shadow-xs">
              R
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#F20000]">
                Canadian Real Estate Media CMS
              </span>
              <h2 className="text-xl font-bold font-['Poppins'] mt-0.5">
                Welcome to realtyPRESS AI Media Studio
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            Your workspace starts in <strong>Clean Production Mode</strong>—no fake news or sample analytics are mixed into your live database. You can toggle <strong>Demo Mode</strong> anytime from the top bar or Settings to inspect sample workflows.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/70 border border-gray-200 dark:border-gray-800 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[#F20000]" />
                    <h3 className="text-xs font-bold font-['Poppins'] text-[#242626] dark:text-white">
                      {s.title}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Zero-Cost Guardrails Active • Free-Tier Gemini (gemini-3.8-flash) • Transactional Local Storage Ready
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              Enter Editorial Command Centre
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
