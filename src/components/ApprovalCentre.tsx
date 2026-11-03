import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  ShieldCheck,
  FileText,
  Film,
  Image as ImageIcon,
  CalendarPlus,
  AlertTriangle,
  History
} from 'lucide-react';
import {
  db,
  getOperationalApprovals,
  getOperationalDrafts,
  getOperationalStories,
  getOperationalReels,
  getOperationalMedia
} from '../db';
import {
  ApprovalItem,
  ContentDraft,
  Story,
  ReelScript,
  MediaAsset,
  EditorialApprovalChecklist,
  AuditLogEntry
} from '../types';
import { convertTorontoToColombo, getTodayInToronto } from '../utils/timezone';

interface ApprovalCentreProps {
  demoMode?: boolean;
}

const DEFAULT_CHECKLIST: EditorialApprovalChecklist = {
  headlineAccuracy: false,
  sourceCredibility: false,
  publicationDateValid: false,
  numericalAccuracy: false,
  namesAndOrgAccuracy: false,
  canadianGeographicRelevance: false,
  contextAndInterpretation: false,
  noMisleadingClaims: false,
  originalSourceLinks: false,
  contentQuality: false
};

const CHECKLIST_LABELS: {
  key: keyof EditorialApprovalChecklist;
  label: string;
}[] = [
  { key: 'headlineAccuracy', label: '1. Headline accuracy verified against source' },
  {
    key: 'sourceCredibility',
    label: '2. Source credibility verified (Tier 1/2 regulator, board, or journalism)'
  },
  {
    key: 'publicationDateValid',
    label: '3. Publication date valid & current (not outdated news)'
  },
  {
    key: 'numericalAccuracy',
    label: '4. Numerical accuracy: percentages, rates, and figures verified'
  },
  {
    key: 'namesAndOrgAccuracy',
    label: '5. Names and Canadian organizations (CREA, CMHC, BoC, RECO) accurate'
  },
  {
    key: 'canadianGeographicRelevance',
    label: '6. Canadian national/provincial geographic relevance accurate'
  },
  {
    key: 'contextAndInterpretation',
    label: '7. REALTOR® context and market interpretation grounded'
  },
  {
    key: 'noMisleadingClaims',
    label: '8. Zero misleading claims or unsupported speculation'
  },
  {
    key: 'originalSourceLinks',
    label: '9. Original source attribution and links attached'
  },
  {
    key: 'contentQuality',
    label: '10. Final editorial sign-off: V8 quality & ready for publishing'
  }
];

export const ApprovalCentre: React.FC<ApprovalCentreProps> = ({
  demoMode = false
}) => {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [reels, setReels] = useState<ReelScript[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);

  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [reviewerName, setReviewerName] = useState('Managing Editor');
  const [checklist, setChecklist] =
    useState<EditorialApprovalChecklist>(DEFAULT_CHECKLIST);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState<string | null>(
    null
  );

  const loadData = useCallback(async () => {
    const [allApp, allDrafts, allStories, allReels, allMedia] =
      await Promise.all([
        getOperationalApprovals(demoMode),
        getOperationalDrafts(demoMode),
        getOperationalStories(demoMode),
        getOperationalReels(demoMode),
        getOperationalMedia(demoMode)
      ]);

    // Sync any drafts in 'Awaiting Approval' that don't yet have an ApprovalItem
    const synced = [...allApp];
    for (const d of allDrafts) {
      if (
        d.status === 'Awaiting Approval' &&
        !synced.some(a => a.targetId === d.id)
      ) {
        const newApp: ApprovalItem = {
          id: `app-${d.id}`,
          contentType: 'Content Draft',
          targetId: d.id,
          title: d.title || d.headline,
          stage: 'Editorial Review',
          submittedAt: d.updatedAt,
          status: 'Pending',
          reviewerName: 'Editorial Desk',
          feedbackNotes:
            'V8 compliance checked. Ready for 10-point human editorial review.',
          editorialChecklist: { ...DEFAULT_CHECKLIST },
          auditTrail: [],
          isSampleData: d.isSampleData
        };
        await db.approvals.put(newApp);
        synced.unshift(newApp);
      }
    }

    setApprovals(synced);
    setDrafts(allDrafts);
    setStories(allStories);
    setReels(allReels);
    setMedia(allMedia);
  }, [demoMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectApprovalItem = (item: ApprovalItem) => {
    setSelectedItem(item);
    setReviewerNotes(item.feedbackNotes || '');
    setChecklist(item.editorialChecklist || { ...DEFAULT_CHECKLIST });
    setApprovalError(null);
  };

  const handleToggleChecklistKey = (key: keyof EditorialApprovalChecklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCheckAll = () => {
    setChecklist({
      headlineAccuracy: true,
      sourceCredibility: true,
      publicationDateValid: true,
      numericalAccuracy: true,
      namesAndOrgAccuracy: true,
      canadianGeographicRelevance: true,
      contextAndInterpretation: true,
      noMisleadingClaims: true,
      originalSourceLinks: true,
      contentQuality: true
    });
  };

  const handleDecision = async (
    item: ApprovalItem,
    newStatus: ApprovalItem['status']
  ) => {
    setApprovalError(null);

    if (newStatus === 'Approved') {
      const allChecked = Object.values(checklist).every(Boolean);
      if (!allChecked) {
        setApprovalError(
          'Editorial Policy Gate: All 10 items on the Editorial Approval Checklist must be verified before approving content for publication.'
        );
        return;
      }
    }

    const now = new Date().toISOString();
    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: now,
      actor: reviewerName || 'Managing Editor',
      action: `Editorial Review Decision: ${newStatus}`,
      previousState: item.status,
      newState: newStatus,
      notes:
        reviewerNotes ||
        `Checklist verified: ${Object.values(checklist).filter(Boolean).length}/10`
    };

    const updatedAudit = [...(item.auditTrail || []), auditEntry];

    await db.approvals.update(item.id, {
      status: newStatus,
      decidedAt: now,
      reviewerName: reviewerName || 'Managing Editor',
      feedbackNotes: reviewerNotes || item.feedbackNotes,
      editorialChecklist: checklist,
      auditTrail: updatedAudit
    });

    if (item.contentType === 'Content Draft') {
      await db.contentDrafts.update(item.targetId, {
        status:
          newStatus === 'Approved'
            ? 'Approved'
            : newStatus === 'Rejected'
            ? 'Rejected'
            : 'Editorial Review',
        updatedAt: now
      });
    } else if (item.contentType === 'Reel') {
      await db.reelScripts.update(item.targetId, {
        status: newStatus === 'Approved' ? 'Approved' : 'Draft'
      });
    } else if (item.contentType === 'Media Asset') {
      await db.mediaAssets.update(item.targetId, {
        status:
          newStatus === 'Approved'
            ? 'Approved'
            : newStatus === 'Rejected'
            ? 'Rejected'
            : 'Under Review'
      });
    }

    await loadData();
    const refreshed = await db.approvals.get(item.id);
    if (refreshed) setSelectedItem(refreshed);
  };

  const handleFastTrackToCalendar = async (item: ApprovalItem) => {
    if (item.status !== 'Approved') {
      setApprovalError(
        'Content must be Approved before scheduling to the Content Calendar.'
      );
      return;
    }

    const todayToronto = getTodayInToronto();
    const timeToronto = '09:00';
    const colombo = convertTorontoToColombo(todayToronto, timeToronto);

    await db.calendarEntries.add({
      id: `cal-${Date.now()}`,
      title: item.title,
      draftId: item.contentType === 'Content Draft' ? item.targetId : undefined,
      theme: 'Canada Real Estate Briefing',
      category: 'Canadian Housing Market',
      format: item.contentType === 'Reel' ? 'Reel Script' : 'Facebook Post',
      platform: 'Facebook',
      scheduledDate: todayToronto,
      scheduledTime: timeToronto,
      timeZone: 'America/Toronto',
      status: 'Approved',
      notes: `Approved by ${item.reviewerName || reviewerName} (${colombo.formattedDual})`,
      isSampleData: item.isSampleData,
      createdAt: new Date().toISOString()
    });

    setScheduleSuccessMsg(
      `Scheduled "${item.title}" for ${todayToronto} at ${colombo.formattedDual}.`
    );
    setTimeout(() => setScheduleSuccessMsg(null), 5000);
  };

  const getReferencedDetail = (item: ApprovalItem) => {
    if (item.contentType === 'Content Draft') {
      const draft = drafts.find(d => d.id === item.targetId);
      const story = stories.find(s => s.id === draft?.storyId);
      return { draft, story };
    }
    if (item.contentType === 'Reel') {
      const reel = reels.find(r => r.id === item.targetId);
      return { reel };
    }
    if (item.contentType === 'Media Asset') {
      const asset = media.find(m => m.id === item.targetId);
      return { asset };
    }
    return {};
  };

  const filtered = approvals.filter(
    a => filterStatus === 'All' || a.status === filterStatus
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#F20000]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#F20000]">
              Mandatory Editorial Gate
            </span>
          </div>
          <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
            Human Editorial Approval Centre
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Enforces the 10-point Canadian real estate editorial checklist, source claim verification, and V8 compliance before scheduling.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['All', 'Pending', 'Approved', 'Changes Requested', 'Rejected'].map(
            st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filterStatus === st
                    ? 'bg-[#242626] dark:bg-white text-white dark:text-[#242626]'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
              >
                {st} (
                {st === 'All'
                  ? approvals.length
                  : approvals.filter(a => a.status === st).length}
                )
              </button>
            )
          )}
        </div>
      </div>

      {scheduleSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-semibold">
          <span>{scheduleSuccessMsg}</span>
          <button
            onClick={() => setScheduleSuccessMsg(null)}
            className="underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Queue List */}
        <div className="lg:col-span-5 space-y-3">
          {filtered.map(item => (
            <div
              key={item.id}
              onClick={() => handleSelectApprovalItem(item)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedItem?.id === item.id
                  ? 'bg-red-50/40 dark:bg-red-950/20 border-[#F20000]'
                  : 'bg-white dark:bg-[#1E2022] border-gray-200 dark:border-gray-800 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {item.contentType === 'Content Draft' ? (
                    <FileText className="w-3 h-3 text-[#F20000]" />
                  ) : item.contentType === 'Reel' ? (
                    <Film className="w-3 h-3 text-[#F20000]" />
                  ) : (
                    <ImageIcon className="w-3 h-3 text-[#F20000]" />
                  )}
                  {item.contentType}
                </span>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    item.status === 'Approved'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : item.status === 'Pending'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400'
                  }`}
                >
                  {item.status}
                </span>
              </div>

              <h3 className="text-sm font-bold text-[#242626] dark:text-white line-clamp-2">
                {item.title}
              </h3>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Submitted {new Date(item.submittedAt).toLocaleDateString('en-CA')}
                </span>
                <span className="font-semibold text-[#F20000]">Review &rarr;</span>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center text-sm text-gray-400">
              No items in the "{filterStatus}" approval queue.
            </div>
          )}
        </div>

        {/* Right Inspection & Decision Panel */}
        <div className="lg:col-span-7">
          {selectedItem ? (
            <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
                <div>
                  <span className="text-xs font-bold uppercase text-[#F20000]">
                    Editorial Inspection • {selectedItem.contentType}
                  </span>
                  <h3 className="text-lg font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
                    {selectedItem.title}
                  </h3>
                </div>

                {selectedItem.status === 'Approved' && (
                  <button
                    onClick={() => handleFastTrackToCalendar(selectedItem)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242626] dark:bg-white text-white dark:text-[#242626] text-xs font-semibold"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" />
                    Add to Publishing Calendar
                  </button>
                )}
              </div>

              {approvalError && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4 text-[#F20000] shrink-0 mt-0.5" />
                  <span>{approvalError}</span>
                </div>
              )}

              {(() => {
                const { draft, story } = getReferencedDetail(selectedItem);
                if (draft) {
                  return (
                    <div className="space-y-4">
                      {story && (
                        <div className="p-3.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                          <p className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Source Verification (
                            {story.sourcePublicationName} • {story.verificationStatus})
                          </p>
                          <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300">
                            {story.verifiedFacts.map((f, idx) => (
                              <li key={idx}>• {f}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                          <p className="text-[10px] font-bold uppercase text-gray-400">
                            Word Count
                          </p>
                          <p className="text-sm font-bold text-[#242626] dark:text-white">
                            {draft.wordCount} words
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                          <p className="text-[10px] font-bold uppercase text-gray-400">
                            Platform
                          </p>
                          <p className="text-sm font-bold text-[#242626] dark:text-white">
                            {draft.targetPlatform}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                          <p className="text-[10px] font-bold uppercase text-gray-400">
                            V8 Engine Status
                          </p>
                          <p
                            className={`text-sm font-bold ${
                              draft.v8Validation?.isValid
                                ? 'text-emerald-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {draft.v8Validation?.isValid
                              ? 'Compliant'
                              : 'Needs Review'}
                          </p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-3 max-h-64 overflow-y-auto">
                        <p className="text-[11px] font-bold uppercase text-[#F20000]">
                          Caption Body
                        </p>
                        <div className="text-xs text-[#242626] dark:text-gray-200 whitespace-pre-line leading-relaxed">
                          {draft.content}
                        </div>
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex flex-wrap gap-1.5">
                          {draft.hashtags.map((h, i) => (
                            <span
                              key={i}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                            >
                              {h}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-300">
                    Inspecting {selectedItem.contentType} item ({selectedItem.targetId}
                    ). Verify brand compliance and checklist below.
                  </div>
                );
              })()}

              {/* Section 5: Mandatory 10-Point Editorial Approval Checklist */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#242626] dark:text-white">
                      10-Point Editorial Approval Checklist (Mandatory for Approval)
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      {Object.values(checklist).filter(Boolean).length} of 10
                      criteria verified
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckAll}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[#242626] dark:text-white hover:bg-gray-100"
                  >
                    Mark All Verified
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CHECKLIST_LABELS.map(({ key, label }) => (
                    <label
                      key={key}
                      className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        checklist[key]
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checklist[key]}
                        onChange={() => handleToggleChecklistKey(key)}
                        className="mt-0.5 rounded border-gray-300 text-[#F20000] focus:ring-[#F20000]"
                      />
                      <span className="leading-snug font-medium">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Editorial Reviewer Name
                  </label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={e => setReviewerName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Editorial Reviewer Notes / Revision Instructions
                  </label>
                  <input
                    type="text"
                    value={reviewerNotes}
                    onChange={e => setReviewerNotes(e.target.value)}
                    placeholder="Add editorial sign-off notes or revision instructions..."
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
              </div>

              {selectedItem.auditTrail && selectedItem.auditTrail.length > 0 && (
                <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-800 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-1">
                    <History className="w-3.5 h-3.5" /> Approval Audit Trail
                  </p>
                  {selectedItem.auditTrail.map(entry => (
                    <div
                      key={entry.id}
                      className="text-[11px] text-gray-600 dark:text-gray-400 flex justify-between"
                    >
                      <span>
                        <strong>{entry.actor}</strong>: {entry.action} (
                        {entry.notes})
                      </span>
                      <span className="text-gray-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => handleDecision(selectedItem, 'Rejected')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 text-xs font-semibold transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  onClick={() =>
                    handleDecision(selectedItem, 'Changes Requested')
                  }
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400 hover:bg-amber-50 text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Request Revision
                </button>
                <button
                  onClick={() => handleDecision(selectedItem, 'Approved')}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Approve for Publishing
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
              <CheckSquare className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-500">
                Select an item from the approval queue on the left to inspect its V8 compliance and complete the 10-point editorial checklist.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
