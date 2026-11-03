import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Download,
  Plus,
  Users,
  Eye,
  BarChart3,
  Award,
  X,
  Upload,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  db,
  getActiveSettings,
  getOperationalAnalytics,
  getOperationalPublished,
  convertToCsv
} from '../db';
import { AnalyticsRecord, PublishedPost, AppSettings } from '../types';
import { calculateEngagementRate } from '../utils/analytics';

interface AnalyticsGrowthProps {
  demoMode?: boolean;
  onSettingsChanged?: () => void;
}

export const AnalyticsGrowth: React.FC<AnalyticsGrowthProps> = ({
  demoMode = false,
  onSettingsChanged
}) => {
  const [snapshots, setSnapshots] = useState<AnalyticsRecord[]>([]);
  const [published, setPublished] = useState<PublishedPost[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Manual KPI log form
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [followers, setFollowers] = useState(0);
  const [reach, setReach] = useState(0);
  const [views, setViews] = useState(0);
  const [reactions, setReactions] = useState(0);
  const [comments, setComments] = useState(0);
  const [shares, setShares] = useState(0);

  const loadData = useCallback(async () => {
    const [allSnaps, allPub, currentSettings] = await Promise.all([
      getOperationalAnalytics(demoMode),
      getOperationalPublished(demoMode),
      getActiveSettings()
    ]);
    setSnapshots(allSnaps);
    setPublished(allPub);
    if (currentSettings) {
      setSettings(currentSettings);
      setFollowers(currentSettings.currentFollowers);
    }
  }, [demoMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExportCsv = () => {
    const csv = convertToCsv(snapshots);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `realtypress-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    const prevFollowers =
      snapshots.length > 0
        ? snapshots[snapshots.length - 1].followers
        : settings?.initialFollowers || 0;
    const netFollowers = followers - prevFollowers;

    const newSnap: AnalyticsRecord = {
      date,
      platform: 'Facebook',
      followers,
      netFollowers,
      reach,
      views,
      reactions,
      comments,
      shares,
      pageVisits: Math.round(reach * 0.08),
      followerConversions: Math.max(0, netFollowers),
      reportingPeriod: settings?.reportingPeriod || '90-Day Organic Growth Sprint',
      dataSource: 'Manual Entry',
      importedAt: new Date().toISOString(),
      isSampleData: false
    };

    await db.analyticsRecords.put(newSnap);
    if (settings) {
      const updatedSettings: AppSettings = {
        ...settings,
        currentFollowers: followers
      };
      await db.settings.put({ key: 'app_settings', value: updatedSettings });
      if (onSettingsChanged) onSettingsChanged();
    }
    setShowLogModal(false);
    await loadData();
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const newRecords: AnalyticsRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const rowObj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cols[idx] || '';
      });

      const rowDate = rowObj.date || new Date().toISOString().split('T')[0];
      const rowFollowers = Number(rowObj.followers || 0);
      const rowReach = Number(rowObj.reach || 0);
      const rowViews = Number(rowObj.views || 0);

      newRecords.push({
        date: rowDate,
        platform: (rowObj.platform as any) || 'Facebook',
        followers: rowFollowers,
        netFollowers: Number(rowObj.netfollowers || rowObj.netgrowth || 0),
        reach: rowReach,
        views: rowViews,
        reactions: Number(rowObj.reactions || rowObj.likes || 0),
        comments: Number(rowObj.comments || 0),
        shares: Number(rowObj.shares || 0),
        pageVisits: Number(rowObj.pagevisits || 0),
        followerConversions: Number(rowObj.followerconversions || 0),
        reportingPeriod: settings?.reportingPeriod || 'CSV Imported Period',
        dataSource: 'CSV Import',
        importedAt: new Date().toISOString(),
        isSampleData: false
      });
    }

    if (newRecords.length > 0) {
      await db.analyticsRecords.bulkPut(newRecords);
      const latest = newRecords[newRecords.length - 1];
      if (latest.followers > 0 && settings) {
        const updatedSettings: AppSettings = {
          ...settings,
          currentFollowers: latest.followers
        };
        await db.settings.put({ key: 'app_settings', value: updatedSettings });
        if (onSettingsChanged) onSettingsChanged();
      }
      setImportNotice(`Imported ${newRecords.length} analytics snapshot(s) from CSV!`);
      setTimeout(() => setImportNotice(null), 4000);
      await loadData();
    }
    e.target.value = '';
  };

  const initialFollowers = settings?.initialFollowers ?? 0;
  const targetFollowers = settings?.followerTarget90Day ?? 10000;
  const latestFollowers =
    snapshots.length > 0
      ? snapshots[snapshots.length - 1].followers
      : settings?.currentFollowers ?? initialFollowers;
  const totalNetGrowth = latestFollowers - initialFollowers;
  const progressPercent =
    targetFollowers > 0 ? Math.min(100, Number(((latestFollowers / targetFollowers) * 100).toFixed(1))) : 0;
  const totalReach = snapshots.reduce((sum, s) => sum + (s.reach || 0), 0);
  const totalViews = snapshots.reduce((sum, s) => sum + (s.views || 0), 0);
  const totalReactions = snapshots.reduce((sum, s) => sum + (s.reactions || 0), 0);
  const totalComments = snapshots.reduce((sum, s) => sum + (s.comments || 0), 0);
  const totalShares = snapshots.reduce((sum, s) => sum + (s.shares || 0), 0);
  const avgEngagement = calculateEngagementRate(totalReactions, totalComments, totalShares, totalReach);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#F20000]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#F20000]">
              90-Day Organic Audience Growth Tracker ($0 Ad Spend)
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
            Analytics & Audience Growth Intelligence
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Track real organic follower growth, import social media CSV exports, and analyze top-performing Canadian real estate formats.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 cursor-pointer">
            <Upload className="w-4 h-4 text-[#F20000]" />
            Import CSV
            <input type="file" accept=".csv" onChange={handleCsvImport} className="hidden" />
          </label>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log Weekly KPI Snapshot
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{importNotice}</span>
        </div>
      )}

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1E2022] rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-400">Current Followers</span>
            <Users className="w-4 h-4 text-[#F20000]" />
          </div>
          <p className="text-2xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-2">
            {latestFollowers.toLocaleString()}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            {totalNetGrowth >= 0 ? `+${totalNetGrowth}` : totalNetGrowth} net change ({progressPercent}% of{' '}
            {targetFollowers.toLocaleString()} goal)
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E2022] rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-400">Cumulative Page Reach</span>
            <Eye className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-2">
            {totalReach.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">100% Organic Distribution ($0 Paid Ads)</p>
        </div>

        <div className="bg-white dark:bg-[#1E2022] rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-400">Cumulative Views</span>
            <BarChart3 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-2">
            {totalViews.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1">Reels + Carousels + Feed Posts</p>
        </div>

        <div className="bg-white dark:bg-[#1E2022] rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-gray-400">Avg Engagement Rate</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-2">
            {avgEngagement}%
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            {snapshots.length} recorded snapshot(s)
          </p>
        </div>
      </div>

      {/* Charts or Empty State */}
      {snapshots.length === 0 ? (
        <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-10 text-center space-y-3">
          <BarChart3 className="w-8 h-8 text-gray-400 mx-auto" />
          <h3 className="text-base font-bold text-[#242626] dark:text-white">
            No Analytics Snapshots Recorded Yet
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Click "Log Weekly KPI Snapshot" or "Import CSV" above to record your real Facebook/Instagram/LinkedIn metrics, or enable Demo Mode in the top bar to preview sample charts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#1E2022] rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
            <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white mb-1">
              Follower Trajectory vs 90-Day Target ({targetFollowers.toLocaleString()})
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Recorded follower count across logged snapshots
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snapshots}>
                  <defs>
                    <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F20000" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#F20000" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#242626',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="followers"
                    stroke="#F20000"
                    strokeWidth={2.5}
                    fill="url(#growthGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E2022] rounded-xl p-5 border border-gray-200 dark:border-gray-800 shadow-xs">
            <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white mb-1">
              Organic Reach & Content Views
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Comparison of total page reach and video/post views
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshots}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#242626',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="reach" fill="#242626" radius={[4, 4, 0, 0]} name="Organic Reach" />
                  <Bar dataKey="views" fill="#F20000" radius={[4, 4, 0, 0]} name="Content Views" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Recorded Top Posts vs Strategic Recommendations */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white">
            Recorded Post Performance vs Editorial Growth Recommendations
          </h3>
          <span className="text-[11px] font-semibold text-gray-400">
            Data Source Clearly Separated from Recommendations
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <span className="text-[10px] font-bold uppercase text-[#F20000]">
              Recorded Top Format ({published.length} Posts)
            </span>
            <h4 className="text-sm font-bold text-[#242626] dark:text-white mt-1">
              {published.length > 0 ? published[0].format : 'No Published Posts Yet'}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {published.length > 0
                ? `"${published[0].title}" — ${published[0].reach.toLocaleString()} reach, ${calculateEngagementRate(
                    published[0].reactions,
                    published[0].comments,
                    published[0].shares,
                    published[0].reach
                  )}% engagement.`
                : 'Log published posts in Published Library to see your real top-performing format.'}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <span className="text-[10px] font-bold uppercase text-blue-600">
              Editorial Strategy Recommendation
            </span>
            <h4 className="text-sm font-bold text-[#242626] dark:text-white mt-1">
              Bank of Canada & CREA MLS® Data Carousels
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Recommendation: Publish 6-slide data carousels within 4 hours of Bank of Canada or CREA releases to maximize REALTOR® saves and shares.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
            <span className="text-[10px] font-bold uppercase text-emerald-600">
              Optimal Canadian Posting Windows (Recommendation)
            </span>
            <h4 className="text-sm font-bold text-[#242626] dark:text-white mt-1">
              08:30 – 09:30 AM & 12:00 PM America/Toronto
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Recommendation: Aligns with morning brokerage briefings in Ontario/Quebec and early morning check-ins in BC/Alberta.
            </p>
          </div>
        </div>
      </div>

      {/* Log Snapshot Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold font-['Poppins'] text-[#242626] dark:text-white">
                Log Weekly Audience KPI Snapshot
              </h3>
              <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLogSnapshot} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Snapshot Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Total Followers
                </label>
                <input
                  type="number"
                  value={followers}
                  onChange={e => setFollowers(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Weekly Page Reach
                  </label>
                  <input
                    type="number"
                    value={reach}
                    onChange={e => setReach(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Weekly Content Views
                  </label>
                  <input
                    type="number"
                    value={views}
                    onChange={e => setViews(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Reactions
                  </label>
                  <input
                    type="number"
                    value={reactions}
                    onChange={e => setReactions(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Comments
                  </label>
                  <input
                    type="number"
                    value={comments}
                    onChange={e => setComments(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Shares
                  </label>
                  <input
                    type="number"
                    value={shares}
                    onChange={e => setShares(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold"
                >
                  Save Snapshot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
