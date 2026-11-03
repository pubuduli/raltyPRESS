export type EditorialCategory =
  | 'Canadian Housing Market'
  | 'Government Housing Policy'
  | 'REALTOR® Industry'
  | 'Brokerage Business'
  | 'Property Development'
  | 'Rental Housing'
  | 'Mortgage & Finance'
  | 'Real Estate Regulation'
  | 'Property Investment'
  | 'Real Estate Technology & AI';

export const EDITORIAL_CATEGORIES: EditorialCategory[] = [
  'Canadian Housing Market',
  'Government Housing Policy',
  'REALTOR® Industry',
  'Brokerage Business',
  'Property Development',
  'Rental Housing',
  'Mortgage & Finance',
  'Real Estate Regulation',
  'Property Investment',
  'Real Estate Technology & AI'
];

export type CanadianRegion =
  | 'National / Canada-Wide'
  | 'Ontario (GTA & Golden Horseshoe)'
  | 'British Columbia (Metro Vancouver & Island)'
  | 'Alberta (Calgary & Edmonton)'
  | 'Quebec (Greater Montreal)'
  | 'Nova Scotia & Atlantic Canada'
  | 'Manitoba & Saskatchewan'
  | 'Northern Territories';

export const CANADIAN_REGIONS: CanadianRegion[] = [
  'National / Canada-Wide',
  'Ontario (GTA & Golden Horseshoe)',
  'British Columbia (Metro Vancouver & Island)',
  'Alberta (Calgary & Edmonton)',
  'Quebec (Greater Montreal)',
  'Nova Scotia & Atlantic Canada',
  'Manitoba & Saskatchewan',
  'Northern Territories'
];

export type StoryStatus =
  | 'Discovered'
  | 'Research Pending'
  | 'Researching'
  | 'Research Completed'
  | 'Awaiting Verification'
  | 'Verification Pending'
  | 'Verified'
  | 'Selected'
  | 'In Production'
  | 'Awaiting Approval'
  | 'Approved'
  | 'Scheduled'
  | 'Published'
  | 'Rejected'
  | 'Archived';

export type VerificationStatus =
  | 'Unverified'
  | 'Research in Progress'
  | 'Under Verification'
  | 'Evidence Collected'
  | 'Awaiting Human Review'
  | 'Verified'
  | 'Rejected'
  | 'Needs Correction'
  | 'Debunked';

export const VERIFICATION_STATES: VerificationStatus[] = [
  'Unverified',
  'Research in Progress',
  'Evidence Collected',
  'Awaiting Human Review',
  'Verified',
  'Rejected',
  'Needs Correction'
];

export interface ClaimSource {
  sourceName: string;
  sourceUrl: string;
  publicationDate: string;
  evidenceExcerpt: string;
}

export interface ClaimEvidence {
  id: string;
  claimText: string;
  supportingSource: string;
  sourceUrl: string;
  publicationDate: string;
  evidenceExcerpt: string;
  additionalSources?: ClaimSource[];
  verificationStatus: VerificationStatus;
  reviewer: string;
  verificationTimestamp?: string;
  reviewerNotes: string;
}

export interface EditorialApprovalChecklist {
  headlineAccuracy: boolean;
  sourceCredibility: boolean;
  publicationDateValid: boolean;
  numericalAccuracy: boolean;
  namesAndOrgAccuracy: boolean;
  canadianGeographicRelevance: boolean;
  contextAndInterpretation: boolean;
  noMisleadingClaims: boolean;
  originalSourceLinks: boolean;
  contentQuality: boolean;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  previousState?: string;
  newState?: string;
  notes: string;
}

export interface Story {
  id: string;
  originalHeadline: string;
  proposedHeadline: string;
  sourceUrl: string;
  sourcePublicationName: string;
  publicationDate: string;
  dateDiscovered: string;
  category: EditorialCategory;
  province: CanadianRegion;
  cityOrRegion?: string;
  articleSummary: string;
  verifiedFacts: string[];
  statistics: string[];
  industryImplications: string[];
  realtorRelevanceNotes: string;
  claimsEvidence?: ClaimEvidence[];
  editorialChecklist?: EditorialApprovalChecklist;
  auditTrail?: AuditLogEntry[];
  editorialScore: number;
  scoreBreakdown: {
    realtorRelevance: number; // 25
    newsImportance: number;   // 20
    timeliness: number;       // 20
    audienceInterest: number; // 15
    sourceReliability: number;// 15
    originalAngle: number;    // 5
  };
  scoreAuditNotes?: string;
  verificationStatus: VerificationStatus;
  editorialStatus: StoryStatus;
  assignedFormats: string[];
  internalNotes: string;
  duplicateOfId?: string;
  isSampleData?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredNewsItem {
  id: string;
  headline: string;
  summary: string;
  url: string;
  normalizedUrl: string;
  publisher: string;
  publicationDate: string | null;
  isOutdated: boolean;
  province: CanadianRegion;
  city?: string;
  category: EditorialCategory;
  whyItMatters: string;
  supportingFacts: string[];
  researchStatus: 'Discovered' | 'Research Pending' | 'Research Completed' | 'Awaiting Verification' | 'Verified' | 'Rejected' | 'Archived';
  relevanceScore: number;
  reliabilityScore: number;
  discoveryTimestamp: string;
  discoveryMethod: 'RSS Feed' | 'Google Search Grounding' | 'Manual Entry';
  duplicateOfStoryId?: string;
}

export interface NewsSource {
  id: string;
  name: string;
  type: 'Primary' | 'Secondary' | 'Trade';
  url: string;
  rssUrl?: string;
  category: string;
  reliabilityScore: number; // 1-15
  enabled: boolean;
  notes: string;
  lastChecked: string;
}

export type ContentFormat =
  | 'News Caption'
  | 'Facebook Post'
  | 'LinkedIn Post'
  | 'Instagram Caption'
  | 'Short-Form News Summary'
  | 'Editorial Analysis'
  | 'Educational Content'
  | 'Carousel'
  | 'News Infographic Brief'
  | 'Reel Script'
  | 'Reel Caption'
  | 'Facebook Stories'
  | 'Discussion Post'
  | 'Weekly Roundup'
  | 'Headline Variations';

export interface ContentDraft {
  id: string;
  storyId?: string;
  repurposedFromPostId?: string;
  title: string;
  format: ContentFormat;
  targetPlatform: 'Facebook' | 'LinkedIn' | 'Instagram' | 'Multi-platform';
  headline: string;
  content: string;
  linkedInContent?: string;
  instagramContent?: string;
  shortSummaryContent?: string;
  infographicCopy?: string;
  callToAction: string;
  hashtags: string[];
  sourceAttribution: string;
  tone: string;
  wordCount: number;
  audience: string;
  modelUsed?: string;
  v8Validation: {
    isValid: boolean;
    wordCountValid: boolean;
    paragraphCountValid: boolean;
    hashtagCountValid: boolean;
    hasBrandHashtag: boolean;
    issues: string[];
  };
  status: 'Draft' | 'Editorial Review' | 'Awaiting Approval' | 'Approved' | 'Rejected';
  isSampleData?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  storyId?: string;
  draftId?: string;
  title: string;
  type: 'image' | 'video' | 'carousel_slide' | 'infographic';
  aspectRatio: '4:5' | '9:16' | '1:1' | '16:9';
  templateStyle?: 'Breaking News' | 'Market Stat Callout' | 'Policy Alert' | 'Executive Quote';
  headline: string;
  headlinePosition?: 'bottom' | 'center' | 'top';
  headlineHighlightWords: string[];
  accentColor?: string;
  prompt: string;
  imageUrl?: string;
  assetOrigin?: 'Production Instructions Only' | 'Uploaded Media' | 'AI Generated Image' | 'Final Exported Asset';
  version: number;
  status: 'Draft' | 'Under Review' | 'Approved' | 'Rejected';
  qaChecklist: {
    aspectRatioCorrect: boolean;
    headlineCorrect: boolean;
    spellingCorrect: boolean;
    appropriateImage: boolean;
    redHighlightsCorrect: boolean;
    noUnwantedText: boolean;
    noWatermark: boolean;
    sourceAssociated: boolean;
  };
  isSampleData?: boolean;
  createdAt: string;
}

export interface ReelScene {
  sceneNumber: number;
  durationSeconds: number;
  visualInstructions: string;
  onScreenText: string;
  subtitleText: string;
  transitionNote?: string;
  promptNanoBanana: string;
  promptVeoSora: string;
}

export interface ReelScript {
  id: string;
  storyId?: string;
  draftId?: string;
  title: string;
  style: 'Professional Breaking-News' | 'Cinematic Real Estate' | 'Presenter-Style Explainer';
  durationSeconds: number;
  openingHook: string;
  narration: string;
  scenes: ReelScene[];
  closingQuestion: string;
  caption: string;
  hashtags: string[];
  audioMood: string;
  videoUrl?: string;
  productionStatus?: 'AI-Generated Script' | 'Production Instructions' | 'Uploaded Video Media' | 'Final Exported Reel';
  status: 'Draft' | 'Awaiting Approval' | 'Approved' | 'Published';
  isSampleData?: boolean;
  createdAt: string;
}

export type EditorialTheme =
  | 'Canada Real Estate Briefing'
  | 'Realty Explained'
  | 'Market Watch'
  | 'REALTOR Insider'
  | 'The Realty Roundup'
  | 'Community Stories'
  | 'Weekly Recap'
  | 'Mortgage Shockwave'
  | 'Federal Policy Deep Dive'
  | 'Development Frontier'
  | 'Commercial Shift'
  | 'Tech & PropTech Pulse'
  | 'Canadian Investor Playbook';

export const EDITORIAL_THEMES: EditorialTheme[] = [
  'Canada Real Estate Briefing',
  'Realty Explained',
  'Market Watch',
  'REALTOR Insider',
  'The Realty Roundup',
  'Community Stories',
  'Weekly Recap',
  'Mortgage Shockwave',
  'Federal Policy Deep Dive',
  'Development Frontier',
  'Commercial Shift',
  'Tech & PropTech Pulse',
  'Canadian Investor Playbook'
];

export interface CalendarEntry {
  id: string;
  title: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  timeZone: string;      // 'America/Toronto'
  platform?: 'Facebook' | 'LinkedIn' | 'Instagram' | 'Multi-platform';
  theme: EditorialTheme;
  format: string;
  category: EditorialCategory;
  storyId?: string;
  draftId?: string;
  mediaAssetId?: string;
  reelScriptId?: string;
  status: 'Planned' | 'In Production' | 'Awaiting Approval' | 'Approved' | 'Scheduled' | 'Published' | 'Cancelled';
  notes?: string;
  isSampleData?: boolean;
  createdAt: string;
}

export interface ApprovalItem {
  id: string;
  contentType: 'Story' | 'Content Draft' | 'Media Asset' | 'Reel';
  targetId: string;
  title: string;
  stage: 'Draft Generated' | 'Editorial Review' | 'Fact Verification' | 'Visual Review' | 'Final Approval' | 'Scheduled' | 'Published';
  status: 'Pending' | 'Approved' | 'Changes Requested' | 'Rejected';
  feedbackNotes?: string;
  reviewerName: string;
  submittedAt: string;
  decidedAt?: string;
  editorialChecklist?: EditorialApprovalChecklist;
  auditTrail?: AuditLogEntry[];
  isSampleData?: boolean;
}

export interface PublishedPost {
  id: string;
  title: string;
  platform: 'Facebook' | 'LinkedIn' | 'Instagram';
  format: string;
  category: EditorialCategory;
  storyId?: string;
  draftId?: string;
  publishedAt: string;
  caption: string;
  hashtags: string[];
  mediaUrl?: string;
  sourceUrl?: string;
  sourcePublication: string;
  reach: number;
  impressions?: number;
  views: number;
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
  reelWatchTimeSeconds?: number;
  followerConversions: number;
  dataSource?: 'Manual Entry' | 'CSV Import' | 'Sample Data';
  isSampleData?: boolean;
}

export interface AnalyticsRecord {
  date: string;
  platform?: 'Facebook' | 'LinkedIn' | 'Instagram';
  followers: number;
  netFollowers: number;
  reach: number;
  impressions?: number;
  views: number;
  reactions: number;
  comments: number;
  shares: number;
  pageVisits: number;
  followerConversions: number;
  dataSource?: 'Manual Entry' | 'CSV Import' | 'Sample Data';
  importedAt?: string;
  reportingPeriod?: string;
  isSampleData?: boolean;
}

export interface BackupRecord {
  id: string;
  label: string;
  createdAt: string;
  schemaVersion: number;
  appVersion: string;
  recordCounts: Record<string, number>;
  dataJson: string;
}

export interface ImportPreviewResult {
  isValid: boolean;
  schemaVersion: number;
  appVersion: string;
  exportDate: string;
  errors: string[];
  warnings: string[];
  tableSummary: {
    table: string;
    incomingCount: number;
    existingCount: number;
    toCreate: number;
    toUpdate: number;
    invalidRecords: number;
  }[];
  parsedData?: any;
}

export interface AppSettings {
  brandName: string;
  tagline: string;
  primaryColor: string;
  charcoalColor: string;
  defaultTimezone: string;
  secondaryTimezone: string;
  initialFollowers: number;
  currentFollowers: number;
  followerTarget90Day: number;
  monthlyGrowthObjective?: number;
  targetLaunchDate: string;
  targetAchievementDate: string;
  reportingPeriod: string;
  hasCompletedOnboarding: boolean;
  demoMode: boolean;
  aiModelPreference: string;
  enableThinkingMode: boolean;
  allowPaidModels: boolean;
  dailyAiRequestLimit: number;
  maxOutputTokens: number;
  lastBackupAt?: string;
}
