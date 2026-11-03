import Dexie, { type Table } from 'dexie';
import type {
  Story,
  NewsSource,
  ContentDraft,
  MediaAsset,
  ReelScript,
  CalendarEntry,
  ApprovalItem,
  PublishedPost,
  AnalyticsRecord,
  AppSettings,
  BackupRecord,
  ImportPreviewResult,
  DiscoveredNewsItem
} from '../types';

export const CURRENT_SCHEMA_VERSION = 2;
export const APP_VERSION = '2.0.0';

export class RealtyPressDatabase extends Dexie {
  stories!: Table<Story, string>;
  sources!: Table<NewsSource, string>;
  contentDrafts!: Table<ContentDraft, string>;
  mediaAssets!: Table<MediaAsset, string>;
  reelScripts!: Table<ReelScript, string>;
  calendarEntries!: Table<CalendarEntry, string>;
  approvals!: Table<ApprovalItem, string>;
  publishedPosts!: Table<PublishedPost, string>;
  analyticsRecords!: Table<AnalyticsRecord, string>;
  settings!: Table<{ key: string; value: any }, string>;
  backups!: Table<BackupRecord, string>;
  discoveredNews!: Table<DiscoveredNewsItem, string>;

  constructor() {
    super('RealtyPressMediaStudioDB');

    this.version(1).stores({
      stories: 'id, editorialStatus, verificationStatus, category, editorialScore, createdAt',
      sources: 'id, name, type, enabled',
      contentDrafts: 'id, storyId, format, status, targetPlatform, createdAt',
      mediaAssets: 'id, storyId, status, type, createdAt',
      reelScripts: 'id, storyId, style, status, createdAt',
      calendarEntries: 'id, scheduledDate, status, theme, category',
      approvals: 'id, stage, status, contentType, targetId',
      publishedPosts: 'id, platform, category, publishedAt',
      analyticsRecords: 'date',
      settings: 'key'
    });

    this.version(CURRENT_SCHEMA_VERSION)
      .stores({
        stories: 'id, editorialStatus, verificationStatus, category, editorialScore, isSampleData, createdAt',
        sources: 'id, name, type, enabled',
        contentDrafts: 'id, storyId, repurposedFromPostId, format, status, targetPlatform, isSampleData, createdAt',
        mediaAssets: 'id, storyId, status, type, isSampleData, createdAt',
        reelScripts: 'id, storyId, style, status, isSampleData, createdAt',
        calendarEntries: 'id, scheduledDate, status, theme, category, isSampleData',
        approvals: 'id, stage, status, contentType, targetId, isSampleData',
        publishedPosts: 'id, platform, category, publishedAt, isSampleData',
        analyticsRecords: 'date, isSampleData',
        settings: 'key',
        backups: 'id, createdAt, schemaVersion',
        discoveredNews: 'id, normalizedUrl, category, researchStatus, discoveryTimestamp'
      })
      .upgrade(async tx => {
        // Safe migration: ensure settings has demoMode & new fields without deleting any user records
        const existing = await tx.table('settings').get('app_settings');
        if (existing && existing.value) {
          await tx.table('settings').put({
            key: 'app_settings',
            value: {
              ...DEFAULT_APP_SETTINGS,
              ...existing.value,
              demoMode: existing.value.demoMode ?? false,
              allowPaidModels: false
            }
          });
        }
      });
  }
}

export const db = new RealtyPressDatabase();

// Official Canadian Real Estate News & Regulatory Sources (with RSS feeds where available)
export const INITIAL_SOURCES: NewsSource[] = [
  {
    id: 'SRC-CREA',
    name: 'Canadian Real Estate Association (CREA)',
    type: 'Primary',
    url: 'https://crea.ca',
    rssUrl: 'https://news.google.com/rss/search?q=site:crea.ca+OR+"Canadian+Real+Estate+Association"&hl=en-CA&gl=CA&ceid=CA:en',
    category: 'REALTOR® Industry',
    reliabilityScore: 15,
    enabled: true,
    notes: 'Official national resale housing stats, MLS Home Price Index and government relations.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  },
  {
    id: 'SRC-CMHC',
    name: 'Canada Mortgage and Housing Corporation (CMHC)',
    type: 'Primary',
    url: 'https://cmhc-schl.gc.ca',
    rssUrl: 'https://news.google.com/rss/search?q=site:cmhc-schl.gc.ca+OR+"CMHC"+housing&hl=en-CA&gl=CA&ceid=CA:en',
    category: 'Canadian Housing Market',
    reliabilityScore: 15,
    enabled: true,
    notes: 'National housing starts, rental market reports and mortgage loan insurance trends.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  },
  {
    id: 'SRC-BOC',
    name: 'Bank of Canada (BoC)',
    type: 'Primary',
    url: 'https://bankofcanada.ca',
    rssUrl: 'https://www.bankofcanada.ca/content_type/press-releases/feed/',
    category: 'Mortgage & Finance',
    reliabilityScore: 15,
    enabled: true,
    notes: 'Overnight interest rate announcements, monetary policy reports and inflation indexes.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  },
  {
    id: 'SRC-STATSCAN',
    name: 'Statistics Canada (StatCan)',
    type: 'Primary',
    url: 'https://statcan.gc.ca',
    rssUrl: 'https://news.google.com/rss/search?q="Statistics+Canada"+housing+OR+building+permits&hl=en-CA&gl=CA&ceid=CA:en',
    category: 'Canadian Housing Market',
    reliabilityScore: 15,
    enabled: true,
    notes: 'Demographic population inflows, building permits and CPI shelter component data.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  },
  {
    id: 'SRC-OSFI',
    name: 'Office of the Superintendent of Financial Institutions (OSFI)',
    type: 'Primary',
    url: 'https://osfi-bsif.gc.ca',
    rssUrl: 'https://news.google.com/rss/search?q="OSFI"+mortgage+OR+stress+test+Canada&hl=en-CA&gl=CA&ceid=CA:en',
    category: 'Real Estate Regulation',
    reliabilityScore: 15,
    enabled: true,
    notes: 'B-20 mortgage stress testing guidelines and banking liquidity guidelines.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  },
  {
    id: 'SRC-RECO',
    name: 'Real Estate Council of Ontario (RECO)',
    type: 'Primary',
    url: 'https://reco.on.ca',
    rssUrl: 'https://news.google.com/rss/search?q="Real+Estate+Council+of+Ontario"+OR+TRESA+Ontario&hl=en-CA&gl=CA&ceid=CA:en',
    category: 'Real Estate Regulation',
    reliabilityScore: 14,
    enabled: true,
    notes: 'TRESA compliance, open bidding rules and registrant consumer protection.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  },
  {
    id: 'SRC-BCFSA',
    name: 'BC Financial Services Authority (BCFSA)',
    type: 'Primary',
    url: 'https://bcfsa.ca',
    rssUrl: 'https://news.google.com/rss/search?q="BCFSA"+OR+"BC+real+estate"+regulation&hl=en-CA&gl=CA&ceid=CA:en',
    category: 'Real Estate Regulation',
    reliabilityScore: 14,
    enabled: true,
    notes: 'BC real estate licensing, cooling-off rescission regulations and strata insurance.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  },
  {
    id: 'SRC-GLOBE',
    name: 'The Globe and Mail (Real Estate)',
    type: 'Secondary',
    url: 'https://theglobeandmail.com/real-estate',
    rssUrl: 'https://news.google.com/rss/search?q=site:theglobeandmail.com+real+estate+housing&hl=en-CA&gl=CA&ceid=CA:en',
    category: 'Canadian Housing Market',
    reliabilityScore: 13,
    enabled: true,
    notes: 'Investigative housing features, luxury markets and urban planning policy.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  },
  {
    id: 'SRC-FP',
    name: 'Financial Post Real Estate',
    type: 'Secondary',
    url: 'https://financialpost.com/category/real-estate',
    rssUrl: 'https://news.google.com/rss/search?q=site:financialpost.com+real+estate+OR+mortgage&hl=en-CA&gl=CA&ceid=CA:en',
    category: 'Mortgage & Finance',
    reliabilityScore: 13,
    enabled: true,
    notes: 'Mortgage rate outlooks, lender profitability and REIT analysis.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  },
  {
    id: 'SRC-REM',
    name: 'Real Estate Magazine (REM Online)',
    type: 'Trade',
    url: 'https://realestatemagazine.ca',
    rssUrl: 'https://news.google.com/rss/search?q="Canadian+real+estate"+REALTOR+brokerage&hl=en-CA&gl=CA&ceid=CA:en',
    category: 'REALTOR® Industry',
    reliabilityScore: 13,
    enabled: true,
    notes: 'Trade news for Canadian REALTORS, brokerage mergers and PropTech developments.',
    lastChecked: new Date().toISOString().slice(0, 16).replace('T', ' ')
  }
];

// Demonstration Sample Stories (ONLY used when Demo Mode is explicitly enabled; never treated as verified real news)
export const SAMPLE_STORIES: Story[] = [
  {
    id: 'DEMO-RP-001',
    originalHeadline: '[DEMO SAMPLE] CMHC Reports National Housing Starts Climbed 4.2% Led by Urban Multi-Family Towers',
    proposedHeadline: 'CANADIAN HOUSING STARTS REBOUND 4.2% AS MULTI-FAMILY PROJECTS DRIVE URBAN METROS',
    sourceUrl: 'https://cmhc-schl.gc.ca/en/media-newsroom/news-releases/housing-starts-sample',
    sourcePublicationName: 'Canada Mortgage and Housing Corporation (CMHC) — Demo Sample',
    publicationDate: '2026-11-02',
    dateDiscovered: '2026-11-02',
    category: 'Canadian Housing Market',
    province: 'National / Canada-Wide',
    articleSummary: '[DEMONSTRATION RECORD] Illustrative CMHC monthly housing starts summary showing seasonally adjusted annual rates and purpose-built rental momentum across Toronto, Vancouver, and Calgary.',
    verifiedFacts: [
      'Sample Claim: Total housing starts in October increased 4.2% month-over-month.',
      'Sample Claim: Urban multi-unit construction gained 6.1%.'
    ],
    statistics: [
      'Sample Stat: +4.2% MoM housing starts',
      'Sample Stat: +6.1% urban multi-family starts'
    ],
    industryImplications: [
      'Rental supply pipeline illustration for multi-unit developments.',
      'Detached single-family scarcity illustration for suburban markets.'
    ],
    realtorRelevanceNotes: 'Demonstration record showing how REALTOR talking points are structured.',
    claimsEvidence: [
      {
        id: 'CLM-DEMO-1',
        claimText: 'Total housing starts increased 4.2% month-over-month.',
        supportingSource: 'CMHC Monthly Housing Starts Demo Release',
        sourceUrl: 'https://cmhc-schl.gc.ca',
        publicationDate: '2026-11-02',
        evidenceExcerpt: 'Seasonally adjusted annual rate rose 4.2% in urban centres.',
        verificationStatus: 'Awaiting Human Review',
        reviewer: 'Demo Reviewer',
        reviewerNotes: 'Sample demonstration claim — not verified real-world news.'
      }
    ],
    editorialScore: 90,
    scoreBreakdown: {
      realtorRelevance: 24,
      newsImportance: 18,
      timeliness: 18,
      audienceInterest: 13,
      sourceReliability: 14,
      originalAngle: 3
    },
    verificationStatus: 'Awaiting Human Review',
    editorialStatus: 'Awaiting Verification',
    assignedFormats: ['Facebook Post', 'Reel'],
    internalNotes: 'DEMO RECORD ONLY — Enable or disable Demo Mode in Settings at any time.',
    isSampleData: true,
    createdAt: '2026-11-02T10:00:00Z',
    updatedAt: '2026-11-03T08:15:00Z'
  },
  {
    id: 'DEMO-RP-002',
    originalHeadline: '[DEMO SAMPLE] Bank of Canada Policy Rate Hold & Mortgage Renewal Outlook',
    proposedHeadline: 'BANK OF CANADA HOLDS BENCHMARK RATE AS MORTGAGE BORROWERS ASSESS RENEWAL OPTIONS',
    sourceUrl: 'https://bankofcanada.ca/press-releases-sample',
    sourcePublicationName: 'Bank of Canada (BoC) — Demo Sample',
    publicationDate: '2026-10-28',
    dateDiscovered: '2026-10-29',
    category: 'Mortgage & Finance',
    province: 'National / Canada-Wide',
    articleSummary: '[DEMONSTRATION RECORD] Illustrative monetary policy briefing for Canadian real estate professionals.',
    verifiedFacts: [
      'Sample Claim: Overnight rate target held steady in demonstration scenario.'
    ],
    statistics: [
      'Sample Stat: 5-year fixed bond yields eased 18 bps in sample period'
    ],
    industryImplications: [
      'Renewing mortgage borrowers evaluate fixed vs variable terms.'
    ],
    realtorRelevanceNotes: 'Demonstration record for mortgage advisory workflows.',
    editorialScore: 85,
    scoreBreakdown: {
      realtorRelevance: 22,
      newsImportance: 18,
      timeliness: 16,
      audienceInterest: 13,
      sourceReliability: 14,
      originalAngle: 2
    },
    verificationStatus: 'Evidence Collected',
    editorialStatus: 'Research Completed',
    assignedFormats: ['Facebook Post'],
    internalNotes: 'DEMO RECORD ONLY — Not real-world verified news.',
    isSampleData: true,
    createdAt: '2026-10-29T11:30:00Z',
    updatedAt: '2026-11-03T07:45:00Z'
  }
];

export const SAMPLE_DRAFTS: ContentDraft[] = [
  {
    id: 'DEMO-DFT-001',
    storyId: 'DEMO-RP-001',
    title: '[DEMO] CMHC Housing Starts 5-Paragraph V8 Caption',
    format: 'Facebook Post',
    targetPlatform: 'Facebook',
    headline: 'CANADIAN HOUSING STARTS REBOUND 4.2% AS MULTI-FAMILY PROJECTS DRIVE URBAN METROS',
    content: `Canadian housing starts climbed 4.2 percent in October according to the latest nationwide benchmark figures released by the Canada Mortgage and Housing Corporation. The unexpected uptick in urban multi-family starts provided fresh momentum across key metropolitan centres including Toronto, Vancouver, Montreal, and Calgary, signalling resilience in developer project financing despite elevated borrowing costs across commercial lending institutions.

Mortgage qualification hurdles and sustained interest rate pressures from the Bank of Canada have forced many prospective first-time home buyers to delay purchasing decisions. Consequently, demand has concentrated heavily across purpose-built rental developments and mid-tier condominium projects, rapidly realigning municipal construction permits with shifting demographic and immigration requirements across provinces.

For licensed real estate professionals and REALTORS across provincial jurisdictions, this comprehensive construction data indicates that regional supply pipelines will remain noticeably fragmented throughout early 2027. Persistent inventory shortages in detached single-family homes will likely continue, sustaining competitive multiple-offer bidding environments in well-connected suburban transit corridors.

Industry economists and policy analysts emphasize that while headline housing starts expanded modestly, actual project completions and future groundbreakings remain constrained by municipal zoning delays, skilled labour bottlenecks, and municipal development charge tariffs. Development stakeholders continue urging federal and provincial housing ministers to harmonize infrastructure subsidies and aggressively streamline bureaucratic approval cadences.

Navigating these multi-layered economic crosswinds requires Canadian real estate brokerages to equip their agents with hyper-local transactional data, timely market context, and realistic mortgage financing assessments. Tracking regional housing supply trends and interest rate expectations will remain the defining competitive advantage for practitioners advising buyers and sellers over the coming quarters.

#realtyPRESS #CanadianRealEstate #CREA #HousingMarket #RealEstateNews #MortgageRates #TorontoRealEstate #VancouverRealEstate #RealtorLife #HousingSupply`,
    linkedInContent: `[DEMO] Canadian housing starts climbed 4.2% in October, driven by urban multi-family developments in Toronto, Vancouver, and Calgary.\n\n#realtyPRESS #CanadianRealEstate #CREA #RealEstateEconomics`,
    callToAction: 'How are housing starts shaping buyer sentiment and listing inventory in your trading area? Share your perspective in the comments below.',
    hashtags: [
      '#realtyPRESS',
      '#CanadianRealEstate',
      '#CREA',
      '#HousingMarket',
      '#RealEstateNews',
      '#MortgageRates',
      '#TorontoRealEstate',
      '#VancouverRealEstate',
      '#RealtorLife',
      '#HousingSupply'
    ],
    sourceAttribution: 'CMHC Demo Dataset',
    tone: 'News-media editorial, objective, authoritative Canadian English',
    wordCount: 268,
    audience: 'Canadian REALTORS®, mortgage brokers, housing developers and property investors',
    modelUsed: 'Demo Sample',
    v8Validation: {
      isValid: true,
      wordCountValid: true,
      paragraphCountValid: true,
      hashtagCountValid: true,
      hasBrandHashtag: true,
      issues: []
    },
    status: 'Awaiting Approval',
    isSampleData: true,
    createdAt: '2026-11-03T07:30:00Z',
    updatedAt: '2026-11-03T08:15:00Z'
  }
];

export const SAMPLE_MEDIA: MediaAsset[] = [
  {
    id: 'DEMO-MED-001',
    storyId: 'DEMO-RP-001',
    draftId: 'DEMO-DFT-001',
    title: '[DEMO] V8 4:5 Housing Starts Urban Skyrise Concept',
    type: 'image',
    aspectRatio: '4:5',
    templateStyle: 'Breaking News',
    headline: 'CANADIAN HOUSING STARTS REBOUND 4.2% AS MULTI-FAMILY PROJECTS DRIVE URBAN METROS',
    headlinePosition: 'bottom',
    headlineHighlightWords: ['REBOUND 4.2%', 'MULTI-FAMILY'],
    accentColor: '#F20000',
    prompt: 'Ultra-realistic editorial photo of modern Canadian high-rise residential construction crane in downtown Toronto at golden hour, dusk lighting, glass reflections, architectural realism, full-bleed photography, heavy black gradient at the bottom 35 percent for editorial text overlay, Poppins Black typography, no watermark, no logos, 35mm lens, f/2.8',
    imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f8?auto=format&fit=crop&w=1200&q=80',
    assetOrigin: 'Production Instructions Only',
    version: 1,
    status: 'Under Review',
    qaChecklist: {
      aspectRatioCorrect: true,
      headlineCorrect: true,
      spellingCorrect: true,
      appropriateImage: true,
      redHighlightsCorrect: true,
      noUnwantedText: true,
      noWatermark: true,
      sourceAssociated: true
    },
    isSampleData: true,
    createdAt: '2026-11-03T07:45:00Z'
  }
];

export const SAMPLE_REEL: ReelScript = {
  id: 'DEMO-REL-001',
  storyId: 'DEMO-RP-001',
  title: '[DEMO] Realty Explained: Housing Starts Jump 4.2%',
  style: 'Professional Breaking-News',
  durationSeconds: 32,
  openingHook: 'Canadian housing starts just jumped 4.2 percent, but here is what most buyers and REALTORS are missing.',
  narration: 'While headline housing starts rose in October, the single-family segment remained flat. Over ninety percent of that momentum came from urban multi-unit towers.',
  scenes: [
    {
      sceneNumber: 1,
      durationSeconds: 5,
      visualInstructions: 'Fast zoom on Canadian skyline with active cranes under dusk lighting.',
      onScreenText: 'BREAKING: HOUSING STARTS +4.2%',
      subtitleText: 'Canadian housing starts just jumped 4.2 percent...',
      transitionNote: 'Hard cut on beat',
      promptNanoBanana: 'Drone shot zooming toward Toronto financial district with tower cranes, golden hour dusk, 9:16 vertical framing.',
      promptVeoSora: 'Cinematic drone shot descending toward high-rise construction site in Toronto during sunset, smooth camera movement.'
    },
    {
      sceneNumber: 2,
      durationSeconds: 15,
      visualInstructions: 'Split screen displaying multi-family high-rises versus single family suburban streets.',
      onScreenText: 'MULTI-FAMILY TOWERS UP +6.1%\nFREEHOLD HOMES REMAIN FLAT',
      subtitleText: 'While headline starts rose, detached housing stayed flat...',
      transitionNote: 'Split wipe transition',
      promptNanoBanana: 'Split frame: modern concrete condo tower on left, traditional suburban Canadian neighbourhood on right, 9:16.',
      promptVeoSora: 'Smooth pan comparing high-density residential towers and quiet suburban residential streets.'
    },
    {
      sceneNumber: 3,
      durationSeconds: 12,
      visualInstructions: 'Final branding screen with call-to-action question.',
      onScreenText: 'HOW WILL THIS AFFECT YOUR MARKET?\nCOMMENT BELOW',
      subtitleText: 'How is supply affecting your local market? Let us know below.',
      transitionNote: 'Fade to charcoal end card',
      promptNanoBanana: 'Minimalist editorial graphic background with red accent line and dark charcoal aesthetic, 9:16 vertical.',
      promptVeoSora: 'Clean dark background with subtle light streak across the frame, modern media broadcast style.'
    }
  ],
  closingQuestion: 'Are you seeing more buyer interest in new multi-family pre-construction or existing resale? Tell us in the comments.',
  caption: `[DEMO] Canadian housing starts climbed 4.2% in October.\n\n#realtyPRESS #CanadianRealEstate #CREA #RealtyExplained`,
  hashtags: ['#realtyPRESS', '#CanadianRealEstate', '#CREA', '#RealtyExplained'],
  audioMood: 'Urgent, professional broadcast news synth bed',
  productionStatus: 'AI-Generated Script',
  status: 'Draft',
  isSampleData: true,
  createdAt: '2026-11-03T08:20:00Z'
};

export const INITIAL_CALENDAR_ENTRIES: CalendarEntry[] = [
  {
    id: 'DEMO-CAL-001',
    title: '[DEMO] Monday Canada Real Estate Briefing: Housing Starts',
    scheduledDate: new Date().toISOString().slice(0, 10),
    scheduledTime: '08:00',
    timeZone: 'America/Toronto',
    platform: 'Facebook',
    theme: 'Canada Real Estate Briefing',
    format: 'Facebook Post',
    category: 'Canadian Housing Market',
    storyId: 'DEMO-RP-001',
    draftId: 'DEMO-DFT-001',
    mediaAssetId: 'DEMO-MED-001',
    status: 'Scheduled',
    notes: 'Demonstration calendar slot at 08:00 America/Toronto.',
    isSampleData: true,
    createdAt: new Date().toISOString()
  }
];

export const SAMPLE_APPROVALS: ApprovalItem[] = [
  {
    id: 'DEMO-APP-001',
    contentType: 'Content Draft',
    targetId: 'DEMO-DFT-001',
    title: '[DEMO] CMHC Housing Starts 5-Paragraph V8 Caption',
    stage: 'Editorial Review',
    status: 'Pending',
    feedbackNotes: 'Demonstration review item.',
    reviewerName: 'Editorial Desk',
    submittedAt: new Date().toISOString(),
    isSampleData: true
  }
];

export const SAMPLE_PUBLISHED_POSTS: PublishedPost[] = [
  {
    id: 'DEMO-PUB-001',
    title: '[DEMO] CREA National Sales Volume Briefing',
    platform: 'Facebook',
    format: 'Facebook Post',
    category: 'Canadian Housing Market',
    storyId: 'DEMO-RP-001',
    publishedAt: new Date().toISOString(),
    caption: `Early regional resale statistics from across Canadian real estate boards point toward a modest firming of sales activity as borrowing costs moderate. Major provincial associations report that buyer inquiry volume rose for the second straight month, indicating that consumer confidence is stabilizing after consecutive policy rate adjustments.

Urban centres including the Greater Toronto Area and Metro Vancouver demonstrated noticeable increases in showings, particularly within the mid-range townhome and semi-detached property categories. In contrast, luxury detached properties continue to experience prolonged days on market as high-net-worth buyers await further macroeconomic clarity.

For practicing REALTORS, the emerging transaction pattern emphasizes the importance of accurate price positioning from day one. Properties priced realistically against recent 30-day comparable sales are securing firm contracts, whereas speculative list prices frequently face steep price reductions after four weeks on market.

Supply metrics reveal that new listings have kept pace with sales absorption, preserving balanced market conditions across central Canada. Mortgage pre-approvals locked in during earlier rate cuts have prompted motivated purchasers to execute transactions prior to winter slowdowns.

As market dynamics transition toward 2027, brokerages that provide transparent market data and strategic negotiation counsel will continue to capture dominant client loyalty. Maintaining disciplined pricing guidance remains essential in today's balanced transaction climate.

#realtyPRESS #CanadianRealEstate #CREA #RealEstateNews #HousingMarket #TorontoRealEstate #VancouverRealEstate #MortgageRates #RealtorLife #HousingData`,
    hashtags: [
      '#realtyPRESS',
      '#CanadianRealEstate',
      '#CREA',
      '#RealEstateNews',
      '#HousingMarket',
      '#TorontoRealEstate',
      '#VancouverRealEstate',
      '#MortgageRates',
      '#RealtorLife',
      '#HousingData'
    ],
    mediaUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80',
    sourceUrl: 'https://crea.ca/statistics',
    sourcePublication: 'Canadian Real Estate Association (CREA) — Demo Sample',
    reach: 3420,
    impressions: 4510,
    views: 4190,
    reactions: 142,
    comments: 28,
    shares: 41,
    saves: 19,
    followerConversions: 24,
    dataSource: 'Sample Data',
    isSampleData: true
  }
];

export const INITIAL_ANALYTICS: AnalyticsRecord[] = [
  {
    date: '2026-11-01',
    platform: 'Facebook',
    followers: 750,
    netFollowers: 10,
    reach: 2100,
    impressions: 2650,
    views: 2540,
    reactions: 85,
    comments: 14,
    shares: 19,
    pageVisits: 92,
    followerConversions: 10,
    dataSource: 'Sample Data',
    isSampleData: true
  },
  {
    date: '2026-11-02',
    platform: 'Facebook',
    followers: 764,
    netFollowers: 14,
    reach: 2890,
    impressions: 3420,
    views: 3740,
    reactions: 126,
    comments: 22,
    shares: 31,
    pageVisits: 138,
    followerConversions: 14,
    dataSource: 'Sample Data',
    isSampleData: true
  },
  {
    date: '2026-11-03',
    platform: 'Facebook',
    followers: 779,
    netFollowers: 15,
    reach: 3100,
    impressions: 3890,
    views: 3950,
    reactions: 135,
    comments: 25,
    shares: 35,
    pageVisits: 150,
    followerConversions: 15,
    dataSource: 'Sample Data',
    isSampleData: true
  }
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  brandName: 'realtyPRESS',
  tagline: 'Canadian Real Estate News & Industry Insights',
  primaryColor: '#F20000',
  charcoalColor: '#242626',
  defaultTimezone: 'America/Toronto',
  secondaryTimezone: 'Asia/Colombo',
  initialFollowers: 0,
  currentFollowers: 0,
  followerTarget90Day: 10000,
  monthlyGrowthObjective: 3333,
  targetLaunchDate: new Date().toISOString().slice(0, 10),
  targetAchievementDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  reportingPeriod: 'Last 30 Days',
  hasCompletedOnboarding: false,
  demoMode: false,
  aiModelPreference: 'gemini-3.8-flash',
  enableThinkingMode: false,
  allowPaidModels: false,
  dailyAiRequestLimit: 50,
  maxOutputTokens: 2048
};

/**
 * Production Initialization:
 * NEVER auto-seeds fabricated demo stories, drafts, or analytics.
 * Only ensures official Canadian news source directory and default settings exist.
 * Also cleans up legacy unflagged sample records from v1 if demoMode is false.
 */
export async function initializeDatabase(): Promise<AppSettings> {
  const sourcesCount = await db.sources.count();
  if (sourcesCount === 0) {
    await db.sources.bulkPut(INITIAL_SOURCES);
  } else {
    // Ensure RSS URLs are populated on default sources
    for (const src of INITIAL_SOURCES) {
      const existing = await db.sources.get(src.id);
      if (existing && !existing.rssUrl && src.rssUrl) {
        await db.sources.update(src.id, { rssUrl: src.rssUrl });
      }
    }
  }

  // Tag any legacy v1 seeded analytics records (2026-10-21 .. 2026-11-03 with exact v1 followers) as sample data
  const legacyAnalytics = await db.analyticsRecords.toArray();
  for (const rec of legacyAnalytics) {
    if (rec.isSampleData === undefined && (rec.followers === 730 || rec.followers === 895 || rec.reach === 3100)) {
      await db.analyticsRecords.update(rec.date, { isSampleData: true, dataSource: 'Sample Data' });
    }
  }

  const existingSettings = await db.settings.get('app_settings');
  if (!existingSettings || !existingSettings.value) {
    await db.settings.put({ key: 'app_settings', value: DEFAULT_APP_SETTINGS });
    return DEFAULT_APP_SETTINGS;
  } else {
    const merged: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      ...existingSettings.value,
      allowPaidModels: existingSettings.value.allowPaidModels ?? false,
      demoMode: existingSettings.value.demoMode ?? false
    };
    // If legacy v1 hardcoded initialFollowers=730 was never manually updated and demoMode is false, reset to 0 unless user has real analytics
    const realAnalyticsCount = await db.analyticsRecords.filter(a => !a.isSampleData).count();
    if (!merged.demoMode && realAnalyticsCount === 0 && merged.initialFollowers === 730) {
      merged.initialFollowers = 0;
      merged.currentFollowers = 0;
    }
    await db.settings.put({ key: 'app_settings', value: merged });
    return merged;
  }
}

/**
 * Helper functions to retrieve records respecting Demo Mode isolation.
 * When demoMode is false, sample records (isSampleData === true) are excluded.
 */
export async function getActiveSettings(): Promise<AppSettings> {
  const rec = await db.settings.get('app_settings');
  return rec?.value ? { ...DEFAULT_APP_SETTINGS, ...rec.value } : DEFAULT_APP_SETTINGS;
}

export async function getOperationalStories(demoMode: boolean): Promise<Story[]> {
  const all = await db.stories.toArray();
  return demoMode ? all : all.filter(item => !item.isSampleData);
}

export async function getOperationalDrafts(demoMode: boolean): Promise<ContentDraft[]> {
  const all = await db.contentDrafts.toArray();
  return demoMode ? all : all.filter(item => !item.isSampleData);
}

export async function getOperationalMedia(demoMode: boolean): Promise<MediaAsset[]> {
  const all = await db.mediaAssets.toArray();
  return demoMode ? all : all.filter(item => !item.isSampleData);
}

export async function getOperationalReels(demoMode: boolean): Promise<ReelScript[]> {
  const all = await db.reelScripts.toArray();
  return demoMode ? all : all.filter(item => !item.isSampleData);
}

export async function getOperationalCalendar(demoMode: boolean): Promise<CalendarEntry[]> {
  const all = await db.calendarEntries.toArray();
  return demoMode ? all : all.filter(item => !item.isSampleData);
}

export async function getOperationalApprovals(demoMode: boolean): Promise<ApprovalItem[]> {
  const all = await db.approvals.toArray();
  return demoMode ? all : all.filter(item => !item.isSampleData);
}

export async function getOperationalPublished(demoMode: boolean): Promise<PublishedPost[]> {
  const all = await db.publishedPosts.toArray();
  return demoMode ? all : all.filter(item => !item.isSampleData);
}

export async function getOperationalAnalytics(demoMode: boolean): Promise<AnalyticsRecord[]> {
  const all = await db.analyticsRecords.toArray();
  return demoMode ? all : all.filter(item => !item.isSampleData);
}

/**
 * Enable Demo Mode: loads clearly labeled demonstration records without touching production records
 */
export async function enableDemoMode(): Promise<void> {
  const settings = await getActiveSettings();
  await db.settings.put({
    key: 'app_settings',
    value: { ...settings, demoMode: true }
  });

  const hasDemoStories = await db.stories.filter(s => s.isSampleData === true).count();
  if (hasDemoStories === 0) {
    await db.stories.bulkPut(SAMPLE_STORIES);
    await db.contentDrafts.bulkPut(SAMPLE_DRAFTS);
    await db.mediaAssets.bulkPut(SAMPLE_MEDIA);
    await db.reelScripts.put(SAMPLE_REEL);
    await db.calendarEntries.bulkPut(INITIAL_CALENDAR_ENTRIES);
    await db.approvals.bulkPut(SAMPLE_APPROVALS);
    await db.publishedPosts.bulkPut(SAMPLE_PUBLISHED_POSTS);
    await db.analyticsRecords.bulkPut(INITIAL_ANALYTICS);
  }
}

/**
 * Disable Demo Mode: hides all demo records immediately while preserving production data
 */
export async function disableDemoMode(): Promise<void> {
  const settings = await getActiveSettings();
  await db.settings.put({
    key: 'app_settings',
    value: { ...settings, demoMode: false }
  });
}

/**
 * Permanently delete all demo/sample records across all tables while preserving production records.
 * Never reseeds on refresh!
 */
export async function clearAllSampleData(): Promise<void> {
  await db.stories.filter(s => s.isSampleData === true).delete();
  await db.contentDrafts.filter(d => d.isSampleData === true).delete();
  await db.mediaAssets.filter(m => m.isSampleData === true).delete();
  await db.reelScripts.filter(r => r.isSampleData === true).delete();
  await db.calendarEntries.filter(c => c.isSampleData === true).delete();
  await db.approvals.filter(a => a.isSampleData === true).delete();
  await db.publishedPosts.filter(p => p.isSampleData === true).delete();
  await db.analyticsRecords.filter(a => a.isSampleData === true).delete();

  const settings = await getActiveSettings();
  await db.settings.put({
    key: 'app_settings',
    value: { ...settings, demoMode: false }
  });
}

export async function reloadSampleData(): Promise<void> {
  await clearAllSampleData();
  await enableDemoMode();
}

/**
 * Export complete database with schema version and timestamp
 */
export async function exportDatabaseToJson(): Promise<string> {
  const data = {
    exportDate: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: APP_VERSION,
    app: 'realtyPRESS AI MEDIA STUDIO',
    stories: await db.stories.toArray(),
    sources: await db.sources.toArray(),
    contentDrafts: await db.contentDrafts.toArray(),
    mediaAssets: await db.mediaAssets.toArray(),
    reelScripts: await db.reelScripts.toArray(),
    calendarEntries: await db.calendarEntries.toArray(),
    approvals: await db.approvals.toArray(),
    publishedPosts: await db.publishedPosts.toArray(),
    analyticsRecords: await db.analyticsRecords.toArray(),
    discoveredNews: await db.discoveredNews.toArray(),
    settings: await db.settings.toArray()
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Create an automatic or manual snapshot in the internal `backups` recovery table
 */
export async function createAutomaticBackup(label = 'Manual Backup Snapshot'): Promise<BackupRecord> {
  const dataJson = await exportDatabaseToJson();
  const parsed = JSON.parse(dataJson);
  const recordCounts: Record<string, number> = {
    stories: parsed.stories?.length || 0,
    sources: parsed.sources?.length || 0,
    contentDrafts: parsed.contentDrafts?.length || 0,
    mediaAssets: parsed.mediaAssets?.length || 0,
    reelScripts: parsed.reelScripts?.length || 0,
    calendarEntries: parsed.calendarEntries?.length || 0,
    approvals: parsed.approvals?.length || 0,
    publishedPosts: parsed.publishedPosts?.length || 0,
    analyticsRecords: parsed.analyticsRecords?.length || 0
  };

  const now = new Date().toISOString();
  const backup: BackupRecord = {
    id: `BKP-${Date.now()}`,
    label,
    createdAt: now,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    recordCounts,
    dataJson
  };

  await db.backups.put(backup);

  const settings = await getActiveSettings();
  await db.settings.put({
    key: 'app_settings',
    value: { ...settings, lastBackupAt: now }
  });

  return backup;
}

/**
 * Validates a backup JSON string and returns a complete preview BEFORE modifying any database records.
 */
export async function validateAndPreviewImport(jsonString: string): Promise<ImportPreviewResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tableSummary: ImportPreviewResult['tableSummary'] = [];

  let data: any;
  try {
    data = JSON.parse(jsonString);
  } catch (e: any) {
    return {
      isValid: false,
      schemaVersion: 0,
      appVersion: 'unknown',
      exportDate: '',
      errors: [`Malformed JSON file: ${e.message}`],
      warnings: [],
      tableSummary: []
    };
  }

  if (!data || typeof data !== 'object') {
    errors.push('Backup payload must be a valid JSON object.');
  }

  if (data?.app !== 'realtyPRESS AI MEDIA STUDIO') {
    errors.push('Invalid application signature: expected "realtyPRESS AI MEDIA STUDIO".');
  }

  const schemaVersion = Number(data?.schemaVersion || 1);
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(
      `Backup schema version (${schemaVersion}) is newer than this application supports (${CURRENT_SCHEMA_VERSION}).`
    );
  }

  const tablesConfig: {
    key: string;
    primaryKey: string;
    requiredFields: string[];
    dbTable: Table<any, string>;
  }[] = [
    { key: 'stories', primaryKey: 'id', requiredFields: ['id', 'proposedHeadline'], dbTable: db.stories },
    { key: 'sources', primaryKey: 'id', requiredFields: ['id', 'name'], dbTable: db.sources },
    { key: 'contentDrafts', primaryKey: 'id', requiredFields: ['id', 'title', 'content'], dbTable: db.contentDrafts },
    { key: 'mediaAssets', primaryKey: 'id', requiredFields: ['id', 'title'], dbTable: db.mediaAssets },
    { key: 'reelScripts', primaryKey: 'id', requiredFields: ['id', 'title'], dbTable: db.reelScripts },
    { key: 'calendarEntries', primaryKey: 'id', requiredFields: ['id', 'title', 'scheduledDate'], dbTable: db.calendarEntries },
    { key: 'approvals', primaryKey: 'id', requiredFields: ['id', 'targetId', 'contentType'], dbTable: db.approvals },
    { key: 'publishedPosts', primaryKey: 'id', requiredFields: ['id', 'title', 'platform'], dbTable: db.publishedPosts },
    { key: 'analyticsRecords', primaryKey: 'date', requiredFields: ['date', 'followers'], dbTable: db.analyticsRecords },
    { key: 'settings', primaryKey: 'key', requiredFields: ['key', 'value'], dbTable: db.settings }
  ];

  for (const cfg of tablesConfig) {
    const incomingArr = data?.[cfg.key];
    const existingRecords = await cfg.dbTable.toArray();
    const existingKeys = new Set(existingRecords.map((r: any) => String(r[cfg.primaryKey])));

    if (incomingArr === undefined) {
      warnings.push(`Table "${cfg.key}" not present in backup file (will be skipped).`);
      continue;
    }

    if (!Array.isArray(incomingArr)) {
      errors.push(`Table "${cfg.key}" must be an array.`);
      continue;
    }

    let toCreate = 0;
    let toUpdate = 0;
    let invalidRecords = 0;

    for (const row of incomingArr) {
      if (!row || typeof row !== 'object') {
        invalidRecords++;
        continue;
      }
      const hasAllRequired = cfg.requiredFields.every(f => row[f] !== undefined && row[f] !== null && row[f] !== '');
      if (!hasAllRequired) {
        invalidRecords++;
        continue;
      }
      const pkVal = String(row[cfg.primaryKey]);
      if (existingKeys.has(pkVal)) {
        toUpdate++;
      } else {
        toCreate++;
      }
    }

    if (invalidRecords > 0) {
      warnings.push(`Table "${cfg.key}" contains ${invalidRecords} invalid record(s) missing required fields.`);
    }

    tableSummary.push({
      table: cfg.key,
      incomingCount: incomingArr.length,
      existingCount: existingRecords.length,
      toCreate,
      toUpdate,
      invalidRecords
    });
  }

  return {
    isValid: errors.length === 0,
    schemaVersion,
    appVersion: data?.version || '1.0.0',
    exportDate: data?.exportDate || 'Unknown',
    errors,
    warnings,
    tableSummary,
    parsedData: errors.length === 0 ? data : undefined
  };
}

/**
 * Executes a validated import inside a single safe Dexie transaction AFTER creating an automatic recovery backup.
 * Supports 'merge' (upserts valid records, preserving existing non-conflicting records) or 'replace' (replaces tables after validation).
 */
export async function executeValidatedImport(
  preview: ImportPreviewResult,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ success: boolean; message: string; backupId?: string }> {
  if (!preview.isValid || !preview.parsedData) {
    return {
      success: false,
      message: `Cannot execute import: validation failed (${preview.errors.join('; ')})`
    };
  }

  // 1. Always create an automatic recovery backup before modifying any table
  const autoBackup = await createAutomaticBackup(`Pre-Import Recovery (${mode.toUpperCase()})`);
  const data = preview.parsedData;

  const filterValid = (arr: any[], reqFields: string[]) => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      row => row && typeof row === 'object' && reqFields.every(f => row[f] !== undefined && row[f] !== null && row[f] !== '')
    );
  };

  try {
    await db.transaction(
      'rw',
      [
        db.stories,
        db.sources,
        db.contentDrafts,
        db.mediaAssets,
        db.reelScripts,
        db.calendarEntries,
        db.approvals,
        db.publishedPosts,
        db.analyticsRecords,
        db.settings
      ],
      async () => {
        const ops: { arr: any[]; req: string[]; table: Table<any, string> }[] = [
          { arr: data.stories, req: ['id', 'proposedHeadline'], table: db.stories },
          { arr: data.sources, req: ['id', 'name'], table: db.sources },
          { arr: data.contentDrafts, req: ['id', 'title', 'content'], table: db.contentDrafts },
          { arr: data.mediaAssets, req: ['id', 'title'], table: db.mediaAssets },
          { arr: data.reelScripts, req: ['id', 'title'], table: db.reelScripts },
          { arr: data.calendarEntries, req: ['id', 'title', 'scheduledDate'], table: db.calendarEntries },
          { arr: data.approvals, req: ['id', 'targetId', 'contentType'], table: db.approvals },
          { arr: data.publishedPosts, req: ['id', 'title', 'platform'], table: db.publishedPosts },
          { arr: data.analyticsRecords, req: ['date', 'followers'], table: db.analyticsRecords },
          { arr: data.settings, req: ['key', 'value'], table: db.settings }
        ];

        for (const op of ops) {
          if (Array.isArray(op.arr)) {
            const validRows = filterValid(op.arr, op.req);
            if (mode === 'replace') {
              await op.table.clear();
            }
            if (validRows.length > 0) {
              await op.table.bulkPut(validRows);
            }
          }
        }
      }
    );

    return {
      success: true,
      backupId: autoBackup.id,
      message: `Database successfully imported (${mode} mode). Recovery snapshot ${autoBackup.id} saved.`
    };
  } catch (err: any) {
    return {
      success: false,
      backupId: autoBackup.id,
      message: `Transaction rolled back due to error: ${err.message}. Existing database preserved.`
    };
  }
}

/**
 * Backwards-compatible wrapper that validates first before importing in merge mode
 */
export async function importDatabaseFromJson(jsonString: string): Promise<{ success: boolean; message: string }> {
  const preview = await validateAndPreviewImport(jsonString);
  if (!preview.isValid) {
    return {
      success: false,
      message: preview.errors.join(' ')
    };
  }
  return executeValidatedImport(preview, 'merge');
}

export function convertToCsv(items: any[]): string {
  if (!items || items.length === 0) return '';
  const headers = Object.keys(items[0]);
  const csvRows = [
    headers.join(','),
    ...items.map(row =>
      headers
        .map(fieldName => {
          const val = row[fieldName];
          const serialized =
            typeof val === 'object' && val !== null ? JSON.stringify(val).replace(/"/g, '""') : String(val ?? '');
          return `"${serialized.replace(/"/g, '""')}"`;
        })
        .join(',')
    )
  ];
  return csvRows.join('\r\n');
}
