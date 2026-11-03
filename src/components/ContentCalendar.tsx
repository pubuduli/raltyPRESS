import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Download,
  Clock,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye
} from 'lucide-react';
import { db, getOperationalCalendar, getOperationalDrafts, convertToCsv } from '../db';
import {
  CalendarEntry,
  ContentDraft,
  ContentFormat,
  EditorialTheme,
  EDITORIAL_THEMES,
  EditorialCategory,
  EDITORIAL_CATEGORIES
} from '../types';
import {
  convertTorontoToColombo,
  getTodayInToronto,
  getMonthCalendarGrid,
  getWeekDates
} from '../utils/timezone';

interface ContentCalendarProps {
  demoMode?: boolean;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

export const ContentCalendar: React.FC<ContentCalendarProps> = ({ demoMode = false }) => {
  const [events, setEvents] = useState<CalendarEntry[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [filterFormat, setFilterFormat] = useState<string>('All');
  const [filterPlatform, setFilterPlatform] = useState<string>('All');

  const todayToronto = getTodayInToronto();
  const [activeDate, setActiveDate] = useState<string>(todayToronto);
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewEvent, setPreviewEvent] = useState<CalendarEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New event form state
  const [title, setTitle] = useState('');
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [format, setFormat] = useState<string>('Facebook Post');
  const [platform, setPlatform] = useState<NonNullable<CalendarEntry['platform']>>('Facebook');
  const [theme, setTheme] = useState<EditorialTheme>('Canada Real Estate Briefing');
  const [category, setCategory] = useState<EditorialCategory>('Canadian Housing Market');
  const [scheduledDate, setScheduledDate] = useState(todayToronto);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [status, setStatus] = useState<CalendarEntry['status']>('Scheduled');
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    const [allEvents, allDrafts] = await Promise.all([
      getOperationalCalendar(demoMode),
      getOperationalDrafts(demoMode)
    ]);
    setEvents(allEvents);
    setDrafts(allDrafts);
  }, [demoMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [activeYear, activeMonth] = activeDate.split('-').map(Number);

  const handleNavigateDate = (direction: -1 | 1) => {
    const [y, m, d] = activeDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    if (viewMode === 'month') {
      dt.setUTCMonth(dt.getUTCMonth() + direction);
    } else if (viewMode === 'week') {
      dt.setUTCDate(dt.getUTCDate() + direction * 7);
    } else {
      dt.setUTCDate(dt.getUTCDate() + direction);
    }
    setActiveDate(dt.toISOString().slice(0, 10));
  };

  const handleExportCsv = () => {
    const csv = convertToCsv(
      events.map(ev => {
        const colombo = convertTorontoToColombo(ev.scheduledDate, ev.scheduledTime);
        return {
          id: ev.id,
          title: ev.title,
          scheduledDate: ev.scheduledDate,
          scheduledTimeToronto: ev.scheduledTime,
          scheduledTimeColombo: colombo.formattedDual,
          platform: ev.platform || 'Facebook',
          format: ev.format,
          theme: ev.theme,
          category: ev.category,
          status: ev.status,
          notes: ev.notes || ''
        };
      })
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `realtypress-calendar-${todayToronto}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const newEvent: CalendarEntry = {
      id: `cal-${Date.now()}`,
      title: title.trim(),
      draftId: selectedDraftId || undefined,
      format,
      platform,
      theme,
      category,
      scheduledDate,
      scheduledTime,
      timeZone: 'America/Toronto',
      status,
      notes,
      isSampleData: false,
      createdAt: new Date().toISOString()
    };

    await db.calendarEntries.add(newEvent);
    setShowAddModal(false);
    setTitle('');
    setNotes('');
    await loadData();
  };

  const handleDuplicateEvent = async (ev: CalendarEntry) => {
    const duplicate: CalendarEntry = {
      ...ev,
      id: `cal-${Date.now()}`,
      title: `${ev.title} (Copy)`,
      status: 'Planned',
      isSampleData: false,
      createdAt: new Date().toISOString()
    };
    await db.calendarEntries.add(duplicate);
    await loadData();
  };

  const handleStatusChange = async (ev: CalendarEntry, newStatus: CalendarEntry['status']) => {
    await db.calendarEntries.update(ev.id, { status: newStatus });
    if (newStatus === 'Published') {
      const existingPub = await db.publishedPosts.get(`pub-${ev.id}`);
      if (!existingPub) {
        const linkedDraft = drafts.find(d => d.id === ev.draftId);
        const pubPlatform: 'Facebook' | 'LinkedIn' | 'Instagram' =
          ev.platform === 'LinkedIn'
            ? 'LinkedIn'
            : ev.platform === 'Instagram'
            ? 'Instagram'
            : 'Facebook';
        await db.publishedPosts.put({
          id: `pub-${ev.id}`,
          title: ev.title,
          format: ev.format,
          platform: pubPlatform,
          category: ev.category || 'Canadian Housing Market',
          storyId: ev.storyId,
          draftId: ev.draftId,
          publishedAt: `${ev.scheduledDate}T${ev.scheduledTime || '09:00'}:00Z`,
          caption: linkedDraft?.content || ev.notes || ev.title,
          hashtags: linkedDraft?.hashtags || ['#realtyPRESS', '#CanadianRealEstate'],
          sourcePublication: linkedDraft?.sourceAttribution || 'realtyPRESS Editorial Desk',
          reach: 0,
          views: 0,
          reactions: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          followerConversions: 0,
          dataSource: 'Manual Entry',
          isSampleData: false
        });
      }
    }
    await loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    await db.calendarEntries.delete(deleteConfirmId);
    setDeleteConfirmId(null);
    await loadData();
  };

  const filteredEvents = events.filter(ev => {
    const matchesFmt = filterFormat === 'All' || ev.format === filterFormat;
    const matchesPlat = filterPlatform === 'All' || (ev.platform || 'Facebook') === filterPlatform;
    return matchesFmt && matchesPlat;
  });

  const monthCells = getMonthCalendarGrid(activeYear, (activeMonth || 1) - 1);
  const weekDateStrings = getWeekDates(activeDate);
  const liveColomboPreview = convertTorontoToColombo(scheduledDate, scheduledTime);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#F20000]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#F20000]">
              IANA Dual-Timezone Editorial Schedule (America/Toronto &harr; Asia/Colombo)
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
            Content Publishing Calendar
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Automatically adjusts for Toronto Daylight Saving Time (EDT UTC-4 vs EST UTC-5) relative to Colombo (IST UTC+5:30).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {(['month', 'week', 'day', 'list'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-white dark:bg-[#242626] text-[#242626] dark:text-white shadow-2xs'
                    : 'text-gray-500'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button
            onClick={() => {
              setScheduledDate(activeDate);
              setShowAddModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule Post
          </button>
        </div>
      </div>

      {/* Date Navigation & Filters */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleNavigateDate(-1)}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-[#242626] dark:text-white"
            title="Previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveDate(todayToronto)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-[#242626] dark:text-white"
          >
            Today ({todayToronto})
          </button>
          <button
            onClick={() => handleNavigateDate(1)}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-[#242626] dark:text-white"
            title="Next"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-bold font-['Poppins'] text-[#242626] dark:text-white ml-2">
            {MONTH_NAMES[(activeMonth || 1) - 1]} {activeYear}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
          >
            <option value="All">All Platforms</option>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
            <option value="LinkedIn">LinkedIn</option>
            <option value="Multi-platform">Multi-platform</option>
          </select>

          <select
            value={filterFormat}
            onChange={e => setFilterFormat(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
          >
            <option value="All">All Formats ({events.length})</option>
            <option value="Facebook Post">Facebook Post</option>
            <option value="LinkedIn Post">LinkedIn Post</option>
            <option value="Instagram Caption">Instagram Caption</option>
            <option value="Reel Script">Reel Script</option>
            <option value="Carousel">Carousel</option>
            <option value="News Infographic Brief">News Infographic Brief</option>
            <option value="Facebook Stories">Facebook Stories</option>
          </select>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[11px] font-bold uppercase text-gray-400">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {monthCells.map(cell => {
              const dayEvents = filteredEvents.filter(e => e.scheduledDate === cell.dateStr);
              const isToday = cell.dateStr === todayToronto;
              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setActiveDate(cell.dateStr)}
                  className={`min-h-28 p-2 rounded-xl border flex flex-col justify-between cursor-pointer transition-colors ${
                    !cell.isCurrentMonth
                      ? 'bg-gray-50/30 dark:bg-gray-900/20 border-gray-100 dark:border-gray-800/50 opacity-50'
                      : isToday
                      ? 'bg-red-50/30 dark:bg-red-950/20 border-[#F20000]'
                      : 'bg-gray-50/60 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday ? 'text-[#F20000]' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {cell.dayOfMonth}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 mt-1.5">
                    {dayEvents.map(ev => (
                      <div
                        key={ev.id}
                        onClick={e => {
                          e.stopPropagation();
                          setPreviewEvent(ev);
                        }}
                        className={`p-1.5 rounded-lg text-[10px] border hover:opacity-90 ${
                          ev.status === 'Published'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200'
                            : ev.status === 'Scheduled' || ev.status === 'Approved'
                            ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-200'
                            : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{ev.scheduledTime} ET</span>
                          <span>{ev.platform || 'FB'}</span>
                        </div>
                        <p className="font-semibold line-clamp-1 mt-0.5">{ev.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-5 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDateStrings.map(dateStr => {
              const dayEvents = filteredEvents.filter(e => e.scheduledDate === dateStr);
              return (
                <div
                  key={dateStr}
                  className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 min-h-48 space-y-2"
                >
                  <div className="border-b border-gray-200 dark:border-gray-800 pb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#242626] dark:text-white">{dateStr}</span>
                    <span className="text-[10px] text-gray-400">{dayEvents.length} items</span>
                  </div>
                  {dayEvents.map(ev => (
                    <div
                      key={ev.id}
                      onClick={() => setPreviewEvent(ev)}
                      className="p-2 rounded-lg bg-white dark:bg-[#1E2022] border border-gray-200 dark:border-gray-700 cursor-pointer space-y-1 text-xs"
                    >
                      <div className="flex justify-between text-[10px] font-bold text-[#F20000]">
                        <span>{ev.scheduledTime} ET</span>
                        <span>{ev.status}</span>
                      </div>
                      <p className="font-semibold text-[#242626] dark:text-white line-clamp-2">{ev.title}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-[#242626] dark:text-white">
            Schedule for {activeDate}
          </h3>
          {filteredEvents.filter(e => e.scheduledDate === activeDate).length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">
              No publications scheduled for {activeDate}.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredEvents
                .filter(e => e.scheduledDate === activeDate)
                .map(ev => {
                  const colombo = convertTorontoToColombo(ev.scheduledDate, ev.scheduledTime);
                  return (
                    <div
                      key={ev.id}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4"
                    >
                      <div>
                        <span className="text-xs font-bold text-[#F20000]">
                          {colombo.formattedDual}
                        </span>
                        <h4 className="text-sm font-bold text-[#242626] dark:text-white mt-0.5">{ev.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {ev.platform || 'Facebook'} • {ev.format} • {ev.theme}
                        </p>
                      </div>
                      <button
                        onClick={() => setPreviewEvent(ev)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                      >
                        Inspect
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="py-3.5 px-4">Date & Dual Timezone</th>
                  <th className="py-3.5 px-4">Publication Title</th>
                  <th className="py-3.5 px-4">Platform & Format</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                {filteredEvents.map(ev => {
                  const colombo = convertTorontoToColombo(ev.scheduledDate, ev.scheduledTime);
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <p className="font-bold text-[#242626] dark:text-white">{ev.scheduledDate}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <Clock className="w-3 h-3 text-[#F20000]" />
                          <span>{colombo.formattedDual}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#242626] dark:text-white">
                        {ev.title}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {ev.platform || 'Facebook'} • {ev.format}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={ev.status}
                          onChange={e =>
                            handleStatusChange(ev, e.target.value as CalendarEntry['status'])
                          }
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            ev.status === 'Published'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400'
                              : ev.status === 'Scheduled' || ev.status === 'Approved'
                              ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400'
                              : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400'
                          }`}
                        >
                          <option value="Planned">Planned</option>
                          <option value="In Production">In Production</option>
                          <option value="Awaiting Approval">Awaiting Approval</option>
                          <option value="Approved">Approved</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Published">Published</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewEvent(ev)}
                            className="p-1.5 text-gray-500 hover:text-[#242626] dark:hover:text-white rounded-lg"
                            title="Preview"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicateEvent(ev)}
                            className="p-1.5 text-gray-500 hover:text-[#242626] dark:hover:text-white rounded-lg"
                            title="Duplicate"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(ev.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event Preview Modal */}
      {previewEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-bold font-['Poppins'] text-[#242626] dark:text-white">
                Scheduled Publication Details
              </h3>
              <button onClick={() => setPreviewEvent(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-xs">
              <p className="text-sm font-bold text-[#242626] dark:text-white">{previewEvent.title}</p>
              <p className="text-gray-500">
                <strong>Platform & Format:</strong> {previewEvent.platform || 'Facebook'} • {previewEvent.format}
              </p>
              <p className="text-gray-500">
                <strong>Theme & Category:</strong> {previewEvent.theme} • {previewEvent.category}
              </p>
              <p className="text-gray-500">
                <strong>Schedule (Dual Timezone):</strong>{' '}
                {convertTorontoToColombo(previewEvent.scheduledDate, previewEvent.scheduledTime).formattedDual}
              </p>
              {previewEvent.notes && (
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                  {previewEvent.notes}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-800">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleDuplicateEvent(previewEvent);
                    setPreviewEvent(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    setDeleteConfirmId(previewEvent.id);
                    setPreviewEvent(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold"
                >
                  Delete
                </button>
              </div>
              <button
                onClick={() => setPreviewEvent(null)}
                className="px-4 py-1.5 rounded-lg bg-[#242626] dark:bg-white text-white dark:text-[#242626] text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#242626] dark:text-white">
              Confirm Delete Scheduled Item
            </h3>
            <p className="text-xs text-gray-500">
              Are you sure you want to remove this scheduled post from the Content Calendar?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-[#F20000] text-white text-xs font-semibold"
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold font-['Poppins'] text-[#242626] dark:text-white">
                Schedule Editorial Publication
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Link Content Draft (Optional)
                </label>
                <select
                  value={selectedDraftId}
                  onChange={e => {
                    setSelectedDraftId(e.target.value);
                    const d = drafts.find(dr => dr.id === e.target.value);
                    if (d) {
                      setTitle(d.headline || d.title);
                      setFormat(d.format);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                >
                  <option value="">-- Custom / Unlinked Slot --</option>
                  {drafts.map(d => (
                    <option key={d.id} value={d.id}>
                      [{d.status}] {d.headline || d.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Post Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Bank of Canada Rate Hold Breakdown"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Platform
                  </label>
                  <select
                    value={platform}
                    onChange={e => setPlatform(e.target.value as NonNullable<CalendarEntry['platform']>)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  >
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Multi-platform">Multi-platform</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Format
                  </label>
                  <select
                    value={format}
                    onChange={e => setFormat(e.target.value as ContentFormat)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  >
                    <option value="Facebook Post">Facebook Post</option>
                    <option value="LinkedIn Post">LinkedIn Post</option>
                    <option value="Instagram Caption">Instagram Caption</option>
                    <option value="Reel Script">Reel Script</option>
                    <option value="Carousel">Carousel</option>
                    <option value="News Infographic Brief">News Infographic Brief</option>
                    <option value="Facebook Stories">Facebook Stories</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as CalendarEntry['status'])}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  >
                    <option value="Planned">Planned</option>
                    <option value="Approved">Approved</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Published">Published</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Editorial Theme
                  </label>
                  <select
                    value={theme}
                    onChange={e => setTheme(e.target.value as EditorialTheme)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  >
                    {EDITORIAL_THEMES.map(th => (
                      <option key={th} value={th}>
                        {th}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as EditorialCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  >
                    {EDITORIAL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Date (America/Toronto)
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Toronto Time ({liveColomboPreview.torontoTzAbbrev})
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={e => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300 flex items-center justify-between">
                <span>Colombo Production Equivalent (Asia/Colombo):</span>
                <span className="font-bold text-[#F20000]">
                  {liveColomboPreview.colomboDate} • {liveColomboPreview.colomboTime} LK
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Publishing Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold"
                >
                  Save to Calendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
