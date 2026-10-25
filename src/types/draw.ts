export type ItemMediaType = 'text' | 'image' | 'mixed';

export type ItemStatus = 'available' | 'drawn' | 'excluded';

export interface DrawItem {
  id: string;
  accessionNo: string;        // e.g. "LOT-2026-001"
  title: string;              // Main title / person name / prize label
  subtitle?: string;          // Department / artist / curatorial note
  groupId: string;            // Associated DrawGroup ID
  mediaType: ItemMediaType;
  imageUrl?: string;          // DataURL / SVG DataURL for visual draw items
  weight: number;             // Relative weight (0.01 ~ 1000, default 1.0)
  fixedProbability?: number;  // Optional locked absolute probability (0 ~ 1)
  status: ItemStatus;
  drawnAt?: number;
  metadata?: Record<string, string>;
}

export type CuratorialColorToken = 'brass' | 'lapis' | 'terracotta' | 'emerald' | 'amethyst' | 'slate';

export interface DrawGroup {
  id: string;
  name: string;
  colorToken: CuratorialColorToken;
  quota: number;              // Quota count when strategy === 'GROUP_QUOTA'
  groupWeight: number;        // Relative group weight
  isLocked?: boolean;         // Excluded from GLOBAL_MIX when true
}

export type DrawModality =
  | 'TAROT_MONOLITH'          // 3D Obsidian Card Flip Matrix
  | 'CELESTIAL_SPHERE'        // 3D Fibonacci Orbital Sphere
  | 'CHRONO_REEL'             // Horological Damped Mechanical Reel
  | 'CURIO_BLINDBOX';         // Museum Glass Vitrine Blindbox

export type GroupDrawStrategy =
  | 'GLOBAL_MIX'              // Mix all unlocked groups globally
  | 'TARGET_GROUPS'           // Draw only from selected group IDs
  | 'GROUP_QUOTA'             // Draw exact quota per group simultaneously
  | 'RANDOM_TEAMS';           // Partition available items into balanced teams

export interface DrawRuleConfig {
  allowReplacement: boolean;
  batchCount: number;
  enableWeightEngine: boolean;
  groupStrategy: GroupDrawStrategy;
  selectedGroupIds: string[];
  teamCount: number;
  balanceGroupsAcrossTeams: boolean;
  modality: DrawModality;
  soundEnabled: boolean;
}

export interface DrawnWinnerEntry {
  item: DrawItem;
  groupName: string;
  theoreticalProbability: number;
  drawIndex: number;
}

export interface RandomTeamBucket {
  teamId: string;
  teamName: string;
  members: DrawItem[];
  totalWeightScore: number;
}

export interface DrawHistorySession {
  sessionId: string;
  timestamp: number;
  strategy: GroupDrawStrategy;
  modality: DrawModality;
  winners?: DrawnWinnerEntry[];
  teams?: RandomTeamBucket[];
}

export interface ParsedImportBatch {
  sourceType: 'excel' | 'csv' | 'word' | 'txt' | 'image' | 'paste';
  fileName: string;
  items: Omit<DrawItem, 'id' | 'accessionNo' | 'status'>[];
  detectedGroups: string[];
  warnings: string[];
}
