import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateEditorialScore } from './scoring.ts';
import { validateV8Caption } from './v8rules.ts';
import { convertTorontoToColombo, getMonthCalendarGrid } from './timezone.ts';
import {
  normalizeArticleUrl,
  findDuplicateStory,
  validatePublicationDate,
  classifyCanadianRealEstateArticle
} from './newsQuality.ts';

test('calculateEditorialScore computes total score, priority tier, and publication readiness accurately', () => {
  const highInput = {
    realtorRelevance: 23,
    newsImportance: 18,
    timeliness: 18,
    audienceInterest: 14,
    sourceReliability: 14,
    originalAngle: 5
  };
  const highRes = calculateEditorialScore(highInput);
  assert.equal(highRes.total, 92);
  assert.equal(highRes.priority, 'High priority');
  assert.equal(highRes.canPublish(true), true);
  assert.equal(highRes.canPublish(false), false);

  const mediumInput = {
    realtorRelevance: 15,
    newsImportance: 12,
    timeliness: 12,
    audienceInterest: 9,
    sourceReliability: 9,
    originalAngle: 3
  };
  const medRes = calculateEditorialScore(mediumInput);
  assert.equal(medRes.total, 60);
  assert.equal(medRes.priority, 'Needs review');
});

test('validateV8Caption enforces 250-350 words, 5 non-empty paragraphs, 10 unique hashtags, and #realtyPRESS', () => {
  const makeParagraph = (wordCount: number) =>
    Array.from({ length: wordCount }, (_, i) => `word${i + 1}`).join(' ');

  // 5 paragraphs of 55 words each = 275 words
  const validCaption = [
    makeParagraph(55),
    makeParagraph(55),
    makeParagraph(55),
    makeParagraph(55),
    makeParagraph(55)
  ].join('\n\n');

  const validHashtags = [
    '#realtyPRESS',
    '#CanadianRealEstate',
    '#CREA',
    '#TorontoRealEstate',
    '#VancouverRealEstate',
    '#CanadianHousing',
    '#REALTOR',
    '#MortgageRatesCanada',
    '#RealEstateNews',
    '#PropertyInvestment'
  ];

  const validResult = validateV8Caption(validCaption, validHashtags, { verifiedClaimsCount: 3 });
  assert.equal(validResult.isValid, true);
  assert.equal(validResult.wordCount, 275);
  assert.equal(validResult.paragraphCount, 5);
  assert.equal(validResult.hashtagCount, 10);
  assert.equal(validResult.hasBrandHashtag, true);
  assert.equal(validResult.duplicateHashtags.length, 0);

  // Test duplicate hashtags and missing #realtyPRESS
  const invalidHashtags = [
    '#CREA',
    '#crea',
    '#CanadianRealEstate',
    '#TorontoRealEstate',
    '#VancouverRealEstate',
    '#CanadianHousing',
    '#REALTOR',
    '#MortgageRatesCanada',
    '#RealEstateNews',
    '#PropertyInvestment'
  ];
  const dupResult = validateV8Caption(validCaption, invalidHashtags, { verifiedClaimsCount: 2 });
  assert.equal(dupResult.isValid, false);
  assert.equal(dupResult.hasBrandHashtag, false);
  assert.ok(dupResult.duplicateHashtags.length > 0);
});

test('convertTorontoToColombo accurately handles EDT (UTC-4) vs EST (UTC-5) and date rollovers', () => {
  // July 15 is Eastern Daylight Time (EDT, UTC-4). Colombo is UTC+5:30 (+9h 30m ahead of EDT).
  // 09:00 EDT -> 18:30 Colombo same day
  const summer = convertTorontoToColombo('2026-07-15', '09:00');
  assert.equal(summer.colomboTime, '18:30');
  assert.equal(summer.colomboDate, '2026-07-15');

  // November 15 is Eastern Standard Time (EST, UTC-5). Colombo is UTC+5:30 (+10h 30m ahead of EST).
  // 09:00 EST -> 19:30 Colombo same day
  const winter = convertTorontoToColombo('2026-11-15', '09:00');
  assert.equal(winter.colomboTime, '19:30');
  assert.equal(winter.colomboDate, '2026-11-15');

  // Late evening rollover: 16:00 EST on Nov 15 -> 02:30 AM on Nov 16 in Colombo (+1 day)
  const rollover = convertTorontoToColombo('2026-11-15', '16:00');
  assert.equal(rollover.colomboTime, '02:30');
  assert.equal(rollover.colomboDate, '2026-11-16');

  const grid = getMonthCalendarGrid(2026, 10);
  assert.ok(grid.length >= 28 && grid.length <= 42);
});

test('newsQuality utilities normalize URLs, detect duplicates, and flag outdated (>30d) articles', () => {
  const url1 = 'https://www.crea.ca/housing-market-stats/?utm_source=facebook&fbclid=123/';
  const url2 = 'https://crea.ca/housing-market-stats';
  assert.equal(normalizeArticleUrl(url1), normalizeArticleUrl(url2));

  const existing: any[] = [
    {
      id: 'st-1',
      originalHeadline: 'Bank of Canada Holds Overnight Rate at 3.25% in Ottawa Decision',
      proposedHeadline: 'Bank of Canada Holds Overnight Rate at 3.25% in Ottawa Decision',
      sourceUrl: url2
    }
  ];

  const dupByUrl = findDuplicateStory('Different Headline', url1, existing);
  assert.ok(dupByUrl);
  assert.equal(dupByUrl?.id, 'st-1');

  const dupByHeadline = findDuplicateStory(
    'Bank of Canada Holds Overnight Rate at 3.25% in Ottawa Decision!',
    'https://other.ca/news',
    existing
  );
  assert.ok(dupByHeadline);

  const oldDateCheck = validatePublicationDate('2024-01-01');
  assert.equal(oldDateCheck.isValid, true);
  assert.equal(oldDateCheck.isOutdated, true);

  const classified = classifyCanadianRealEstateArticle(
    'Bank of Canada announces overnight interest rate hold affecting Toronto mortgage renewals',
    'The central bank held its policy rate steady.'
  );
  assert.equal(classified.category, 'Mortgage & Finance');
  assert.equal(classified.province, 'Ontario (GTA & Golden Horseshoe)');
  assert.ok(classified.realtorRelevanceScore >= 17);
});
