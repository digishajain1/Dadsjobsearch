import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOpportunity, dedupeAndRank, inferLocationBucket } from '../scripts/opportunity-utils.mjs';

test('classifyOpportunity marks executive telecom roles as relevant', () => {
  const result = classifyOpportunity({
    title: 'Vice President - Telecom Infrastructure',
    company: 'Acme Networks',
    location: 'Mumbai, India',
    description: 'Lead data center and telecom growth strategy.'
  });

  assert.equal(result.isRelevant, true);
  assert.equal(result.searchType, 'executive');
  assert.equal(result.locationBucket, 'Mumbai');
  assert.ok(result.score > 0);
});

test('classifyOpportunity separates board roles', () => {
  const result = classifyOpportunity({
    title: 'Board Advisor - Digital Infrastructure',
    company: 'Example Infra',
    location: 'Remote',
    description: 'Advise the board on telecom and data center expansion.'
  });

  assert.equal(result.isRelevant, true);
  assert.equal(result.searchType, 'board');
});

test('inferLocationBucket prefers remote and india hints', () => {
  assert.equal(inferLocationBucket('Remote - India'), 'Remote');
  assert.equal(inferLocationBucket('Bengaluru, India'), 'India');
});

test('dedupeAndRank preserves firstSeenAt from previous data', () => {
  const previous = new Map([
    [
      'vice-president-telecom-infrastructure::acme-networks::https-example-com-role',
      { firstSeenAt: '2026-01-01T00:00:00.000Z' }
    ]
  ]);

  const ranked = dedupeAndRank(
    [
      {
        title: 'Vice President Telecom Infrastructure',
        company: 'Acme Networks',
        url: 'https://example.com/role',
        score: 10,
        publishedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    previous
  );

  assert.equal(ranked[0].firstSeenAt, '2026-01-01T00:00:00.000Z');
});
