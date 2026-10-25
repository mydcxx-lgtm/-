import {
  CuratorialColorToken,
  DrawGroup,
  DrawItem,
  DrawRuleConfig,
  DrawnWinnerEntry,
  RandomTeamBucket,
} from '../types/draw';

/**
 * Cryptographically strong random float in [0, 1) with fallback for non-browser test environments
 */
export function secureRandom(): number {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    const array = new Uint32Array(2);
    globalThis.crypto.getRandomValues(array);
    const high = array[0] >>> 5;
    const low = array[1] >>> 6;
    return (high * 67108864 + low) / 9007199254740992;
  }
  return Math.random();
}

/**
 * Format accession code e.g. LOT-2026-001
 */
export function formatAccessionNo(index: number): string {
  return `LOT-${String(index).padStart(3, '0')}`;
}

/**
 * Compute exact mathematical probability distribution across candidate items.
 * Supports locked absolute probabilities (0~1) combined with relative weights.
 */
export function computeExactProbabilities(
  candidates: DrawItem[],
  enableWeight: boolean
): Map<string, number> {
  const probMap = new Map<string, number>();
  if (candidates.length === 0) return probMap;

  if (!enableWeight) {
    const equalProb = 1 / candidates.length;
    for (const item of candidates) {
      probMap.set(item.id, equalProb);
    }
    return probMap;
  }

  let lockedSum = 0;
  const lockedItems: DrawItem[] = [];
  const weightedItems: DrawItem[] = [];

  for (const item of candidates) {
    if (item.fixedProbability !== undefined && item.fixedProbability > 0) {
      lockedItems.push(item);
      lockedSum += item.fixedProbability;
    } else {
      weightedItems.push(item);
    }
  }

  // If locked probabilities reach or exceed 100%, normalize locked items and set others to 0
  if (lockedSum >= 1) {
    for (const item of lockedItems) {
      probMap.set(item.id, (item.fixedProbability || 0) / lockedSum);
    }
    for (const item of weightedItems) {
      probMap.set(item.id, 0);
    }
    return probMap;
  }

  const remainingProbability = 1 - lockedSum;
  for (const item of lockedItems) {
    probMap.set(item.id, item.fixedProbability!);
  }

  const totalWeight = weightedItems.reduce(
    (sum, item) => sum + Math.max(0, item.weight),
    0
  );

  if (totalWeight <= 0) {
    const fallback =
      weightedItems.length > 0 ? remainingProbability / weightedItems.length : 0;
    for (const item of weightedItems) {
      probMap.set(item.id, fallback);
    }
  } else {
    for (const item of weightedItems) {
      const p = (Math.max(0, item.weight) / totalWeight) * remainingProbability;
      probMap.set(item.id, p);
    }
  }

  return probMap;
}

/**
 * Weighted batch draw engine with or without replacement
 */
export function drawWeightedBatch(
  pool: DrawItem[],
  count: number,
  config: Pick<DrawRuleConfig, 'allowReplacement' | 'enableWeightEngine'>,
  groupMap: Map<string, DrawGroup>,
  rng: () => number = secureRandom
): DrawnWinnerEntry[] {
  const activePool = pool.filter((item) => item.status === 'available');
  if (activePool.length === 0 || count <= 0) return [];

  const targetCount = config.allowReplacement
    ? count
    : Math.min(count, activePool.length);

  const winners: DrawnWinnerEntry[] = [];
  const currentCandidates = [...activePool];

  for (let step = 0; step < targetCount; step++) {
    if (currentCandidates.length === 0) break;

    const probMap = computeExactProbabilities(
      currentCandidates,
      config.enableWeightEngine
    );

    const cdf: number[] = [];
    let acc = 0;
    for (const item of currentCandidates) {
      acc += probMap.get(item.id) ?? 0;
      cdf.push(acc);
    }

    const totalCdf = cdf[cdf.length - 1] || 1;
    const r = rng() * totalCdf;

    let low = 0;
    let high = cdf.length - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (r <= cdf[mid]) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }

    const pickedItem = currentCandidates[low];
    const groupName = groupMap.get(pickedItem.groupId)?.name ?? '未分组展区';

    winners.push({
      item: pickedItem,
      groupName,
      theoreticalProbability: probMap.get(pickedItem.id) ?? 0,
      drawIndex: step + 1,
    });

    if (!config.allowReplacement) {
      currentCandidates.splice(low, 1);
    }
  }

  return winners;
}

/**
 * Master Group Draw & Team Partition Router
 */
export function executeGroupDrawEngine(
  allItems: DrawItem[],
  groups: DrawGroup[],
  config: DrawRuleConfig,
  rng: () => number = secureRandom
): { winners?: DrawnWinnerEntry[]; teams?: RandomTeamBucket[] } {
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  switch (config.groupStrategy) {
    case 'GLOBAL_MIX': {
      const eligible = allItems.filter(
        (i) => i.status === 'available' && !groupMap.get(i.groupId)?.isLocked
      );
      return {
        winners: drawWeightedBatch(eligible, config.batchCount, config, groupMap, rng),
      };
    }

    case 'TARGET_GROUPS': {
      const selectedSet = new Set(config.selectedGroupIds);
      const eligible = allItems.filter(
        (i) => i.status === 'available' && selectedSet.has(i.groupId)
      );
      return {
        winners: drawWeightedBatch(eligible, config.batchCount, config, groupMap, rng),
      };
    }

    case 'GROUP_QUOTA': {
      const allWinners: DrawnWinnerEntry[] = [];
      for (const group of groups) {
        if (group.quota <= 0 || group.isLocked) continue;
        const groupItems = allItems.filter(
          (i) => i.status === 'available' && i.groupId === group.id
        );
        const groupWinners = drawWeightedBatch(
          groupItems,
          group.quota,
          config,
          groupMap,
          rng
        );
        allWinners.push(...groupWinners);
      }
      return {
        winners: allWinners.map((w, idx) => ({ ...w, drawIndex: idx + 1 })),
      };
    }

    case 'RANDOM_TEAMS': {
      const k = Math.max(2, Math.min(24, config.teamCount));
      const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
      const teams: RandomTeamBucket[] = Array.from({ length: k }, (_, idx) => ({
        teamId: `team-${idx + 1}`,
        teamName: `第 ${romanNumerals[idx] || idx + 1} 策展战队`,
        members: [],
        totalWeightScore: 0,
      }));

      const available = allItems.filter(
        (i) => i.status === 'available' && !groupMap.get(i.groupId)?.isLocked
      );

      const shuffle = (arr: DrawItem[]) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };

      let orderedQueue: DrawItem[] = [];
      if (config.balanceGroupsAcrossTeams) {
        for (const g of groups) {
          if (g.isLocked) continue;
          const gItems = available.filter((i) => i.groupId === g.id);
          // Sort or shuffle within group so members of the same group distribute evenly
          orderedQueue.push(...shuffle(gItems));
        }
        // Also include any items whose groupId is not in groups
        const knownIds = new Set(groups.map((g) => g.id));
        const orphans = available.filter((i) => !knownIds.has(i.groupId));
        orderedQueue.push(...shuffle(orphans));
      } else {
        orderedQueue = shuffle(available);
      }

      // Snake Draft distribution (0 -> k-1, k-1 -> 0)
      orderedQueue.forEach((item, index) => {
        const cycle = Math.floor(index / k);
        const bucketIdx = cycle % 2 === 0 ? index % k : k - 1 - (index % k);
        teams[bucketIdx].members.push(item);
        teams[bucketIdx].totalWeightScore = Number(
          (teams[bucketIdx].totalWeightScore + item.weight).toFixed(2)
        );
      });

      return { teams };
    }
  }
}

/**
 * Generate a museum-grade SVG illustration DataURL for visual artifact cards
 */
export function createArtifactSvgDataUrl(
  title: string,
  accentHex: string,
  motif: 'astrolabe' | 'monolith' | 'chronometer' | 'seal' | 'prism' | 'crest'
): string {
  const motifs: Record<string, string> = {
    astrolabe: `
      <circle cx="200" cy="150" r="82" fill="none" stroke="${accentHex}" stroke-width="1.5" stroke-opacity="0.7"/>
      <circle cx="200" cy="150" r="58" fill="none" stroke="${accentHex}" stroke-width="1" stroke-dasharray="4 4" stroke-opacity="0.5"/>
      <ellipse cx="200" cy="150" rx="82" ry="32" fill="none" stroke="${accentHex}" stroke-width="1.2" transform="rotate(-28 200 150)" stroke-opacity="0.65"/>
      <ellipse cx="200" cy="150" rx="82" ry="32" fill="none" stroke="${accentHex}" stroke-width="1.2" transform="rotate(28 200 150)" stroke-opacity="0.65"/>
      <circle cx="200" cy="150" r="8" fill="${accentHex}" fill-opacity="0.85"/>
    `,
    monolith: `
      <polygon points="200,52 254,96 254,220 200,248 146,220 146,96" fill="none" stroke="${accentHex}" stroke-width="1.6" stroke-opacity="0.8"/>
      <line x1="200" y1="52" x2="200" y2="248" stroke="${accentHex}" stroke-width="1" stroke-opacity="0.45"/>
      <polygon points="200,78 232,106 232,198 200,218 168,198 168,106" fill="${accentHex}" fill-opacity="0.12" stroke="${accentHex}" stroke-width="1" stroke-opacity="0.4"/>
    `,
    chronometer: `
      <circle cx="200" cy="150" r="78" fill="none" stroke="${accentHex}" stroke-width="1.8" stroke-opacity="0.75"/>
      <circle cx="200" cy="150" r="68" fill="none" stroke="${accentHex}" stroke-width="0.8" stroke-dasharray="2 6" stroke-opacity="0.6"/>
      <line x1="200" y1="150" x2="200" y2="92" stroke="${accentHex}" stroke-width="2" stroke-linecap="round"/>
      <line x1="200" y1="150" x2="242" y2="168" stroke="${accentHex}" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="200" cy="150" r="5" fill="${accentHex}"/>
    `,
    seal: `
      <rect x="134" y="84" width="132" height="132" rx="18" fill="none" stroke="${accentHex}" stroke-width="1.5" stroke-opacity="0.75"/>
      <rect x="150" y="100" width="100" height="100" rx="8" fill="${accentHex}" fill-opacity="0.1" stroke="${accentHex}" stroke-width="1" stroke-opacity="0.45"/>
      <circle cx="200" cy="150" r="28" fill="none" stroke="${accentHex}" stroke-width="1.4"/>
    `,
    prism: `
      <polygon points="200,64 274,212 126,212" fill="${accentHex}" fill-opacity="0.1" stroke="${accentHex}" stroke-width="1.6" stroke-opacity="0.8"/>
      <polygon points="200,92 248,196 152,196" fill="none" stroke="${accentHex}" stroke-width="1" stroke-dasharray="3 3" stroke-opacity="0.5"/>
      <circle cx="200" cy="162" r="10" fill="${accentHex}" fill-opacity="0.7"/>
    `,
    crest: `
      <path d="M200 62 L262 90 L252 174 C244 212 200 238 200 238 C200 238 156 212 148 174 L138 90 Z" fill="${accentHex}" fill-opacity="0.1" stroke="${accentHex}" stroke-width="1.6" stroke-opacity="0.8"/>
      <circle cx="200" cy="145" r="32" fill="none" stroke="${accentHex}" stroke-width="1.2" stroke-opacity="0.6"/>
    `,
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
    <defs>
      <radialGradient id="bg" cx="50%" cy="45%" r="65%">
        <stop offset="0%" stop-color="#1D2028"/>
        <stop offset="100%" stop-color="#0B0C0E"/>
      </radialGradient>
    </defs>
    <rect width="400" height="300" fill="url(#bg)"/>
    <rect x="16" y="16" width="368" height="268" rx="8" fill="none" stroke="${accentHex}" stroke-opacity="0.22" stroke-width="1"/>
    ${motifs[motif] || motifs.astrolabe}
    <text x="200" y="268" text-anchor="middle" fill="#F5F2EB" fill-opacity="0.65" font-family="Georgia, serif" font-size="12" letter-spacing="2">${title.slice(0, 18)}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const COLOR_TOKEN_STYLES: Record<
  CuratorialColorToken,
  { label: string; hex: string; textClass: string; borderClass: string; dotBg: string }
> = {
  brass: {
    label: '典藏流金 (Brass)',
    hex: '#D4AF37',
    textClass: 'text-[#D4AF37]',
    borderClass: 'border-[#D4AF37]/40',
    dotBg: 'bg-[#D4AF37]',
  },
  lapis: {
    label: '青金石蓝 (Lapis)',
    hex: '#60A5FA',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-400/40',
    dotBg: 'bg-blue-400',
  },
  terracotta: {
    label: '赤陶琥珀 (Terracotta)',
    hex: '#F59E0B',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-400/40',
    dotBg: 'bg-amber-400',
  },
  emerald: {
    label: '古铜翠玉 (Jade)',
    hex: '#34D399',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-400/40',
    dotBg: 'bg-emerald-400',
  },
  amethyst: {
    label: '暮光紫晶 (Amethyst)',
    hex: '#C084FC',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-400/40',
    dotBg: 'bg-purple-400',
  },
  slate: {
    label: '曜石银灰 (Silver)',
    hex: '#94A3B8',
    textClass: 'text-slate-300',
    borderClass: 'border-slate-400/40',
    dotBg: 'bg-slate-300',
  },
};

export const INITIAL_GROUPS: DrawGroup[] = [
  {
    id: 'grp-curators',
    name: 'A馆 · 首席策展与架构组',
    colorToken: 'brass',
    quota: 1,
    groupWeight: 1,
    isLocked: false,
  },
  {
    id: 'grp-digital',
    name: 'B馆 · 全息数字交互实验室',
    colorToken: 'lapis',
    quota: 1,
    groupWeight: 1,
    isLocked: false,
  },
  {
    id: 'grp-restoration',
    name: 'C馆 · 典藏文物修复中心',
    colorToken: 'emerald',
    quota: 1,
    groupWeight: 1,
    isLocked: false,
  },
  {
    id: 'grp-artifacts',
    name: 'D馆 · 稀世馆藏映像签池',
    colorToken: 'terracotta',
    quota: 1,
    groupWeight: 1,
    isLocked: false,
  },
];

export const INITIAL_DRAW_ITEMS: DrawItem[] = [
  {
    id: 'item-1',
    accessionNo: 'LOT-001',
    title: '林知夏',
    subtitle: '空间光影主策展人 · 巴黎高美驻留学者',
    groupId: 'grp-curators',
    mediaType: 'text',
    weight: 2.0,
    status: 'available',
  },
  {
    id: 'item-2',
    accessionNo: 'LOT-002',
    title: '陈默',
    subtitle: '计算美学架构师 · 瑞士洛桑联邦理工',
    groupId: 'grp-curators',
    mediaType: 'text',
    weight: 1.5,
    status: 'available',
  },
  {
    id: 'item-3',
    accessionNo: 'LOT-003',
    title: '苏牧之',
    subtitle: '展陈动线与声学顾问',
    groupId: 'grp-curators',
    mediaType: 'text',
    weight: 1.0,
    status: 'available',
  },
  {
    id: 'item-4',
    accessionNo: 'LOT-004',
    title: '周叙白',
    subtitle: 'WebGL 与实时着色器主程',
    groupId: 'grp-digital',
    mediaType: 'text',
    weight: 2.0,
    status: 'available',
  },
  {
    id: 'item-5',
    accessionNo: 'LOT-005',
    title: '温以宁',
    subtitle: '多模态传感交互设计师',
    groupId: 'grp-digital',
    mediaType: 'text',
    weight: 1.2,
    status: 'available',
  },
  {
    id: 'item-6',
    accessionNo: 'LOT-006',
    title: '陆景行',
    subtitle: '生成式视觉与粒子系统工程师',
    groupId: 'grp-digital',
    mediaType: 'text',
    weight: 1.0,
    status: 'available',
  },
  {
    id: 'item-7',
    accessionNo: 'LOT-007',
    title: '沈清秋',
    subtitle: '古籍善本与金石拓片修复师',
    groupId: 'grp-restoration',
    mediaType: 'text',
    weight: 1.5,
    status: 'available',
  },
  {
    id: 'item-8',
    accessionNo: 'LOT-008',
    title: '顾言深',
    subtitle: '青铜器光谱无损检测专家',
    groupId: 'grp-restoration',
    mediaType: 'text',
    weight: 1.0,
    status: 'available',
  },
  {
    id: 'item-9',
    accessionNo: 'LOT-009',
    title: '叶知秋',
    subtitle: '古典油画颜料化学研究员',
    groupId: 'grp-restoration',
    mediaType: 'text',
    weight: 1.0,
    status: 'available',
  },
  {
    id: 'item-10',
    accessionNo: 'LOT-010',
    title: '黄铜星盘 · 16世纪航海浑仪',
    subtitle: '馆藏图像签项 · 佛罗伦萨皇家工坊铸造',
    groupId: 'grp-artifacts',
    mediaType: 'image',
    imageUrl: createArtifactSvgDataUrl('ASTROLABE XVI', '#D4AF37', 'astrolabe'),
    weight: 1.8,
    status: 'available',
  },
  {
    id: 'item-11',
    accessionNo: 'LOT-011',
    title: '黑曜石方尖碑 · 几何光折射体',
    subtitle: '馆藏图像签项 · 当代极简主义雕塑特展',
    groupId: 'grp-artifacts',
    mediaType: 'image',
    imageUrl: createArtifactSvgDataUrl('OBSIDIAN MONOLITH', '#60A5FA', 'monolith'),
    weight: 1.4,
    status: 'available',
  },
  {
    id: 'item-12',
    accessionNo: 'LOT-012',
    title: '日内瓦陀飞轮天文钟 · 1892',
    subtitle: '馆藏图像签项 · 精密黄金擒纵机构',
    groupId: 'grp-artifacts',
    mediaType: 'image',
    imageUrl: createArtifactSvgDataUrl('CHRONOMETER 1892', '#34D399', 'chronometer'),
    weight: 1.2,
    status: 'available',
  },
];
