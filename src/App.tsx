/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  db,
  initializeDatabase,
  getActiveSettings,
  enableDemoMode,
  disableDemoMode,
  getOperationalStories,
  getOperationalApprovals
} from './db';
import { Story, ContentDraft, AppSettings } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CommandCentre } from './components/CommandCentre';
import { NewsRadar } from './components/NewsRadar';
import { StoryManager } from './components/StoryManager';
import { AiContentStudio } from './components/AiContentStudio';
import { VisualStudio } from './components/VisualStudio';
import { ReelStudio } from './components/ReelStudio';
import { ContentCalendar } from './components/ContentCalendar';
import { ApprovalCentre } from './components/ApprovalCentre';
import { PublishedLibrary } from './components/PublishedLibrary';
import { AnalyticsGrowth } from './components/AnalyticsGrowth';
import { BrandLibrary } from './components/BrandLibrary';
import { Settings } from './components/Settings';
import { OnboardingModal } from './components/OnboardingModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('Command Centre');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Story[]>([]);

  const [isReady, setIsReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Cross-module workflow state
  const [selectedStoryForStudio, setSelectedStoryForStudio] = useState<Story | null>(null);
  const [repurposedDraftForStudio, setRepurposedDraftForStudio] = useState<ContentDraft | null>(null);
  const [selectedDraftForVisual, setSelectedDraftForVisual] = useState<ContentDraft | null>(null);

  const refreshCounts = useCallback(async () => {
    const s = await getActiveSettings();
    const isDemo = Boolean(s?.demoMode);
    if (s) {
      setSettings(s);
    }
    const allApprovals = await getOperationalApprovals(isDemo);
    const pending = allApprovals.filter(a => a.status === 'Pending').length;
    setPendingApprovalsCount(pending);
  }, []);

  useEffect(() => {
    async function boot() {
      await initializeDatabase();
      const s = await getActiveSettings();
      if (s && !s.hasCompletedOnboarding) {
        setShowOnboarding(true);
      }
      await refreshCounts();
      setIsReady(true);
    }
    boot();
  }, [refreshCounts]);

  useEffect(() => {
    refreshCounts();
  }, [activeTab, refreshTrigger, refreshCounts]);

  useEffect(() => {
    if (!globalSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const q = globalSearch.toLowerCase();
    getOperationalStories(Boolean(settings?.demoMode)).then(all => {
      setSearchResults(
        all
          .filter(
            s =>
              (s.proposedHeadline || s.originalHeadline).toLowerCase().includes(q) ||
              s.category.toLowerCase().includes(q) ||
              s.province.toLowerCase().includes(q)
          )
          .slice(0, 5)
      );
    });
  }, [globalSearch, settings?.demoMode]);

  const handleCloseOnboarding = async () => {
    setShowOnboarding(false);
    const s = await getActiveSettings();
    if (s) {
      await db.settings.put({
        key: 'app_settings',
        value: { ...s, hasCompletedOnboarding: true }
      });
    }
    await refreshCounts();
  };

  const handleSelectStoryForStudio = (story: Story) => {
    setSelectedStoryForStudio(story);
    setRepurposedDraftForStudio(null);
    setActiveTab('AI Content Studio');
  };

  const handleRepurposeToDraft = (draft: ContentDraft) => {
    setRepurposedDraftForStudio(draft);
    setSelectedStoryForStudio(null);
    setActiveTab('AI Content Studio');
  };

  const handleNavigateToVisualStudio = (draft: ContentDraft) => {
    setSelectedDraftForVisual(draft);
    setActiveTab('Visual Studio');
  };

  const handleToggleDemoMode = async () => {
    if (settings?.demoMode) {
      await disableDemoMode();
    } else {
      await enableDemoMode();
    }
    setRefreshTrigger(prev => prev + 1);
    await refreshCounts();
  };

  const handleTriggerRefresh = async () => {
    setRefreshTrigger(prev => prev + 1);
    await refreshCounts();
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#17191B] text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F20000] flex items-center justify-center font-bold font-['Poppins']">
            R
          </div>
          <span className="text-sm font-semibold tracking-wide">
            Initializing realtyPRESS AI Media Studio...
          </span>
        </div>
      </div>
    );
  }

  const demoMode = Boolean(settings?.demoMode);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-[#F5F6F7] dark:bg-[#17191B] text-[#242626] dark:text-gray-100 flex font-['Inter'] transition-colors">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          pendingApprovalsCount={pendingApprovalsCount}
          settings={settings}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
            openNewStoryModal={() => setActiveTab('Story Manager')}
            collapsedSidebar={sidebarCollapsed}
            setCollapsedSidebar={setSidebarCollapsed}
            demoMode={demoMode}
            onToggleDemoMode={handleToggleDemoMode}
          />

          {/* Quick Global Search Dropdown */}
          {globalSearch.trim() !== '' && searchResults.length > 0 && (
            <div className="mx-4 lg:mx-6 mt-2 p-3 rounded-xl bg-white dark:bg-[#1E2022] border border-gray-200 dark:border-gray-800 shadow-lg z-20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase text-gray-400">
                  Global Story Search Matches ({searchResults.length})
                </span>
                <button
                  onClick={() => setGlobalSearch('')}
                  className="text-xs text-[#F20000] font-semibold"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1.5">
                {searchResults.map(res => (
                  <div
                    key={res.id}
                    onClick={() => {
                      handleSelectStoryForStudio(res);
                      setGlobalSearch('');
                    }}
                    className="p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-[#242626] dark:text-white">
                      {res.proposedHeadline || res.originalHeadline}
                    </span>
                    <span className="text-[11px] text-[#F20000] font-medium">
                      {res.province} • Open in Studio &rarr;
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
            {activeTab === 'Command Centre' && (
              <CommandCentre
                key={refreshTrigger}
                setActiveTab={setActiveTab}
                openNewStoryModal={() => setActiveTab('Story Manager')}
                demoMode={demoMode}
                onSettingsChanged={handleTriggerRefresh}
              />
            )}
            {activeTab === 'News Radar' && (
              <NewsRadar
                key={refreshTrigger}
                onSelectStoryForStudio={handleSelectStoryForStudio}
                demoMode={demoMode}
              />
            )}
            {activeTab === 'Story Manager' && (
              <StoryManager
                key={refreshTrigger}
                onSelectStoryForStudio={handleSelectStoryForStudio}
                demoMode={demoMode}
              />
            )}
            {activeTab === 'AI Content Studio' && (
              <AiContentStudio
                key={refreshTrigger}
                selectedStoryProp={selectedStoryForStudio}
                repurposedDraftProp={repurposedDraftForStudio}
                onNavigateToVisualStudio={handleNavigateToVisualStudio}
                demoMode={demoMode}
              />
            )}
            {activeTab === 'Visual Studio' && (
              <VisualStudio
                key={refreshTrigger}
                selectedDraftProp={selectedDraftForVisual}
                demoMode={demoMode}
              />
            )}
            {activeTab === 'Reel Studio' && (
              <ReelStudio key={refreshTrigger} demoMode={demoMode} />
            )}
            {activeTab === 'Content Calendar' && (
              <ContentCalendar key={refreshTrigger} demoMode={demoMode} />
            )}
            {activeTab === 'Approval Centre' && (
              <ApprovalCentre key={refreshTrigger} demoMode={demoMode} />
            )}
            {activeTab === 'Published Library' && (
              <PublishedLibrary
                key={refreshTrigger}
                onRepurposeToDraft={handleRepurposeToDraft}
                demoMode={demoMode}
              />
            )}
            {activeTab === 'Analytics & Growth' && (
              <AnalyticsGrowth
                key={refreshTrigger}
                demoMode={demoMode}
                onSettingsChanged={handleTriggerRefresh}
              />
            )}
            {activeTab === 'Brand Library' && <BrandLibrary />}
            {activeTab === 'Settings' && (
              <Settings key={refreshTrigger} onDataReset={handleTriggerRefresh} />
            )}
          </main>
        </div>

        {showOnboarding && <OnboardingModal onClose={handleCloseOnboarding} />}
      </div>
    </div>
  );
}
