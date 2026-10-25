import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeExactProbabilities,
  drawWeightedBatch,
  executeGroupDrawEngine,
  INITIAL_GROUPS,
} from './drawEngine';
import { DrawItem, DrawRuleConfig } from '../types/draw';

const mockItems: DrawItem[] = [
  {
    id: 'a1',
    accessionNo: 'LOT-001',
    title: 'Alpha One',
    groupId: 'grp-curators',
    mediaType: 'text',
    weight: 3,
    status: 'available',
  },
  {
    id: 'a2',
    accessionNo: 'LOT-002',
    title: 'Alpha Two',
    groupId: 'grp-curators',
    mediaType: 'text',
    weight: 1,
    status: 'available',
  },
  {
    id: 'b1',
    accessionNo: 'LOT-003',
    title: 'Beta One',
    groupId: 'grp-digital',
    mediaType: 'text',
    weight: 2,
    status: 'available',
  },
  {
    id: 'b2',
    accessionNo: 'LOT-004',
    title: 'Beta Two',
    groupId: 'grp-digital',
    mediaType: 'text',
    weight: 2,
    status: 'available',
  },
];

test('computeExactProbabilities calculates exact relative weights and locked probabilities', () => {
  const probMap = computeExactProbabilities(mockItems, true);
  // Total weight = 3 + 1 + 2 + 2 = 8
  assert.equal(probMap.get('a1'), 3 / 8);
  assert.equal(probMap.get('a2'), 1 / 8);
  assert.equal(probMap.get('b1'), 2 / 8);

  // When weight engine is disabled, all items have equal probability
  const equalMap = computeExactProbabilities(mockItems, false);
  assert.equal(equalMap.get('a1'), 0.25);
  assert.equal(equalMap.get('a2'), 0.25);

  // When an item has fixedProbability = 0.5, remaining 0.5 is split by weight
  const withLocked: DrawItem[] = [
    { ...mockItems[0], fixedProbability: 0.5 }, // locked 50%
    { ...mockItems[1], weight: 1 },             // 1/3 of remaining 50%
    { ...mockItems[2], weight: 2 },             // 2/3 of remaining 50%
  ];
  const lockedMap = computeExactProbabilities(withLocked, true);
  assert.equal(lockedMap.get('a1'), 0.5);
  assert.ok(Math.abs((lockedMap.get('a2') ?? 0) - 0.5 / 3) < 1e-9);
  assert.ok(Math.abs((lockedMap.get('b1') ?? 0) - 1.0 / 3) < 1e-9);
});

test('drawWeightedBatch respects without-replacement and never duplicates items', () => {
  const groupMap = new Map(INITIAL_GROUPS.map((g) => [g.id, g]));
  const winners = drawWeightedBatch(
    mockItems,
    4,
    { allowReplacement: false, enableWeightEngine: true },
    groupMap
  );
  assert.equal(winners.length, 4);
  const uniqueIds = new Set(winners.map((w) => w.item.id));
  assert.equal(uniqueIds.size, 4);
});

test('executeGroupDrawEngine enforces GROUP_QUOTA per group', () => {
  const baseConfig: DrawRuleConfig = {
    allowReplacement: false,
    batchCount: 2,
    enableWeightEngine: true,
    groupStrategy: 'GROUP_QUOTA',
    selectedGroupIds: [],
    teamCount: 2,
    balanceGroupsAcrossTeams: true,
    modality: 'TAROT_MONOLITH',
    soundEnabled: false,
  };

  const customGroups = [
    { ...INITIAL_GROUPS[0], quota: 1 }, // grp-curators: draw 1
    { ...INITIAL_GROUPS[1], quota: 2 }, // grp-digital: draw 2
  ];

  const res = executeGroupDrawEngine(mockItems, customGroups, baseConfig);
  assert.ok(res.winners);
  assert.equal(res.winners.length, 3);
  const curatorWinners = res.winners.filter((w) => w.item.groupId === 'grp-curators');
  const digitalWinners = res.winners.filter((w) => w.item.groupId === 'grp-digital');
  assert.equal(curatorWinners.length, 1);
  assert.equal(digitalWinners.length, 2);
});

test('executeGroupDrawEngine partitions items into balanced teams in RANDOM_TEAMS mode', () => {
  const teamConfig: DrawRuleConfig = {
    allowReplacement: false,
    batchCount: 1,
    enableWeightEngine: true,
    groupStrategy: 'RANDOM_TEAMS',
    selectedGroupIds: [],
    teamCount: 2,
    balanceGroupsAcrossTeams: true,
    modality: 'TAROT_MONOLITH',
    soundEnabled: false,
  };

  const res = executeGroupDrawEngine(mockItems, INITIAL_GROUPS, teamConfig);
  assert.ok(res.teams);
  assert.equal(res.teams.length, 2);
  assert.equal(res.teams[0].members.length, 2);
  assert.equal(res.teams[1].members.length, 2);
});
