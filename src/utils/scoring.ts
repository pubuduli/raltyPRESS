export interface ScoreBreakdown {
  realtorRelevance: number; // Max 25
  newsImportance: number;   // Max 20
  timeliness: number;       // Max 20
  audienceInterest: number; // Max 15
  sourceReliability: number;// Max 15
  originalAngle: number;    // Max 5
}

export type PriorityLevel = 'High priority' | 'Suitable' | 'Needs review' | 'Low priority';

export function calculateEditorialScore(breakdown: ScoreBreakdown): {
  total: number;
  priority: PriorityLevel;
  canPublish: (isVerified: boolean) => boolean;
} {
  const rel = Math.max(0, Math.min(25, breakdown.realtorRelevance || 0));
  const imp = Math.max(0, Math.min(20, breakdown.newsImportance || 0));
  const time = Math.max(0, Math.min(20, breakdown.timeliness || 0));
  const aud = Math.max(0, Math.min(15, breakdown.audienceInterest || 0));
  const src = Math.max(0, Math.min(15, breakdown.sourceReliability || 0));
  const ang = Math.max(0, Math.min(5, breakdown.originalAngle || 0));

  const total = rel + imp + time + aud + src + ang;

  let priority: PriorityLevel = 'Low priority';
  if (total >= 80) {
    priority = 'High priority';
  } else if (total >= 65) {
    priority = 'Suitable';
  } else if (total >= 50) {
    priority = 'Needs review';
  } else {
    priority = 'Low priority';
  }

  // Editorial rule: A story with unverified central facts cannot be marked ready for publication
  const canPublish = (isVerified: boolean): boolean => {
    return isVerified && total >= 50;
  };

  return { total, priority, canPublish };
}
