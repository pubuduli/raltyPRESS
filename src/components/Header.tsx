import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Clock,
  Sparkles,
  PlusCircle,
  Moon,
  Sun,
  CheckCircle,
  AlertTriangle,
  X,
  Menu,
  FlaskConical
} from 'lucide-react';
import type { ApprovalItem } from '../types';
import { getOperationalApprovals } from '../db';

interface HeaderProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  globalSearch: string;
  setGlobalSearch: (search: string) => void;
  openNewStoryModal: () => void;
  collapsedSidebar?: boolean;
  setCollapsedSidebar?: (val: boolean) => void;
  demoMode?: boolean;
  onToggleDemoMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  darkMode,
  setDarkMode,
  setActiveTab,
  globalSearch,
  setGlobalSearch,
  openNewStoryModal,
  collapsedSidebar,
  setCollapsedSidebar,
  demoMode = false,
  onToggleDemoMode
}) => {
  const [torontoTime, setTorontoTime] = useState('');
  const [colomboTime, setColomboTime] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalItem[]>([]);
  const [aiStatus, setAiStatus] = useState<{
    online: boolean;
    model: string;
    operatingMode: string;
    remainingQuota?: number;
  }>({
    online: false,
    model: 'gemini-3.8-flash',
    operatingMode: 'Checking...'
  });

  // Dual Clocks using IANA timezones (America/Toronto and Asia/Colombo)
  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      const tzParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Toronto',
        timeZoneName: 'short'
      }).formatToParts(now);
      const etAbbrev = tzParts.find(p => p.type === 'timeZoneName')?.value || 'ET';

      setTorontoTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'America/Toronto',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) + ` ${etAbbrev}`
      );
      setColomboTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Colombo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) + ' LK'
      );
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch approvals for notification badge respecting Demo Mode
  useEffect(() => {
    const loadPending = async () => {
      const items = await getOperationalApprovals(demoMode);
      setPendingApprovals(items.filter(a => a.status === 'Pending'));
    };
    loadPending();
  }, [demoMode]);

  // Check server AI status
  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        setAiStatus({
          online: data.status === 'online' && data.hasApiKey,
          model: data.defaultModel || 'gemini-3.8-flash',
          operatingMode: data.operatingMode || 'Manual Mode',
          remainingQuota: data.dailyRequestsRemaining
        });
      })
      .catch(() => {
        setAiStatus({
          online: false,
          model: 'gemini-3.8-flash',
          operatingMode: 'Manual Mode (Offline)'
        });
      });
  }, []);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-white dark:bg-[#1E2022] border-b border-gray-200 dark:border-gray-800 transition-colors">
      {/* Search Bar + Mobile Menu Toggle */}
      <div className="flex items-center flex-1 max-w-md space-x-2">
        {setCollapsedSidebar && (
          <button
            onClick={() => setCollapsedSidebar(!collapsedSidebar)}
            className="p-1.5 -ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg md:hidden"
            title="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Global search stories, headlines, drafts, sources..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm bg-gray-100 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 placeholder-gray-400 rounded-lg border border-transparent focus:border-[#F20000] focus:bg-white dark:focus:bg-[#17191B] focus:outline-none transition-all"
          />
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Clocks, Demo Indicator, Actions & Status */}
      <div className="flex items-center space-x-2.5 md:space-x-3.5">
        {/* Obvious Demo Mode Indicator whenever Demo Mode is active */}
        {demoMode && (
          <button
            onClick={onToggleDemoMode}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 transition-colors"
            title="Demo Mode is active. Click to switch to Production Mode."
          >
            <FlaskConical className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>DEMO MODE</span>
          </button>
        )}

        {/* Dual Timezone Indicator (IANA America/Toronto & Asia/Colombo) */}
        <div className="hidden lg:flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs">
          <Clock className="w-3.5 h-3.5 text-[#F20000]" />
          <div className="flex items-center space-x-2 font-mono">
            <span className="text-gray-700 dark:text-gray-300 font-medium" title="America/Toronto (IANA Timezone)">
              {torontoTime || 'Toronto'}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="text-gray-500 dark:text-gray-400" title="Asia/Colombo (IANA Timezone)">
              {colomboTime || 'Colombo'}
            </span>
          </div>
        </div>

        {/* AI Engine Status Pill */}
        <button
          onClick={() => setActiveTab('Settings')}
          className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            aiStatus.online
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
              : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
          }`}
          title={aiStatus.operatingMode}
        >
          <Sparkles className="w-3 h-3 text-[#F20000]" />
          <span>
            {aiStatus.online ? `AI: ${aiStatus.model} (Free-Tier)` : 'AI: Manual Mode'}
          </span>
        </button>

        {/* Quick Action: New Story */}
        <button
          onClick={openNewStoryModal}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#F20000] hover:bg-[#d60000] text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Add Story</span>
        </button>

        {/* Notification Centre */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Editorial Notifications"
          >
            <Bell className="w-4 h-4" />
            {pendingApprovals.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#F20000] rounded-full" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1E2022] rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Editorial Notifications
                </span>
                <span className="text-xs bg-red-100 text-[#F20000] dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">
                  {pendingApprovals.length} Pending
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {pendingApprovals.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500">
                    All editorial approvals are clear.
                  </div>
                ) : (
                  pendingApprovals.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setActiveTab('Approval Centre');
                        setShowNotifications(false);
                      }}
                      className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start space-x-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Stage: {item.stage} • Awaiting Human Sign-Off
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 text-xs">
                <button
                  onClick={() => {
                    setActiveTab('Approval Centre');
                    setShowNotifications(false);
                  }}
                  className="w-full text-center text-[#F20000] font-semibold hover:underline flex items-center justify-center space-x-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Open Approval Centre</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Light / Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* User Profile Badge */}
        <div className="flex items-center space-x-2 pl-2 border-l border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 rounded-full bg-[#242626] text-white flex items-center justify-center font-bold text-xs border border-gray-700">
            RP
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-none">
              Editorial Desk
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              {demoMode ? 'Demo Workspace' : 'Production Mode'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
