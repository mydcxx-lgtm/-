/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  CuratorialColorToken,
  DrawGroup,
  DrawHistorySession,
  DrawItem,
  DrawModality,
  DrawRuleConfig,
  DrawnWinnerEntry,
  RandomTeamBucket,
} from './types/draw';
import {
  computeExactProbabilities,
  executeGroupDrawEngine,
  formatAccessionNo,
  INITIAL_DRAW_ITEMS,
  INITIAL_GROUPS,
} from './utils/drawEngine';
import { soundEngine } from './utils/soundEngine';
import { PoolManagerPanel } from './components/PoolManagerPanel';
import { MultimodalStage } from './components/MultimodalStage';
import { RuleEnginePanel } from './components/RuleEnginePanel';
import { ArchivalLedger } from './components/ArchivalLedger';
import { IngestionModal } from './components/IngestionModal';

export default function App() {
  const [groups, setGroups] = useState<DrawGroup[]>(INITIAL_GROUPS);
  const [items, setItems] = useState<DrawItem[]>(INITIAL_DRAW_ITEMS);

  const [config, setConfig] = useState<DrawRuleConfig>({
    allowReplacement: false,
    batchCount: 2,
    enableWeightEngine: true,
    groupStrategy: 'GLOBAL_MIX',
    selectedGroupIds: INITIAL_GROUPS.map((g) => g.id),
    teamCount: 3,
    balanceGroupsAcrossTeams: true,
    modality: 'TAROT_MONOLITH',
    soundEnabled: true,
  });

  const [isIngestionOpen, setIsIngestionOpen] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [latestWinners, setLatestWinners] = useState<DrawnWinnerEntry[]>([]);
  const [latestTeams, setLatestTeams] = useState<RandomTeamBucket[]>([]);
  const [history, setHistory] = useState<DrawHistorySession[]>([]);

  // Compute exact mathematical probabilities for currently eligible pool
  const exactProbMap = useMemo(() => {
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const eligible = items.filter((item) => {
      if (item.status !== 'available') return false;
      if (config.groupStrategy === 'TARGET_GROUPS') {
        return config.selectedGroupIds.includes(item.groupId);
      }
      return !groupMap.get(item.groupId)?.isLocked;
    });
    return computeExactProbabilities(eligible, config.enableWeightEngine);
  }, [items, groups, config.enableWeightEngine, config.groupStrategy, config.selectedGroupIds]);

  const handleUpdateConfig = (partial: Partial<DrawRuleConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  // Trigger a draw session with brief kinetic anticipation
  const handleTriggerDraw = () => {
    if (isDrawing) return;
    const availableCount = items.filter((i) => i.status === 'available').length;
    if (availableCount === 0) return;

    setIsDrawing(true);

    setTimeout(() => {
      const outcome = executeGroupDrawEngine(items, groups, config);
      setIsDrawing(false);
      soundEngine.playRevealChime(config.soundEnabled);

      if (outcome.winners && outcome.winners.length > 0) {
        setLatestWinners(outcome.winners);
        setLatestTeams([]);

        // If without replacement, mark drawn items as 'drawn'
        if (!config.allowReplacement) {
          const wonIds = new Set(outcome.winners.map((w) => w.item.id));
          const now = Date.now();
          setItems((prev) =>
            prev.map((it) =>
              wonIds.has(it.id) ? { ...it, status: 'drawn', drawnAt: now } : it
            )
          );
        }

        const newSession: DrawHistorySession = {
          sessionId: `ses-${Date.now()}`,
          timestamp: Date.now(),
          strategy: config.groupStrategy,
          modality: config.modality,
          winners: outcome.winners,
        };
        setHistory((prev) => [newSession, ...prev]);
      } else if (outcome.teams && outcome.teams.length > 0) {
        setLatestTeams(outcome.teams);
        setLatestWinners([]);

        const newSession: DrawHistorySession = {
          sessionId: `ses-${Date.now()}`,
          timestamp: Date.now(),
          strategy: config.groupStrategy,
          modality: config.modality,
          teams: outcome.teams,
        };
        setHistory((prev) => [newSession, ...prev]);
      }
    }, 680);
  };

  // Pool & Group Management Handlers
  const handleAddSingleItem = (newItem: {
    title: string;
    subtitle?: string;
    groupId: string;
    weight: number;
  }) => {
    setItems((prev) => {
      const nextIndex = prev.length + 1;
      const created: DrawItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        accessionNo: formatAccessionNo(nextIndex),
        title: newItem.title,
        subtitle: newItem.subtitle,
        groupId: newItem.groupId,
        mediaType: 'text',
        weight: newItem.weight,
        status: 'available',
      };
      return [created, ...prev];
    });
  };

  const handleUpdateItemWeight = (id: string, weight: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, weight: Math.max(0.01, weight) } : it))
    );
  };

  const handleUpdateItemFixedProb = (id: string, fixedProbability: number | undefined) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, fixedProbability } : it))
    );
  };

  const handleToggleItemStatus = (id: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              status: it.status === 'available' ? 'drawn' : 'available',
            }
          : it
      )
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleResetAllDrawn = () => {
    setItems((prev) =>
      prev.map((it) => ({ ...it, status: 'available', drawnAt: undefined }))
    );
  };

  const handleNormalizeAllWeights = () => {
    setItems((prev) =>
      prev.map((it) => ({ ...it, weight: 1.0, fixedProbability: undefined }))
    );
  };

  const handleAddGroup = (name: string, colorToken: CuratorialColorToken) => {
    const newGrp: DrawGroup = {
      id: `grp-${Date.now()}`,
      name,
      colorToken,
      quota: 1,
      groupWeight: 1,
      isLocked: false,
    };
    setGroups((prev) => [...prev, newGrp]);
    setConfig((prev) => ({
      ...prev,
      selectedGroupIds: [...prev.selectedGroupIds, newGrp.id],
    }));
  };

  const handleToggleGroupLock = (groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, isLocked: !g.isLocked } : g))
    );
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroups((prev) => {
      const remaining = prev.filter((g) => g.id !== groupId);
      const fallbackId = remaining[0]?.id || 'default';
      setItems((currItems) =>
        currItems.map((it) =>
          it.groupId === groupId ? { ...it, groupId: fallbackId } : it
        )
      );
      return remaining;
    });
  };

  const handleUpdateGroupQuota = (groupId: string, quota: number) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, quota } : g))
    );
  };

  // Multi-format Import Commit Handler
  const handleCommitImport = (
    rawItems: Omit<DrawItem, 'id' | 'accessionNo' | 'status'>[],
    detectedGroupNames: string[],
    mode: 'append' | 'replace'
  ) => {
    const colorCycle: CuratorialColorToken[] = [
      'brass',
      'lapis',
      'emerald',
      'terracotta',
      'amethyst',
      'slate',
    ];

    const updatedGroups = mode === 'replace' ? [] : [...groups];
    const nameToIdMap = new Map<string, string>();
    updatedGroups.forEach((g) => nameToIdMap.set(g.name, g.id));

    detectedGroupNames.forEach((gName, idx) => {
      if (!nameToIdMap.has(gName)) {
        const newId = `grp-${Date.now()}-${idx}`;
        const newGrp: DrawGroup = {
          id: newId,
          name: gName,
          colorToken: colorCycle[(updatedGroups.length + idx) % colorCycle.length],
          quota: 1,
          groupWeight: 1,
          isLocked: false,
        };
        updatedGroups.push(newGrp);
        nameToIdMap.set(gName, newId);
      }
    });

    const baseOffset = mode === 'replace' ? 0 : items.length;
    const materializedItems: DrawItem[] = rawItems.map((raw, idx) => ({
      ...raw,
      id: `item-${Date.now()}-${idx}`,
      accessionNo: formatAccessionNo(baseOffset + idx + 1),
      groupId: nameToIdMap.get(raw.groupId) || updatedGroups[0]?.id || 'default',
      status: 'available',
    }));

    setGroups(updatedGroups);
    setItems((prev) =>
      mode === 'replace' ? materializedItems : [...materializedItems, ...prev]
    );
    setConfig((prev) => ({
      ...prev,
      selectedGroupIds: updatedGroups.map((g) => g.id),
    }));
  };

  // Export History CSV
  const handleExportHistoryCsv = () => {
    const rows: string[][] = [
      ['轮次', '时间', '抽取策略', '动效模态', '序号/战队', '馆藏编号', '姓名/主标题', '所属分组', '瞬时理论概率'],
    ];

    history.forEach((ses, sIdx) => {
      const roundLabel = `第 ${history.length - sIdx} 轮`;
      const timeLabel = new Date(ses.timestamp).toLocaleString('zh-CN', { hour12: false });

      if (ses.winners) {
        ses.winners.forEach((w) => {
          rows.push([
            roundLabel,
            timeLabel,
            ses.strategy,
            ses.modality,
            `#${w.drawIndex}`,
            w.item.accessionNo,
            w.item.title,
            w.groupName,
            `${(w.theoreticalProbability * 100).toFixed(2)}%`,
          ]);
        });
      } else if (ses.teams) {
        ses.teams.forEach((t) => {
          t.members.forEach((m) => {
            rows.push([
              roundLabel,
              timeLabel,
              ses.strategy,
              ses.modality,
              t.teamName,
              m.accessionNo,
              m.title,
              m.groupId,
              `${m.weight.toFixed(1)}x`,
            ]);
          });
        });
      }
    });

    const csvContent =
      '\uFEFF' + rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lumina_抽签公证报告_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const drawnCount = items.filter((i) => i.status === 'drawn').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0C0E] text-[#F5F2EB] selection:bg-[#D4AF37] selection:text-[#0B0C0E]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-white/10 bg-[#0B0C0E]/90 backdrop-blur-md sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-xl font-display font-bold tracking-wider text-[#F5F2EB] whitespace-nowrap shrink-0"
        >
          Lumina Curated Draw
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="主视图导航"
          className="hidden md:flex items-center gap-7 text-xs font-medium text-stone-300"
        >
          <a
            href="#workspace-grid"
            className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
          >
            全息抽签展台
          </a>
          <button
            type="button"
            onClick={() => setIsIngestionOpen(true)}
            className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
          >
            多格式文件导入
          </button>
          <button
            type="button"
            onClick={() =>
              handleUpdateConfig({
                groupStrategy:
                  config.groupStrategy === 'RANDOM_TEAMS'
                    ? 'GLOBAL_MIX'
                    : 'RANDOM_TEAMS',
              })
            }
            className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
          >
            分组与随机分队
          </button>
          <a
            href="#archival-ledger-section"
            className="hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
          >
            公证历史账本
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleTriggerDraw}
            disabled={isDrawing}
            className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] text-[#0B0C0E] rounded-lg hover:bg-[#e2be46] transition-colors whitespace-nowrap shrink-0"
          >
            立即启动抽签
          </button>
        </div>
      </header>

      {/* Main 1440px Curatorial Workspace */}
      <main
        id="workspace-grid"
        className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6"
      >
        {/* Three-Column Core Console */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
          {/* Left Column (3 cols on XL): Pool & Group Visual Manager */}
          <div className="xl:col-span-3 flex flex-col">
            <PoolManagerPanel
              items={items}
              groups={groups}
              exactProbMap={exactProbMap}
              onOpenIngestionModal={() => setIsIngestionOpen(true)}
              onAddSingleItem={handleAddSingleItem}
              onUpdateItemWeight={handleUpdateItemWeight}
              onUpdateItemFixedProb={handleUpdateItemFixedProb}
              onToggleItemStatus={handleToggleItemStatus}
              onDeleteItem={handleDeleteItem}
              onResetAllDrawn={handleResetAllDrawn}
              onNormalizeAllWeights={handleNormalizeAllWeights}
              onAddGroup={handleAddGroup}
              onToggleGroupLock={handleToggleGroupLock}
              onDeleteGroup={handleDeleteGroup}
            />
          </div>

          {/* Center Column (6 cols on XL): Multimodal Holographic Stage */}
          <div className="xl:col-span-6 flex flex-col">
            <MultimodalStage
              items={items}
              groups={groups}
              config={config}
              exactProbMap={exactProbMap}
              isDrawing={isDrawing}
              latestWinners={latestWinners}
              latestTeams={latestTeams}
              onTriggerDraw={handleTriggerDraw}
              onSelectModality={(modality: DrawModality) =>
                handleUpdateConfig({ modality })
              }
            />
          </div>

          {/* Right Column (3 cols on XL): Probability & Group Rule Engine */}
          <div className="xl:col-span-3 flex flex-col">
            <RuleEnginePanel
              config={config}
              groups={groups}
              items={items}
              exactProbMap={exactProbMap}
              onUpdateConfig={handleUpdateConfig}
              onUpdateGroupQuota={handleUpdateGroupQuota}
            />
          </div>
        </div>

        {/* Bottom Archival Ledger */}
        <ArchivalLedger
          history={history}
          drawnCount={drawnCount}
          onExportHistoryCsv={handleExportHistoryCsv}
          onResetAllDrawn={handleResetAllDrawn}
          onClearHistory={() => setHistory([])}
        />
      </main>

      {/* Universal File & Batch Image Ingestion Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        groups={groups}
        onCommitImport={handleCommitImport}
      />
    </div>
  );
}
