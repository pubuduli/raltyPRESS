import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  X,
  ShieldCheck,
  History,
  FileCheck2
} from 'lucide-react';
import { db, getOperationalStories, convertToCsv } from '../db';
import {
  Story,
  VerificationStatus,
  VERIFICATION_STATES,
  EditorialCategory,
  EDITORIAL_CATEGORIES,
  CanadianRegion,
  CANADIAN_REGIONS,
  ClaimEvidence,
  AuditLogEntry
} from '../types';
import { calculateEditorialScore } from '../utils/scoring';

interface StoryManagerProps {
  onSelectStoryForStudio: (story: Story) => void;
  demoMode?: boolean;
}

export const StoryManager: React.FC<StoryManagerProps> = ({
  onSelectStoryForStudio,
  demoMode = false
}) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStoryDetail, setSelectedStoryDetail] = useState<Story | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Evidence verification modal state
  const [newClaimText, setNewClaimText] = useState('');
  const [newClaimSource, setNewClaimSource] = useState('');
  const [newClaimUrl, setNewClaimUrl] = useState('');
  const [newClaimDate, setNewClaimDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [newClaimExcerpt, setNewClaimExcerpt] = useState('');
  const [reviewerName, setReviewerName] = useState('Managing Editor');
  const [reviewerNotes, setReviewerNotes] = useState('');

  // New story form state
  const [headline, setHeadline] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [category, setCategory] = useState<EditorialCategory>(
    'Canadian Housing Market'
  );
  const [region, setRegion] = useState<CanadianRegion>('National / Canada-Wide');
  const [summary, setSummary] = useState('');
  const [realtorImpactSummary, setRealtorImpactSummary] = useState('');
  const [factsText, setFactsText] = useState('');
  const [dataPointsText, setDataPointsText] = useState('');
  const [realtorRelevance, setRealtorRelevance] = useState(22);
  const [newsImportance, setNewsImportance] = useState(18);
  const [timeliness, setTimeliness] = useState(18);

  const loadStories = useCallback(async () => {
    const all = await getOperationalStories(demoMode);
    setStories(all);
    if (selectedStoryDetail) {
      const updated = all.find(s => s.id === selectedStoryDetail.id);
      if (updated) setSelectedStoryDetail(updated);
    }
  }, [demoMode, selectedStoryDetail]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const handleExportCsv = () => {
    const csv = convertToCsv(stories);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'realtypress-stories.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChangeAttempt = async (
    story: Story,
    newStatus: VerificationStatus
  ) => {
    setVerificationError(null);

    if (story.isSampleData && newStatus === 'Verified') {
      setVerificationError(
        'Demo sample records cannot be marked as real-world Verified news. Switch to Production Mode and add a real story.'
      );
      return;
    }

    if (newStatus === 'Verified') {
      const verifiedClaims = (story.claimsEvidence || []).filter(
        c => c.verificationStatus === 'Verified'
      );
      if (verifiedClaims.length === 0 || !story.sourceUrl?.trim()) {
        setSelectedStoryDetail(story);
        setVerificationError(
          'Evidence Required: To mark a story "Verified", you must log at least 1 verified claim with a source URL and excerpt, and complete human review below.'
        );
        return;
      }
    }

    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: reviewerName || 'Managing Editor',
      action: `Verification Status Changed to ${newStatus}`,
      previousState: story.verificationStatus,
      newState: newStatus,
      notes: reviewerNotes || `Updated status to ${newStatus}`
    };

    const updatedAudit = [...(story.auditTrail || []), auditEntry];
    await db.stories.update(story.id, {
      verificationStatus: newStatus,
      editorialStatus:
        newStatus === 'Verified'
          ? 'Verified'
          : newStatus === 'Rejected'
          ? 'Rejected'
          : story.editorialStatus,
      auditTrail: updatedAudit,
      updatedAt: new Date().toISOString()
    });
    await loadStories();
  };

  const handleAddClaimEvidence = async (story: Story) => {
    if (
      !newClaimText.trim() ||
      !newClaimSource.trim() ||
      !newClaimExcerpt.trim()
    ) {
      setVerificationError(
        'Please provide the claim text, supporting source name, and evidence excerpt.'
      );
      return;
    }

    const claim: ClaimEvidence = {
      id: `claim-${Date.now()}`,
      claimText: newClaimText.trim(),
      supportingSource: newClaimSource.trim(),
      sourceUrl: newClaimUrl.trim() || story.sourceUrl || '',
      publicationDate: newClaimDate,
      evidenceExcerpt: newClaimExcerpt.trim(),
      verificationStatus: 'Verified',
      reviewer: reviewerName || 'Managing Editor',
      verificationTimestamp: new Date().toISOString(),
      reviewerNotes: reviewerNotes.trim(),
      additionalSources: []
    };

    const updatedClaims = [...(story.claimsEvidence || []), claim];
    const updatedFacts = Array.from(
      new Set([...(story.verifiedFacts || []), claim.claimText])
    );
    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor: reviewerName || 'Managing Editor',
      action: 'Added Verified Claim Evidence',
      previousState: story.verificationStatus,
      newState:
        story.verificationStatus === 'Unverified'
          ? 'Evidence Collected'
          : story.verificationStatus,
      notes: `Claim verified against ${claim.supportingSource}: "${claim.claimText}"`
    };

    const nextStatus: VerificationStatus =
      story.verificationStatus === 'Unverified' ||
      story.verificationStatus === 'Research in Progress'
        ? 'Evidence Collected'
        : story.verificationStatus;

    await db.stories.update(story.id, {
      claimsEvidence: updatedClaims,
      verifiedFacts: updatedFacts,
      verificationStatus: nextStatus,
      auditTrail: [...(story.auditTrail || []), auditEntry],
      updatedAt: new Date().toISOString()
    });

    setNewClaimText('');
    setNewClaimExcerpt('');
    setVerificationError(null);
    await loadStories();
  };

  const handleCompleteHumanVerification = async (story: Story) => {
    setVerificationError(null);
    if (story.isSampleData) {
      setVerificationError(
        'Demo sample records cannot be certified as real verified news.'
      );
      return;
    }

    const verifiedClaims = (story.claimsEvidence || []).filter(
      c => c.verificationStatus === 'Verified'
    );
    if (verifiedClaims.length === 0) {
      setVerificationError(
        'Please add and verify at least one factual claim with a supporting source excerpt first.'
      );
      return;
    }

    if (
      !story.sourceUrl?.trim() &&
      !verifiedClaims.some(c => c.sourceUrl?.trim())
    ) {
      setVerificationError(
        'An original source URL is required to certify a story as Verified.'
      );
      return;
    }

    if (!reviewerName.trim()) {
      setVerificationError(
        'Reviewer name is required for the verification audit trail.'
      );
      return;
    }

    const now = new Date().toISOString();
    const auditEntry: AuditLogEntry = {
      id: `audit-${Date.now()}`,
      timestamp: now,
      actor: reviewerName.trim(),
      action: 'Certified Story as Human-Verified',
      previousState: story.verificationStatus,
      newState: 'Verified',
      notes:
        reviewerNotes.trim() ||
        `Verified with ${verifiedClaims.length} evidence-backed claim(s).`
    };

    await db.stories.update(story.id, {
      verificationStatus: 'Verified',
      editorialStatus: 'Verified',
      internalNotes: reviewerNotes.trim() || story.internalNotes,
      auditTrail: [...(story.auditTrail || []), auditEntry],
      updatedAt: now
    });

    await loadStories();
  };

  const handleToggleClaimVerification = async (
    story: Story,
    claimId: string
  ) => {
    const updatedClaims = (story.claimsEvidence || []).map(c => {
      if (c.id !== claimId) return c;
      const next: VerificationStatus =
        c.verificationStatus === 'Verified' ? 'Needs Correction' : 'Verified';
      return {
        ...c,
        verificationStatus: next,
        reviewer: reviewerName || 'Managing Editor',
        verificationTimestamp: new Date().toISOString()
      };
    });

    await db.stories.update(story.id, { claimsEvidence: updatedClaims });
    await loadStories();
  };

  const handleToggleProduction = async (story: Story) => {
    const nextStatus =
      story.editorialStatus === 'Selected' ? 'Verified' : 'Selected';
    await db.stories.update(story.id, { editorialStatus: nextStatus });
    await loadStories();
  };

  const handleDelete = async (id: string) => {
    await db.stories.delete(id);
    if (selectedStoryDetail?.id === id) setSelectedStoryDetail(null);
    await loadStories();
  };

  const handleCreateStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headline.trim()) return;

    const breakdown = {
      realtorRelevance,
      newsImportance,
      timeliness,
      audienceInterest: 13,
      sourceReliability: 14,
      originalAngle: 3
    };
    const scoreRes = calculateEditorialScore(breakdown);

    const parsedFacts = factsText
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);
    const initialClaims: ClaimEvidence[] = parsedFacts.map((f, idx) => ({
      id: `claim-${Date.now()}-${idx}`,
      claimText: f,
      supportingSource: sourceName || 'Primary Source',
      sourceUrl: sourceUrl || '',
      publicationDate: new Date().toISOString().split('T')[0],
      evidenceExcerpt: f,
      verificationStatus: 'Evidence Collected',
      reviewer: 'Editor',
      reviewerNotes: 'Initial candidate claim'
    }));

    const now = new Date().toISOString();
    const newStory: Story = {
      id: `story-${Date.now()}`,
      originalHeadline: headline.trim(),
      proposedHeadline: headline.trim().toUpperCase(),
      sourcePublicationName: sourceName.trim() || 'Manual Entry',
      sourceUrl: sourceUrl.trim(),
      publicationDate: now.slice(0, 10),
      dateDiscovered: now.slice(0, 10),
      category,
      province: region,
      articleSummary: summary,
      realtorRelevanceNotes: realtorImpactSummary,
      verifiedFacts: parsedFacts,
      claimsEvidence: initialClaims,
      statistics: dataPointsText
        .split(',')
        .map(d => d.trim())
        .filter(Boolean),
      industryImplications: [realtorImpactSummary || 'Strategic impact for Canadian REALTORS®'],
      verificationStatus:
        initialClaims.length > 0 ? 'Evidence Collected' : 'Unverified',
      editorialStatus:
        initialClaims.length > 0 ? 'Awaiting Verification' : 'Research Pending',
      internalNotes:
        'Logged via Story Manager. Requires human evidence review before marking Verified.',
      editorialScore: scoreRes.total,
      scoreBreakdown: breakdown,
      assignedFormats: ['Facebook Post'],
      isSampleData: false,
      createdAt: now,
      updatedAt: now,
      auditTrail: [
        {
          id: `audit-${Date.now()}`,
          timestamp: now,
          actor: 'Editor',
          action: 'Created Story Record',
          previousState: 'None',
          newState:
            initialClaims.length > 0 ? 'Evidence Collected' : 'Unverified',
          notes: `Logged with ${initialClaims.length} initial claim(s).`
        }
      ]
    };

    await db.stories.add(newStory);
    setShowAddModal(false);
    setHeadline('');
    setSourceName('');
    setSourceUrl('');
    setSummary('');
    setRealtorImpactSummary('');
    setFactsText('');
    setDataPointsText('');
    await loadStories();
  };

  const filtered = stories.filter(
    s => selectedStatus === 'All' || s.verificationStatus === selectedStatus
  );

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-['Poppins'] text-[#242626] dark:text-white">
            Story Manager & Evidence-Based Fact-Checking
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Verify source claims with supporting URLs and excerpts, track the 7-stage verification lifecycle, and audit every status transition.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Log New Story
          </button>
        </div>
      </div>

      {verificationError && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between gap-3 text-xs text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F20000] shrink-0" />
            <span className="font-semibold">{verificationError}</span>
          </div>
          <button
            onClick={() => setVerificationError(null)}
            className="underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Tabs (7-Stage Verification Workflow) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['All', ...VERIFICATION_STATES].map(status => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedStatus === status
                ? 'bg-[#242626] dark:bg-white text-white dark:text-[#242626]'
                : 'bg-white dark:bg-[#1E2022] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50'
            }`}
          >
            {status} (
            {status === 'All'
              ? stories.length
              : stories.filter(s => s.verificationStatus === status).length}
            )
          </button>
        ))}
      </div>

      {/* Stories Table */}
      <div className="bg-white dark:bg-[#1E2022] rounded-xl border border-gray-200 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <th className="py-3.5 px-4">Story & Source</th>
                <th className="py-3.5 px-4">Region / Category</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Evidence Claims</th>
                <th className="py-3.5 px-4">Verification Stage</th>
                <th className="py-3.5 px-4">Queue</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {filtered.map(story => {
                const verifiedClaimCount = (story.claimsEvidence || []).filter(
                  c => c.verificationStatus === 'Verified'
                ).length;
                return (
                  <tr
                    key={story.id}
                    className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="py-4 px-4 max-w-md">
                      <div className="flex items-center gap-1.5 mb-1">
                        {story.isSampleData && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            DEMO SAMPLE
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setVerificationError(null);
                            setSelectedStoryDetail(story);
                          }}
                          className="font-semibold text-[#242626] dark:text-white hover:text-[#F20000] text-left line-clamp-2 transition-colors"
                        >
                          {story.proposedHeadline}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span>{story.sourcePublicationName}</span>
                        <span>•</span>
                        <span>{story.publicationDate}</span>
                        {story.sourceUrl && (
                          <a
                            href={story.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#F20000] hover:underline inline-flex items-center gap-0.5"
                          >
                            Link <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {story.province}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{story.category}</p>
                    </td>

                    <td className="py-4 px-4">
                      <span className="text-sm font-bold text-[#242626] dark:text-white">
                        {story.editorialScore}/100
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <button
                        onClick={() => {
                          setVerificationError(null);
                          setSelectedStoryDetail(story);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-xs font-semibold text-[#242626] dark:text-gray-200"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-[#F20000]" />
                        {verifiedClaimCount} Verified / {(story.claimsEvidence || []).length}{' '}
                        Claims
                      </button>
                    </td>

                    <td className="py-4 px-4">
                      <select
                        value={story.verificationStatus}
                        onChange={e =>
                          handleStatusChangeAttempt(
                            story,
                            e.target.value as VerificationStatus
                          )
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                          story.verificationStatus === 'Verified'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400'
                            : story.verificationStatus === 'Rejected' ||
                              story.verificationStatus === 'Needs Correction'
                            ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400'
                            : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400'
                        }`}
                      >
                        {VERIFICATION_STATES.map(st => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleToggleProduction(story)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                          story.editorialStatus === 'Selected'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {story.editorialStatus === 'Selected'
                          ? 'Selected'
                          : 'Select for Queue'}
                      </button>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setVerificationError(null);
                            setSelectedStoryDetail(story);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold text-[#242626] dark:text-white"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Verify Claims
                        </button>
                        <button
                          onClick={() => onSelectStoryForStudio(story)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />
                          Generate
                        </button>
                        <button
                          onClick={() => handleDelete(story.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Delete Story"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-gray-400">
                    No stories match the selected verification stage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Story Detail & Evidence-Based Fact-Checking Modal */}
      {selectedStoryDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-4xl w-full p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedStoryDetail.isSampleData && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                      DEMO SAMPLE — NOT VERIFIED REAL NEWS
                    </span>
                  )}
                  <span className="text-xs font-bold uppercase text-[#F20000]">
                    {selectedStoryDetail.category} • {selectedStoryDetail.province}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 dark:bg-gray-800 text-[#242626] dark:text-white">
                    Stage: {selectedStoryDetail.verificationStatus}
                  </span>
                </div>
                <h3 className="text-lg font-bold font-['Poppins'] text-[#242626] dark:text-white mt-1">
                  {selectedStoryDetail.proposedHeadline}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                  <span>Source: {selectedStoryDetail.sourcePublicationName}</span>
                  {selectedStoryDetail.sourceUrl && (
                    <a
                      href={selectedStoryDetail.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#F20000] hover:underline inline-flex items-center gap-1"
                    >
                      {selectedStoryDetail.sourceUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedStoryDetail(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {verificationError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium">
                {verificationError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-3.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <p className="text-xs font-bold uppercase text-gray-400 mb-1">Summary</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {selectedStoryDetail.articleSummary}
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                <p className="text-xs font-bold uppercase text-[#F20000] mb-1">
                  REALTOR® Impact
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {selectedStoryDetail.realtorRelevanceNotes}
                </p>
              </div>
            </div>

            {/* Section 5: Claim Evidence Log */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#242626] dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Source Claim Evidence & Fact-Checking Ledger
                  </h4>
                  <p className="text-xs text-gray-500">
                    Each factual claim or statistic must be backed by a source URL and direct excerpt before the story can be certified as Verified.
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-600">
                  {
                    (selectedStoryDetail.claimsEvidence || []).filter(
                      c => c.verificationStatus === 'Verified'
                    ).length
                  }{' '}
                  Verified Claim(s)
                </span>
              </div>

              {(selectedStoryDetail.claimsEvidence || []).length === 0 ? (
                <div className="p-4 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  No verified claim evidence recorded yet. Add at least one claim with a supporting source and excerpt below.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(selectedStoryDetail.claimsEvidence || []).map(claim => (
                    <div
                      key={claim.id}
                      className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              claim.verificationStatus === 'Verified'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {claim.verificationStatus}
                          </span>
                          <span className="text-xs font-bold text-[#242626] dark:text-white">
                            {claim.supportingSource}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            ({claim.publicationDate})
                          </span>
                          {claim.sourceUrl && (
                            <a
                              href={claim.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-[#F20000] hover:underline inline-flex items-center gap-0.5"
                            >
                              Source URL <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-[#242626] dark:text-gray-200">
                          Claim: {claim.claimText}
                        </p>
                        <p className="text-[11px] text-gray-500 italic">
                          Excerpt: "{claim.evidenceExcerpt}"
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleToggleClaimVerification(selectedStoryDetail, claim.id)
                        }
                        className="px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-xs font-semibold text-[#242626] dark:text-white shrink-0 hover:bg-white dark:hover:bg-gray-800"
                      >
                        {claim.verificationStatus === 'Verified'
                          ? 'Mark Needs Correction'
                          : 'Verify Claim'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Claim Evidence Form */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-3">
                <p className="text-xs font-bold uppercase text-gray-500">
                  Add Supporting Claim Evidence
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newClaimText}
                    onChange={e => setNewClaimText(e.target.value)}
                    placeholder="Specific claim or statistic (e.g., Overnight rate held at 3.25%)"
                    className="sm:col-span-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                  <input
                    type="text"
                    value={newClaimSource}
                    onChange={e => setNewClaimSource(e.target.value)}
                    placeholder="Source (e.g., Bank of Canada)"
                    className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="url"
                    value={newClaimUrl}
                    onChange={e => setNewClaimUrl(e.target.value)}
                    placeholder="Original Source URL (https://...)"
                    className="sm:col-span-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                  <input
                    type="date"
                    value={newClaimDate}
                    onChange={e => setNewClaimDate(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newClaimExcerpt}
                    onChange={e => setNewClaimExcerpt(e.target.value)}
                    placeholder="Direct quote / evidence excerpt from the source document..."
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddClaimEvidence(selectedStoryDetail)}
                    className="px-3.5 py-2 rounded-lg bg-[#242626] dark:bg-white text-white dark:text-[#242626] text-xs font-semibold shrink-0"
                  >
                    + Add Verified Claim
                  </button>
                </div>
              </div>
            </div>

            {/* Reviewer Certification Controls */}
            <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/40 space-y-3">
              <p className="text-xs font-bold uppercase text-gray-500">
                Human Editorial Reviewer Certification
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Reviewer Name / Role
                  </label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={e => setReviewerName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                    Verification Notes
                  </label>
                  <input
                    type="text"
                    value={reviewerNotes}
                    onChange={e => setReviewerNotes(e.target.value)}
                    placeholder="e.g., Cross-checked against official CREA MLS® table"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-[#242626] dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Audit Trail */}
            {selectedStoryDetail.auditTrail &&
              selectedStoryDetail.auditTrail.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Verification Audit Trail
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {selectedStoryDetail.auditTrail.map(entry => (
                      <div
                        key={entry.id}
                        className="text-[11px] text-gray-600 dark:text-gray-400 flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-1"
                      >
                        <span>
                          <strong className="text-[#242626] dark:text-white">
                            {entry.actor}
                          </strong>
                          : {entry.action} — {entry.notes}
                        </span>
                        <span className="text-gray-400 shrink-0">
                          {new Date(entry.timestamp).toLocaleString('en-CA')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            <div className="flex flex-wrap justify-between items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCompleteHumanVerification(selectedStoryDetail)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Certify Story as Verified
                </button>
                <button
                  onClick={() =>
                    handleStatusChangeAttempt(selectedStoryDetail, 'Needs Correction')
                  }
                  className="px-3 py-2 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                >
                  Flag Needs Correction
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedStoryDetail(null)}
                  className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const story = selectedStoryDetail;
                    setSelectedStoryDetail(null);
                    onSelectStoryForStudio(story);
                  }}
                  className="px-4 py-2 rounded-lg bg-[#F20000] hover:bg-[#D00000] text-white text-xs font-semibold"
                >
                  Open in AI Content Studio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Story Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1E2022] rounded-2xl max-w-2xl w-full p-6 border border-gray-200 dark:border-gray-800 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-lg font-bold font-['Poppins'] text-[#242626] dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#F20000]" />
                Log Canadian Real Estate Story
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Headline *
                </label>
                <input
                  type="text"
                  required
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  placeholder="e.g., CMHC Reports Housing Starts Surge 11% in Alberta"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Source Name
                  </label>
                  <input
                    type="text"
                    value={sourceName}
                    onChange={e => setSourceName(e.target.value)}
                    placeholder="CMHC / CREA / Globe and Mail"
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Original Source URL
                  </label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={e => setSourceUrl(e.target.value)}
                    placeholder="https://www.cmhc-schl.gc.ca"
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value as EditorialCategory)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                  >
                    {EDITORIAL_CATEGORIES.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Region
                  </label>
                  <select
                    value={region}
                    onChange={e => setRegion(e.target.value as CanadianRegion)}
                    className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                  >
                    {CANADIAN_REGIONS.map(r => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Executive Summary
                </label>
                <textarea
                  rows={2}
                  value={summary}
                  onChange={e => setSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Why This Matters to Canadian REALTORS®
                </label>
                <textarea
                  rows={2}
                  value={realtorImpactSummary}
                  onChange={e => setRealtorImpactSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Initial Candidate Claims (One per line — will require human verification)
                </label>
                <textarea
                  rows={3}
                  value={factsText}
                  onChange={e => setFactsText(e.target.value)}
                  placeholder="Fact 1&#10;Fact 2&#10;Fact 3"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Numeric Data Points (Comma-separated)
                </label>
                <input
                  type="text"
                  value={dataPointsText}
                  onChange={e => setDataPointsText(e.target.value)}
                  placeholder="+11% Starts, 245,000 Annualized Pace"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-[#242626] dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">
                    REALTOR® Relevance (1-25)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={realtorRelevance}
                    onChange={e => setRealtorRelevance(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">
                    News Importance (1-20)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newsImportance}
                    onChange={e => setNewsImportance(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500">
                    Timeliness (1-20)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={timeliness}
                    onChange={e => setTimeliness(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                </div>
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
                  Save Story to Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
