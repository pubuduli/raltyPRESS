import React from 'react';
import {
  LayoutDashboard,
  Radar,
  FileText,
  Sparkles,
  Image,
  Video,
  Calendar,
  CheckCircle2,
  Library,
  BarChart3,
  BookmarkCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame,
  FlaskConical
} from 'lucide-react';
import type { AppSettings } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  pendingApprovalsCount: number;
  settings?: AppSettings | null;
}

export const NAV_ITEMS = [
  { id: 'Command Centre', label: 'Command Centre', icon: LayoutDashboard },
  { id: 'News Radar', label: 'News Radar', icon: Radar },
  { id: 'Story Manager', label: 'Story Manager', icon: FileText },
  { id: 'AI Content Studio', label: 'AI Content Studio', icon: Sparkles, highlight: true },
  { id: 'Visual Studio', label: 'Visual Studio', icon: Image },
  { id: 'Reel Studio', label: 'Reel Studio', icon: Video },
  { id: 'Content Calendar', label: 'Content Calendar', icon: Calendar },
  { id: 'Approval Centre', label: 'Approval Centre', icon: CheckCircle2, showBadge: true },
  { id: 'Published Library', label: 'Published Library', icon: Library },
  { id: 'Analytics & Growth', label: 'Analytics & Growth', icon: BarChart3 },
  { id: 'Brand Library', label: 'Brand Library', icon: BookmarkCheck },
  { id: 'Settings', label: 'Settings', icon: Settings }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  pendingApprovalsCount,
  settings
}) => {
  const currentFollowers = settings?.currentFollowers ?? settings?.initialFollowers ?? 0;
  const targetFollowers = settings?.followerTarget90Day || 10000;
  const pct = targetFollowers > 0 ? Math.min(100, Math.max(0, (currentFollowers / targetFollowers) * 100)) : 0;

  return (
    <aside
      className={`relative z-40 flex flex-col justify-between bg-[#242626] text-white border-r border-gray-800 transition-all duration-300 flex-shrink-0 ${
        collapsed
          ? 'hidden md:flex md:w-16'
          : 'fixed inset-y-0 left-0 md:relative w-64 shadow-2xl md:shadow-none'
      }`}
    >
      {/* Brand Header */}
      <div>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#F20000] flex items-center justify-center font-black tracking-tighter text-white shadow-md">
              <span className="text-sm font-['Poppins']">rP</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-['Poppins'] font-extrabold text-base tracking-tight text-white leading-none">
                  realty<span className="text-[#F20000]">PRESS</span>
                </span>
                <span className="text-[9px] tracking-wider text-gray-400 uppercase font-semibold mt-0.5">
                  AI Media Studio
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-150px)]">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setCollapsed(true);
                  }
                }}
                className={`relative group flex items-center w-full px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#F20000] text-white shadow-sm font-semibold'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/80'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    isActive
                      ? 'text-white'
                      : item.highlight
                      ? 'text-[#F20000]'
                      : 'text-gray-400 group-hover:text-gray-200'
                  }`}
                />
                {!collapsed && <span className="ml-3 truncate flex-1 text-left">{item.label}</span>}

                {/* Approval Badge */}
                {!collapsed && item.showBadge && pendingApprovalsCount > 0 && (
                  <span
                    className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white text-[#F20000]' : 'bg-[#F20000] text-white'
                    }`}
                  >
                    {pendingApprovalsCount}
                  </span>
                )}

                {collapsed && isActive && (
                  <div className="absolute right-0 top-2 bottom-2 w-1 bg-[#F20000] rounded-l" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer: Dynamic Audience Target Tracker */}
      <div className="p-3 border-t border-gray-800 bg-[#1C1E1E]">
        {!collapsed ? (
          <div className="px-2.5 py-2 bg-black/30 rounded-lg border border-gray-800/80">
            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300">
              <span className="flex items-center">
                {settings?.demoMode ? (
                  <FlaskConical className="w-3.5 h-3.5 text-amber-400 mr-1" />
                ) : (
                  <Flame className="w-3.5 h-3.5 text-[#F20000] mr-1" />
                )}
                {settings?.demoMode ? 'Demo Mode' : 'Growth Target'}
              </span>
              <span className="text-[#F20000] font-bold font-mono">{pct.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 h-1 rounded-full mt-2 overflow-hidden">
              <div className="bg-[#F20000] h-full rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-gray-400 mt-1 font-mono">
              <span>{currentFollowers.toLocaleString()} current</span>
              <span>{targetFollowers.toLocaleString()} goal</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Growth Target Tracker">
            <Flame className="w-5 h-5 text-[#F20000]" />
          </div>
        )}
      </div>
    </aside>
  );
};
