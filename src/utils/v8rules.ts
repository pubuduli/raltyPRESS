export interface V8ValidationResult {
  isValid: boolean;
  wordCount: number;
  wordCountValid: boolean;
  paragraphCount: number;
  paragraphCountValid: boolean;
  hasEmptyParagraphs: boolean;
  hashtagCount: number;
  hashtagCountValid: boolean;
  hasBrandHashtag: boolean;
  duplicateHashtags: string[];
  unsupportedClaimsWarning?: string;
  issues: string[];
}

export function validateV8Caption(
  caption: string,
  hashtags: string[] = [],
  options?: { verifiedClaimsCount?: number }
): V8ValidationResult {
  const issues: string[] = [];

  // Normalize line endings
  const normalized = (caption || '').replace(/\r\n/g, '\n');

  // Split into blocks by double line breaks
  const rawBlocks = normalized.split(/\n\s*\n/);

  // Separate narrative paragraphs from trailing hashtag block(s)
  const nonHashtagBlocks = rawBlocks.filter(b => {
    const trimmed = b.trim();
    if (!trimmed) return false;
    // A block that consists only of hashtags is the hashtag block, not a narrative paragraph
    const tokens = trimmed.split(/\s+/);
    const allHashtags = tokens.every(t => t.startsWith('#'));
    return !allHashtags;
  });

  // Check for empty paragraphs in between (e.g. triple/quadruple newlines with whitespace)
  const hasEmptyParagraphs = /\n\s*\n\s*\n/.test(normalized.trim());
  if (hasEmptyParagraphs) {
    issues.push('Caption contains empty paragraph spacing (use clean double line breaks between paragraphs)');
  }

  // Word count check: 250 - 350 words (excluding hashtags)
  const narrativeText = nonHashtagBlocks.join(' ');
  const words = narrativeText.trim()
    ? narrativeText
        .trim()
        .split(/\s+/)
        .filter(w => !w.startsWith('#') && w.replace(/[^a-zA-Z0-9]/g, '').length > 0)
    : [];
  const wordCount = words.length;
  const wordCountValid = wordCount >= 250 && wordCount <= 350;
  if (!wordCountValid) {
    if (wordCount < 250) {
      issues.push(`Word count is ${wordCount} (minimum is 250 words)`);
    } else {
      issues.push(`Word count is ${wordCount} (maximum is 350 words)`);
    }
  }

  // Exactly five readable paragraphs
  const paragraphCount = nonHashtagBlocks.length;
  const paragraphCountValid = paragraphCount === 5;
  if (!paragraphCountValid) {
    issues.push(`Found ${paragraphCount} paragraphs (realtyPRESS V8 requires exactly 5 paragraphs)`);
  }

  // Extract hashtags from caption if present, otherwise use passed hashtags array
  const captionMatches = normalized.match(/#[a-zA-Z0-9_]+/g);
  const rawHashtags: string[] =
    captionMatches && captionMatches.length > 0
      ? Array.from(captionMatches)
      : hashtags.filter(Boolean).map(h => (h.startsWith('#') ? h : `#${h}`));

  // Detect duplicate hashtags case-insensitively
  const seen = new Set<string>();
  const duplicateHashtags: string[] = [];
  const uniqueHashtags: string[] = [];

  for (const tag of rawHashtags) {
    const lower = tag.toLowerCase();
    if (seen.has(lower)) {
      if (!duplicateHashtags.includes(tag)) {
        duplicateHashtags.push(tag);
      }
    } else {
      seen.add(lower);
      uniqueHashtags.push(tag);
    }
  }

  if (duplicateHashtags.length > 0) {
    issues.push(`Duplicate hashtags detected: ${duplicateHashtags.join(', ')}`);
  }

  const hashtagCount = uniqueHashtags.length;
  const hashtagCountValid = hashtagCount === 10 && duplicateHashtags.length === 0;
  if (hashtagCount !== 10) {
    issues.push(`Found ${hashtagCount} unique hashtags (realtyPRESS V8 requires exactly 10 relevant hashtags)`);
  }

  const hasBrandHashtag = uniqueHashtags.some(h => h.toLowerCase() === '#realtypress');
  if (!hasBrandHashtag) {
    issues.push('Missing mandatory brand hashtag #realtyPRESS');
  }

  // Check for numerical claims when story has 0 verified claims
  let unsupportedClaimsWarning: string | undefined;
  const hasNumericalClaims = /\b\d+(\.\d+)?%|\$\d+|\b\d{1,3}(,\d{3})+\b/.test(narrativeText);
  if (options && options.verifiedClaimsCount === 0 && hasNumericalClaims) {
    unsupportedClaimsWarning =
      'Caption contains specific numerical or percentage figures, but the source story has 0 verified factual claims.';
    issues.push(unsupportedClaimsWarning);
  }

  const isValid =
    wordCountValid &&
    paragraphCountValid &&
    !hasEmptyParagraphs &&
    hashtagCountValid &&
    hasBrandHashtag &&
    !unsupportedClaimsWarning;

  return {
    isValid,
    wordCount,
    wordCountValid,
    paragraphCount,
    paragraphCountValid,
    hasEmptyParagraphs,
    hashtagCount,
    hashtagCountValid,
    hasBrandHashtag,
    duplicateHashtags,
    unsupportedClaimsWarning,
    issues
  };
}
