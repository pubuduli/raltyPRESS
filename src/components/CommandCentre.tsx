import React, { useState, useEffect } from 'react';
import {
  Users,
  Target,
  TrendingUp,
  Eye,
  Activity,
  Flame,
  Clock,
  Video,
  Calendar,
  Share2,
  ChevronRight,
  Edit2,
  Info,
  FlaskConical,
  Sliders,
  Check
} from 'lucide-react';
import {
  db,
  getActiveSettings,
  getOperationalStories,
  getOperationalDrafts,
  getOperationalCalendar,
  getOperationalApprovals,
  getOperationalPublished,
  getOperationalAnalytics,
  enableDemoMode,
  disableDemoMode
} from '../db';
import type {
  Story,
  ContentDraft,
  CalendarEntry,
  ApprovalItem,
  PublishedPost,
  AnalyticsRecord,
  AppSettings
} from '../types';
import { calculateEngagementRate, calculateFollowerGrowthRate, calculateShareRate } from '../utils/analytics';
import { getTodayInToronto } from '../utils/timezone';

interface CommandCentreProps {
  setActiveTab: (tab: string) => void;
  openNewStoryModal: () => void;
  demoMode?: boolean;
  onSettingsChanged?: () => void;
}

export const CommandCentre: React.FC<CommandCentreProps> = ({
  setActiveTab,
  openNewStoryModal,
  demoMode = false,
  onSettingsChanged
}) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [calendar, setCalendar] = useState<CalendarEntry[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [published, setPublished] = useState<PublishedPost[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Business Profile Target & Follower Settings Modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [startingInput, setStartingInput] = useState('0');
  const [currentInput, setCurrentInput] = useState('0');
  const [targetInput, setTargetInput] = useState('10000');
  const [targetDateInput, setTargetDateInput] = useState('');
  const [reportingPeriodInput, setReportingPeriodInput] = useState('Last 30 Days');
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const loadData = async () => {
    const activeSet = await getActiveSettings();
    const isDemo = activeSet.demoMode;
    setSettings(activeSet);

    const [s, d, c, a, p, an] = await Promise.all([
      getOperationalStories(isDemo),
      getOperationalDrafts(isDemo),
      getOperationalCalendar(isDemo),
      getOperationalApprovals(isDemo),
      getOperationalPublished(isDemo),
      getOperationalAnalytics(isDemo)
    ]);

    const sortedAn = [...an].sort((x, y) => x.date.localeCompare(y.date));

    setStories(s);
    setDrafts(d);
    setCalendar(c);
    setApprovals(a);
    setPublished(p);
    setAnalytics(sortedAn);

    setStartingInput(String(activeSet.initialFollowers ?? 0));
    setCurrentInput(String(activeSet.currentFollowers ?? activeSet.initialFollowers ?? 0));
    setTargetInput(String(activeSet.followerTarget90Day || 10000));
    setTargetDateInput(activeSet.targetAchievementDate || '');
    setReportingPeriodInput(activeSet.reportingPeriod || 'Last 30 Days');
  };

  useEffect(() => {
    loadData();
  }, [demoMode]);

  const hasAnalyticsData = analytics.length > 0;
  const latestAnalytics = hasAnalyticsData ? analytics[analytics.length - 1] : null;
  const startingAnalytics = hasAnalyticsData ? analytics[0] : null;

  const startingFollowers = startingAnalytics
    ? startingAnalytics.followers
    : settings?.initialFollowers ?? 0;

  const currentFollowers = latestAnalytics
    ? latestAnalytics.followers
    : settings?.currentFollowers ?? settings?.initialFollowers ?? 0;

  const netFollowerGrowth = currentFollowers - startingFollowers;
  const followerGrowthRate = calculateFollowerGrowthRate(netFollowerGrowth, startingFollowers);

  const totalReach = analytics.reduce((acc, curr) => acc + (curr.reach || 0), 0);
  const totalViews = analytics.reduce((acc, curr) => acc + (curr.views || 0), 0);
  const totalReactions = analytics.reduce((acc, curr) => acc + (curr.reactions || 0), 0);
  const totalComments = analytics.reduce((acc, curr) => acc + (curr.comments || 0), 0);
  const totalShares = analytics.reduce((acc, curr) => acc + (curr.shares || 0), 0);

  const overallEngagementRate = calculateEngagementRate(totalReactions, totalComments, totalShares, totalReach);

  // Editorial Funnel counts from actual operational DB
  const discoveredCount = stories.filter(s => s.editorialStatus === 'Discovered' || s.editorialStatus === 'Research Pending').length;
  const verifiedCount = stories.filter(s => s.verificationStatus === 'Verified' && !s.isSampleData).length;
  const selectedCount = stories.filter(s => s.editorialStatus === 'Selected').length;
  const draftsCount = drafts.length;
  const pendingApprovalsCount = approvals.filter(a => a.status === 'Pending').length;
  const approvedCount = drafts.filter(d => d.status === 'Approved').length;
  const scheduledCount = calendar.filter(c => c.status === 'Scheduled').length;
  const publishedCount = published.length;

  const todayToronto = getTodayInToronto();
  const researchPendingCount = stories.filter(
    s => s.editorialStatus === 'Researching' || s.editorialStatus === 'Research Pending' || s.editorialStatus === 'Discovered'
  ).length;
  const creationPendingCount = stories.filter(
    s => s.editorialStatus === 'Selected' || s.editorialStatus === 'In Production'
  ).length;
  const visualsReviewCount = approvals.filter(
    a => a.contentType === 'Media Asset' && a.status === 'Pending'
  ).length;
  const editorialApprovalsCount = approvals.filter(a => a.status === 'Pending').length;
  const postsToPublishCount = calendar.filter(
    c => c.status === 'Scheduled' && c.scheduledDate <= todayToronto
  ).length;

  const weeklyScheduled = calendar.filter(c => c.status === 'Scheduled' || c.status === 'Approved').length;
  const upcomingReels = calendar.filter(c => c.format.toLowerCase().includes('reel')).length;
  const upcomingInfographics = calendar.filter(
    c => c.format.toLowerCase().includes('carousel') || c.format.toLowerCase().includes('infographic')
  ).length;

  const sortedPublished = [...published].sort((a, b) => b.reach - a.reach);
  const topFivePosts = sortedPublished.slice(0, 5);
  const bestReel = published.find(p => p.format.toLowerCase().includes('reel'));
  const mostShared = [...published].sort((a, b) => b.shares - a.shares)[0];
  const highestConversion = [...published].sort((a, b) => b.followerConversions - a.followerConversions)[0];

  const targetFollowers = settings?.followerTarget90Day || 10000;
  const progressPercent = targetFollowers > 0 ? Math.min(100, Math.max(0, (currentFollowers / targetFollowers) * 100)) : 0;

  const handleSaveBusinessProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    const updated: AppSettings = {
      ...settings,
      initialFollowers: Math.max(0, parseInt(startingInput, 10) || 0),
      currentFollowers: Math.max(0, parseInt(currentInput, 10) || 0),
      followerTarget90Day: Math.max(1, parseInt(targetInput, 10) || 10000),
      targetAchievementDate: targetDateInput || settings.targetAchievementDate,
      reportingPeriod: reportingPeriodInput || 'Last 30 Days'
    };

    await db.settings.put({ key: 'app_settings', value: updated });
    setSettings(updated);
    setShowProfileModal(false);
    setSavedBanner('✓ Business profile & audience targets updated (zero fabricated metrics).');
    setTimeout(() => setSavedBanner(null), 3500);
    if (onSettingsChanged) onSettingsChanged();
    await loadData();
  };

  const handleToggleDemo = async () => {
    if (settings?.demoMode) {
      await disableDemoMode();
    } else {
      await enableDemoMode();
    }
    if (onSettingsChanged) onSettingsChanged();
    await loadData();
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Demo Mode Warning Banner if Active */}
      {settings?.demoMode && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center space-x-2.5">
            <FlaskConical className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div>
              <strong>DEMO MODE ACTIVE:</strong> Displaying clearly isolated demonstration records. Sample stories and metrics are for workflow testing only and are never treated as verified real-world news.
            </div>
          </div>
          <button
            onClick={handleToggleDemo}
            className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-lg whitespace-nowrap transition-colors"
          >
            Exit Demo Mode →
          </button>
        </div>
      )}

      {savedBanner && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{savedBanner}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 text-[#F20000]">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-gray-900 dark:text-gray-100 font-heading">
              realtyPRESS Command Centre
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Canadian Real Estate News & Industry Insights • Reporting Period: {settings?.reportingPeriod || 'Last 30 Days'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[#F20000]" />
            <span>Edit Audience & Targets</span>
          </button>

          <button
            onClick={handleToggleDemo}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              settings?.demoMode
                ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
                : 'bg-white dark:bg-[#1E2022] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>{settings?.demoMode ? 'Disable Demo Mode' : 'Enable Demo Mode'}</span>
          </button>
        </div>
      </div>

      {/* SECTION A: AUDIENCE OVERVIEW */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            A. Audience Overview & Growth Targets ({settings?.demoMode ? 'Demo Dataset' : 'Production Data'})
          </h2>
          <div className="text-xs text-gray-400">
            Target Date: {settings?.targetAchievementDate || 'Not set'}
          </div>
        </div>

        {!hasAnalyticsData && currentFollowers === 0 && !settings?.demoMode ? (
          <div className="p-6 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm text-center space-y-3">
            <Users className="w-8 h-8 text-gray-400 mx-auto opacity-60" />
            <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No analytics data available.
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Connect or import your social media performance data in Analytics & Growth, or configure your starting and current follower counts.
            </p>
            <div className="flex items-center justify-center space-x-2 pt-1">
              <button
                onClick={() => setShowProfileModal(true)}
                className="px-3.5 py-1.5 bg-[#F20000] hover:bg-[#d60000] text-white text-xs font-bold rounded-lg"
              >
                Set Follower Baseline
              </button>
              <button
                onClick={() => setActiveTab('Analytics & Growth')}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-lg"
              >
                Import / Log Analytics →
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* 1. Current Followers */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#1E2022] border border-gray-200 dark:border-gray-800 shadow-sm relative group">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
                <span>Current Followers</span>
                <Users className="w-3.5 h-3.5 text-[#F20000]" />
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <div className="text-xl font-black font-heading text-gray-900 dark:text-gray-100">
                  {currentFollowers.toLocaleString()}
                </div>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  title="Edit follower counts"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
              <div className="text-[10px] text-gray-400 mt-1">Starting: {startingFollowers.toLocaleString()}</div>
            </div>

            {/* 2. Target */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#1E2022] border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
                <span>Target Followers</span>
                <Target className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <div className="text-xl font-black font-heading text-gray-900 dark:text-gray-100 mt-2">
                {targetFollowers.toLocaleString()}
              </div>
              <div className="text-[10px] text-blue-500 font-semibold mt-1">
                {progressPercent.toFixed(1)}% achieved
              </div>
            </div>

            {/* 3. Net Growth */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#1E2022] border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
                <span>Net Follower Growth</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xl font-black font-heading text-emerald-600 dark:text-emerald-400 mt-2">
                {netFollowerGrowth >= 0 ? `+${netFollowerGrowth}` : netFollowerGrowth}
              </div>
              <div className="text-[10px] text-emerald-500 font-semibold mt-1">
                {followerGrowthRate}% growth rate
              </div>
            </div>

            {/* 4. Page Reach */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#1E2022] border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
                <span>Recorded Reach</span>
                <Eye className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-xl font-black font-heading text-gray-900 dark:text-gray-100 mt-2">
                {hasAnalyticsData ? totalReach.toLocaleString() : '—'}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                {hasAnalyticsData ? `${analytics.length} recorded days` : 'No reach logged'}
              </div>
            </div>

            {/* 5. Content Views */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#1E2022] border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
                <span>Content Views</span>
                <Activity className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-xl font-black font-heading text-gray-900 dark:text-gray-100 mt-2">
                {hasAnalyticsData ? totalViews.toLocaleString() : '—'}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">
                {hasAnalyticsData ? 'Recorded views' : 'No views logged'}
              </div>
            </div>

            {/* 6. Engagement Rate */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#1E2022] border border-gray-200 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
                <span>Engagement Rate</span>
                <Share2 className="w-3.5 h-3.5 text-[#F20000]" />
              </div>
              <div className="text-xl font-black font-heading text-gray-900 dark:text-gray-100 mt-2">
                {hasAnalyticsData && totalReach > 0 ? `${overallEngagementRate}%` : '—'}
              </div>
              <div className="text-[10px] text-gray-400 mt-1">Formula: (R+C+S)/Reach</div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION B: EDITORIAL PRODUCTION FUNNEL */}
      <div className="p-5 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              B. Editorial Production Funnel
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Live lifecycle tracking from Canadian news discovery to human verification and publication
            </p>
          </div>
          <button
            onClick={() => setActiveTab('Story Manager')}
            className="text-xs text-[#F20000] font-semibold hover:underline flex items-center"
          >
            <span>Manage Stories</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { label: 'Discovered', count: discoveredCount, tab: 'News Radar', color: 'text-gray-700 dark:text-gray-300' },
            { label: 'Verified (Real)', count: verifiedCount, tab: 'Story Manager', color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Selected', count: selectedCount, tab: 'Story Manager', color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Drafts Created', count: draftsCount, tab: 'AI Content Studio', color: 'text-purple-600 dark:text-purple-400' },
            { label: 'Pending Approval', count: pendingApprovalsCount, tab: 'Approval Centre', color: 'text-[#F20000] font-bold' },
            { label: 'Approved', count: approvedCount, tab: 'Approval Centre', color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Scheduled', count: scheduledCount, tab: 'Content Calendar', color: 'text-amber-600 dark:text-amber-400' },
            { label: 'Published', count: publishedCount, tab: 'Published Library', color: 'text-teal-600 dark:text-teal-400' }
          ].map((col, idx) => (
            <div
              key={idx}
              onClick={() => setActiveTab(col.tab)}
              className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/60 hover:border-[#F20000] cursor-pointer transition-all text-center"
            >
              <div className={`text-2xl font-black font-heading ${col.color}`}>{col.count}</div>
              <div className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mt-1 truncate">
                {col.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION C & D: TODAY'S TASKS & WEEKLY PUBLISHING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center">
                <Clock className="w-3.5 h-3.5 text-[#F20000] mr-1.5" />
                C. Today's Editorial Tasks ({todayToronto})
              </h3>
            </div>

            <div className="space-y-2 mt-3">
              <div
                onClick={() => setActiveTab('News Radar')}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs"
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Canadian News Research Pending
                </span>
                <span className="font-mono font-bold text-gray-600 dark:text-gray-300">
                  {researchPendingCount} stories
                </span>
              </div>

              <div
                onClick={() => setActiveTab('AI Content Studio')}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs"
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Content Creation Pending
                </span>
                <span className="font-mono font-bold text-gray-600 dark:text-gray-300">
                  {creationPendingCount} selected
                </span>
              </div>

              <div
                onClick={() => setActiveTab('Visual Studio')}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs"
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Visuals Awaiting QA Review
                </span>
                <span className="font-mono font-bold text-gray-600 dark:text-gray-300">
                  {visualsReviewCount} assets
                </span>
              </div>

              <div
                onClick={() => setActiveTab('Approval Centre')}
                className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 hover:bg-red-50 cursor-pointer text-xs"
              >
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  Mandatory Editorial Approvals Gate
                </span>
                <span className="font-mono font-black text-[#F20000]">
                  {editorialApprovalsCount} pending
                </span>
              </div>

              <div
                onClick={() => setActiveTab('Content Calendar')}
                className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs"
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  Posts Scheduled for Today / Immediate Publishing
                </span>
                <span className="font-mono font-bold text-gray-600 dark:text-gray-300">
                  {postsToPublishCount} ready
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4 flex justify-end">
            <button
              onClick={openNewStoryModal}
              className="text-xs font-bold text-white bg-[#F20000] hover:bg-[#d60000] px-4 py-2 rounded-lg transition-colors"
            >
              + Discover New Story
            </button>
          </div>
        </div>

        {/* D. Weekly Publishing Overview */}
        <div className="p-5 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center">
                <Calendar className="w-3.5 h-3.5 text-blue-500 mr-1.5" />
                D. Weekly Publishing Cadence
              </h3>
              <span className="text-xs text-gray-400">Target: 5 Posts, 3 Reels, 2 Carousels</span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs text-gray-500 dark:text-gray-400">Scheduled Feed Posts</div>
                <div className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100 mt-1">
                  {weeklyScheduled} / 5
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-2">
                  <div
                    className="bg-[#F20000] h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (weeklyScheduled / 5) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs text-gray-500 dark:text-gray-400">Upcoming Reels (20-40s)</div>
                <div className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100 mt-1">
                  {upcomingReels} / 3
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-2">
                  <div
                    className="bg-purple-600 h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (upcomingReels / 3) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs text-gray-500 dark:text-gray-400">Infographics & Carousels</div>
                <div className="text-xl font-bold font-heading text-gray-900 dark:text-gray-100 mt-1">
                  {upcomingInfographics} / 2
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full mt-2">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (upcomingInfographics / 2) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60">
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Published to Date</div>
                <div className="text-xl font-bold font-heading text-emerald-600 dark:text-emerald-400 mt-1">
                  {publishedCount} items
                </div>
                <div className="text-[10px] text-gray-400 mt-2">Archived in Published Library</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 mt-4 flex justify-between items-center text-xs">
            <span className="text-gray-400">America/Toronto Publishing Window</span>
            <button
              onClick={() => setActiveTab('Content Calendar')}
              className="text-[#F20000] font-semibold hover:underline"
            >
              Open Editorial Calendar →
            </button>
          </div>
        </div>
      </div>

      {/* SECTION E: PUBLISHED CONTENT PERFORMANCE */}
      <div className="p-5 bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              E. Recorded Post Performance Leaders
            </h3>
            <p className="text-xs text-gray-400">
              Ranked exclusively from recorded items in Published Library
            </p>
          </div>
          <button
            onClick={() => setActiveTab('Published Library')}
            className="text-xs text-[#F20000] font-semibold hover:underline flex items-center"
          >
            <span>View Full Archive</span>
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        {published.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              No published content recorded yet.
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Once stories are verified, approved, and published, their real performance metrics will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60">
                <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 text-xs font-bold mb-2">
                  <Video className="w-4 h-4" />
                  <span>Best-Performing Reel</span>
                </div>
                {bestReel ? (
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
                      {bestReel.title}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 font-mono">
                      <span>Reach: {bestReel.reach.toLocaleString()}</span>
                      <span className="text-emerald-500 font-bold">+{bestReel.followerConversions} followers</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No Reel recorded yet.</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60">
                <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 text-xs font-bold mb-2">
                  <Share2 className="w-4 h-4" />
                  <span>Most Shared Story</span>
                </div>
                {mostShared ? (
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
                      {mostShared.title}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 font-mono">
                      <span>{mostShared.shares} Organic Shares</span>
                      <span className="text-blue-500">
                        {calculateShareRate(mostShared.shares, mostShared.reach)}% share rate
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No shares recorded.</p>
                )}
              </div>

              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-2">
                  <TrendingUp className="w-4 h-4" />
                  <span>Top Follower Converter</span>
                </div>
                {highestConversion ? (
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 line-clamp-2">
                      {highestConversion.title}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 font-mono">
                      <span>Category: {highestConversion.category}</span>
                      <span className="text-emerald-500 font-bold">
                        +{highestConversion.followerConversions} followers
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No conversion data recorded.</p>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-500 uppercase tracking-wider font-semibold border-y border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3">Headline</th>
                    <th className="py-2.5 px-3">Format</th>
                    <th className="py-2.5 px-3">Reach</th>
                    <th className="py-2.5 px-3">Reactions</th>
                    <th className="py-2.5 px-3">Shares</th>
                    <th className="py-2.5 px-3">Follower Gain</th>
                    <th className="py-2.5 px-3">Engagement</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {topFivePosts.map((post, i) => {
                    const eng = calculateEngagementRate(post.reactions, post.comments, post.shares, post.reach);
                    return (
                      <tr key={post.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40">
                        <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-gray-100 max-w-xs truncate">
                          {i + 1}. {post.title}
                        </td>
                        <td className="py-2.5 px-3 text-gray-500">{post.format}</td>
                        <td className="py-2.5 px-3 font-mono">{post.reach.toLocaleString()}</td>
                        <td className="py-2.5 px-3 font-mono">{post.reactions}</td>
                        <td className="py-2.5 px-3 font-mono text-blue-600 font-bold">{post.shares}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-600 font-bold">
                          +{post.followerConversions}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#F20000] font-bold">{eng}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* SECTION F: 90-DAY OBJECTIVE TRACKER */}
      <div className="p-6 bg-[#242626] text-white rounded-2xl shadow-md border border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-[#F20000] uppercase">
              F. Organic Audience Growth Objective Tracker
            </span>
            <h3 className="text-xl font-black font-heading mt-0.5">
              Target: {targetFollowers.toLocaleString()} Canadian Real Estate Followers
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Calculated from actual recorded follower counts and configured target date ({settings?.targetAchievementDate || '90 Days'}).
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-black font-heading text-[#F20000]">
              {currentFollowers.toLocaleString()} / {targetFollowers.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400 font-mono">
              {Math.max(0, targetFollowers - currentFollowers).toLocaleString()} followers remaining
            </div>
          </div>
        </div>

        <div className="w-full bg-gray-700 h-3 rounded-full overflow-hidden">
          <div
            className="bg-[#F20000] h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* EDITABLE BUSINESS PROFILE & TARGETS MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#1E2022] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4 text-xs">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 font-heading">
              Configure Business Profile & Audience Targets
            </h3>
            <form onSubmit={handleSaveBusinessProfile} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Starting Follower Count</label>
                  <input
                    type="number"
                    min="0"
                    value={startingInput}
                    onChange={e => setStartingInput(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Current Follower Count</label>
                  <input
                    type="number"
                    min="0"
                    value={currentInput}
                    onChange={e => setCurrentInput(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Target Follower Count</label>
                  <input
                    type="number"
                    min="1"
                    value={targetInput}
                    onChange={e => setTargetInput(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg font-mono text-[#F20000] font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Target Achievement Date</label>
                  <input
                    type="date"
                    value={targetDateInput}
                    onChange={e => setTargetDateInput(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Reporting Period</label>
                <select
                  value={reportingPeriodInput}
                  onChange={e => setReportingPeriodInput(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg"
                >
                  <option value="Last 7 Days">Last 7 Days</option>
                  <option value="Last 14 Days">Last 14 Days</option>
                  <option value="Last 30 Days">Last 30 Days</option>
                  <option value="90-Day Sprint">90-Day Sprint</option>
                  <option value="Year to Date">Year to Date</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#F20000] hover:bg-[#d60000] text-white font-bold rounded-lg shadow-sm"
                >
                  Save Profile Targets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
