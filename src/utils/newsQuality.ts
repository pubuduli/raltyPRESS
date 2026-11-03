import type { EditorialCategory, CanadianRegion, Story } from '../types';

/**
 * Normalizes an article URL by stripping tracking parameters (utm_*, fbclid, gclid),
 * lowercasing hostname, and removing trailing slashes.
 */
export function normalizeArticleUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'mc_cid',
      'mc_eid',
      'ref'
    ];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (!cleanPath) cleanPath = '';
    const query = parsed.searchParams.toString();
    return `${parsed.protocol}//${parsed.hostname}${cleanPath}${query ? `?${query}` : ''}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Normalizes a headline for duplicate comparison
 */
export function normalizeHeadlineForComparison(headline: string): string {
  return (headline || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|a|an|in|on|of|for|to|and|as|at|by)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether a candidate headline or URL duplicates an existing story
 */
export function findDuplicateStory(
  candidateHeadline: string,
  candidateUrl: string,
  existingStories: Story[],
  excludeStoryId?: string
): Story | undefined {
  const normUrl = normalizeArticleUrl(candidateUrl);
  const normHead = normalizeHeadlineForComparison(candidateHeadline);

  for (const story of existingStories) {
    if (excludeStoryId && story.id === excludeStoryId) continue;

    if (normUrl && normUrl.length > 12) {
      const existingNormUrl = normalizeArticleUrl(story.sourceUrl);
      if (existingNormUrl && existingNormUrl === normUrl) {
        return story;
      }
    }

    if (normHead && normHead.length > 15) {
      const existingNormProp = normalizeHeadlineForComparison(story.proposedHeadline);
      const existingNormOrig = normalizeHeadlineForComparison(story.originalHeadline);
      if (existingNormProp === normHead || existingNormOrig === normHead) {
        return story;
      }
    }
  }

  return undefined;
}

/**
 * Validates a publication date string and checks whether the article is outdated (> 30 days old).
 */
export function validatePublicationDate(
  pubDateStr?: string,
  referenceDate: Date = new Date()
): {
  isValid: boolean;
  normalizedDate: string | null;
  isOutdated: boolean;
  daysOld: number | null;
} {
  if (!pubDateStr || !pubDateStr.trim()) {
    return { isValid: false, normalizedDate: null, isOutdated: false, daysOld: null };
  }

  const parsed = new Date(pubDateStr);
  if (isNaN(parsed.getTime())) {
    return { isValid: false, normalizedDate: null, isOutdated: false, daysOld: null };
  }

  const y = parsed.getUTCFullYear();
  const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const d = String(parsed.getUTCDate()).padStart(2, '0');
  const normalizedDate = `${y}-${m}-${d}`;

  const diffMs = referenceDate.getTime() - parsed.getTime();
  const daysOld = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const isOutdated = daysOld > 30;

  return {
    isValid: true,
    normalizedDate,
    isOutdated,
    daysOld
  };
}

/**
 * Classifies category and region from headline + summary keywords for discovered Canadian news
 */
export function classifyCanadianRealEstateArticle(
  headline: string,
  summary: string
): {
  category: EditorialCategory;
  province: CanadianRegion;
  realtorRelevanceScore: number;
  whyItMatters: string;
} {
  const text = `${headline} ${summary}`.toLowerCase();

  let category: EditorialCategory = 'Canadian Housing Market';
  if (/(mortgage|bank of canada|interest rate|bond yield|lending|osfi|stress test|refinanc)/.test(text)) {
    category = 'Mortgage & Finance';
  } else if (/(crea|realtor|brokerage|commission|mls|listing|agent|trreb|rebgv|creb)/.test(text)) {
    category = 'REALTOR® Industry';
  } else if (/(reco|bcfsa|regulation|compliance|tresa|cooling-off|audit|disclosure|rule)/.test(text)) {
    category = 'Real Estate Regulation';
  } else if (/(rental|tenant|landlord|vacancy|purpose-built|rent)/.test(text)) {
    category = 'Rental Housing';
  } else if (/(zoning|housing starts|construction|developer|builder|permit|multiplex|fourplex)/.test(text)) {
    category = 'Property Development';
  } else if (/(minister|federal|provincial|legislation|grant|tax|subsidy|policy|bill)/.test(text)) {
    category = 'Government Housing Policy';
  } else if (/(proptech|artificial intelligence|\bai\b|software|digital|virtual)/.test(text)) {
    category = 'Real Estate Technology & AI';
  } else if (/(investor|cap rate|reit|multi-family|commercial|cash flow)/.test(text)) {
    category = 'Property Investment';
  }

  let province: CanadianRegion = 'National / Canada-Wide';
  if (/(ontario|toronto|gta|ottawa|hamilton|mississauga|reco|trreb)/.test(text)) {
    province = 'Ontario (GTA & Golden Horseshoe)';
  } else if (/(british columbia|\bbc\b|vancouver|victoria|surrey|kelowna|bcfsa)/.test(text)) {
    province = 'British Columbia (Metro Vancouver & Island)';
  } else if (/(alberta|calgary|edmonton|creb)/.test(text)) {
    province = 'Alberta (Calgary & Edmonton)';
  } else if (/(quebec|montreal|laval)/.test(text)) {
    province = 'Quebec (Greater Montreal)';
  } else if (/(nova scotia|halifax|new brunswick|pei|newfoundland|atlantic)/.test(text)) {
    province = 'Nova Scotia & Atlantic Canada';
  } else if (/(manitoba|winnipeg|saskatchewan|regina|saskatoon)/.test(text)) {
    province = 'Manitoba & Saskatchewan';
  }

  // Calculate relevance score (out of 25)
  let relevance = 17;
  if (/(realtor|crea|mls|mortgage|bank of canada|cmhc|inventory|sales|benchmark)/.test(text)) {
    relevance += 5;
  }
  if (/(canada|canadian|toronto|vancouver|calgary|montreal|ottawa|ontario|bc|alberta)/.test(text)) {
    relevance += 2;
  }
  relevance = Math.min(25, relevance);

  const whyItMattersMap: Record<EditorialCategory, string> = {
    'Canadian Housing Market': 'Impacts local comparative market analyses (CMAs), listing inventory expectations, and buyer consultations.',
    'Mortgage & Finance': 'Directly alters buyer qualification thresholds, mortgage renewal discussions, and purchasing power.',
    'REALTOR® Industry': 'Affects daily brokerage operations, MLS listing standards, and professional practice.',
    'Brokerage Business': 'Informs brokerage recruitment, team structures, and competitive market positioning.',
    'Property Development': 'Signals future housing supply pipelines, pre-construction advisory, and infill zoning opportunities.',
    'Rental Housing': 'Shapes investor cap-rate calculations, tenant regulations, and rental supply dynamics.',
    'Government Housing Policy': 'Changes tax rules, municipal zoning entitlements, and buyer/homeowner incentives.',
    'Real Estate Regulation': 'Mandatory compliance update for licensed registrants, disclosures, and fiduciary duties.',
    'Property Investment': 'Guides portfolio allocation, interprovincial migration tracking, and multi-unit returns.',
    'Real Estate Technology & AI': 'Highlights emerging tools for listing marketing, lead workflows, and property valuation.'
  };

  return {
    category,
    province,
    realtorRelevanceScore: relevance,
    whyItMatters: whyItMattersMap[category]
  };
}
