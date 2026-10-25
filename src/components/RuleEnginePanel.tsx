import React from 'react';
import {
  Layers,
  Globe,
  Disc,
  Box,
  Volume2,
  VolumeX,
  Scale,
  Users,
  CheckSquare,
  Square,
  Sliders,
} from 'lucide-react';
import {
  DrawGroup,
  DrawItem,
  DrawModality,
  DrawRuleConfig,
  GroupDrawStrategy,
} from '../types/draw';

interface RuleEnginePanelProps {
  config: DrawRuleConfig;
  groups: DrawGroup[];
  items: DrawItem[];
  exactProbMap: Map<string, number>;
  onUpdateConfig: (partial: Partial<DrawRuleConfig>) => void;
  onUpdateGroupQuota: (groupId: string, quota: number) => void;
}

const MODALITY_OPTIONS: {
  id: DrawModality;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'TAROT_MONOLITH',
    title: '黑曜石卡牌翻转',
    subtitle: '3D 矩阵悬浮洗牌与流金翻面',
    icon: Layers,
  },
  {
    id: 'CELESTIAL_SPHERE',
    title: '3D 引力星云球体',
    subtitle: '斐波那契球面环绕与聚光推镜',
    icon: Globe,
  },
  {
    id: 'CHRONO_REEL',
    title: '陀飞轮阻尼滚轮',
    subtitle: '瑞士钟表级多轴惯性回弹滚轮',
    icon: Disc,
  },
  {
    id: 'CURIO_BLINDBOX',
    title: '博物馆玻璃展柜盲盒',
    subtitle: '磨砂展罩升起与微光粒子散逸',
    icon: Box,
  },
];

const STRATEGY_OPTIONS: {
  id: GroupDrawStrategy;
  label: string;
  desc: string;
}[] = [
  {
    id: 'GLOBAL_MIX',
    label: '全局混抽',
    desc: '打通所有未锁定分组，按单签权重全局随机抽取',
  },
  {
    id: 'TARGET_GROUPS',
    label: '指定组抽',
    desc: '仅从下方勾选的指定分组候选池中抽取',
  },
  {
    id: 'GROUP_QUOTA',
    label: '各组定额',
    desc: '严格按照每个展区设定的配额人数同步抽取',
  },
  {
    id: 'RANDOM_TEAMS',
    label: '随机分队',
    desc: '采用蛇形洗牌算法将待抽池均衡划分为多支战队',
  },
];

export const RuleEnginePanel: React.FC<RuleEnginePanelProps> = ({
  config,
  groups,
  items,
  exactProbMap,
  onUpdateConfig,
  onUpdateGroupQuota,
}) => {
  const availableItems = items.filter((i) => i.status === 'available');

  // Toggle group selection in TARGET_GROUPS mode
  const handleToggleTargetGroup = (groupId: string) => {
    const exists = config.selectedGroupIds.includes(groupId);
    const next = exists
      ? config.selectedGroupIds.filter((id) => id !== groupId)
      : [...config.selectedGroupIds, groupId];
    onUpdateConfig({ selectedGroupIds: next });
  };

  // Top 4 highest probability items for live mathematical audit preview
  const topProbItems = [...availableItems]
    .sort((a, b) => (exactProbMap.get(b.id) ?? 0) - (exactProbMap.get(a.id) ?? 0))
    .slice(0, 4);

  const totalQuotaSum = groups
    .filter((g) => !g.isLocked)
    .reduce((acc, g) => acc + g.quota, 0);

  return (
    <aside
      aria-label="概率引擎与分组抽取控制台"
      className="flex flex-col bg-[#121316]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-full"
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-base font-display font-semibold tracking-wide text-[#F5F2EB]">
            03. 概率与分组规则引擎
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Web Crypto 密码学随机源 · 实时数学归一化
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUpdateConfig({ soundEnabled: !config.soundEnabled })}
          aria-label={config.soundEnabled ? '关闭声学反馈' : '开启声学反馈'}
          title={config.soundEnabled ? '已开启博物馆声学反馈' : '已静音'}
          className={`p-2 rounded-lg border transition-colors ${
            config.soundEnabled
              ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
              : 'border-white/10 bg-white/[0.02] text-stone-500 hover:text-stone-300'
          }`}
        >
          {config.soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="p-4 space-y-5 overflow-y-auto flex-1">
        {/* Section A: Multimodal Stage Selector */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-stone-300">多模态抽签动效画布</span>
            <span className="text-stone-500 font-mono-tabular">60 FPS</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MODALITY_OPTIONS.map((mod) => {
              const Icon = mod.icon;
              const isSelected = config.modality === mod.id;
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => onUpdateConfig({ modality: mod.id })}
                  className={`p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#D4AF37] bg-[#D4AF37]/12 text-[#F5F2EB]'
                      : 'border-white/10 bg-[#0B0C0E]/60 text-stone-400 hover:border-white/25 hover:text-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isSelected ? 'text-[#D4AF37]' : 'text-stone-500'
                      }`}
                    />
                    {isSelected && (
                      <span className="text-[10px] font-mono-tabular text-[#D4AF37]">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold whitespace-nowrap truncate w-full">
                    {mod.title}
                  </div>
                  <div className="text-[11px] text-stone-500 truncate w-full mt-0.5">
                    {mod.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section B: Core Probability & Replacement Rules */}
        <section className="space-y-2.5 pt-3 border-t border-white/10">
          <div className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#D4AF37]" />
            核心抽签规则控制
          </div>

          <div className="space-y-2 bg-[#0B0C0E]/70 p-3 rounded-lg border border-white/10">
            {/* Without Replacement Toggle */}
            <div className="flex items-center justify-between text-xs">
              <div>
                <div className="text-[#F5F2EB] font-medium">不放回抽签模式</div>
                <div className="text-[11px] text-stone-500">
                  中签后自动移出活跃候选池，避免重复中签
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!config.allowReplacement}
                onClick={() =>
                  onUpdateConfig({ allowReplacement: !config.allowReplacement })
                }
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  !config.allowReplacement
                    ? 'bg-[#D4AF37] text-[#0B0C0E]'
                    : 'bg-white/10 text-stone-300'
                }`}
              >
                {!config.allowReplacement ? '不放回 (已启)' : '放回重抽'}
              </button>
            </div>

            {/* Weighted Engine Toggle */}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-white/[0.06]">
              <div>
                <div className="text-[#F5F2EB] font-medium">自定义权重与精确概率</div>
                <div className="text-[11px] text-stone-500">
                  关闭后所有待抽签项严格执行 1/N 等概率
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={config.enableWeightEngine}
                onClick={() =>
                  onUpdateConfig({ enableWeightEngine: !config.enableWeightEngine })
                }
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  config.enableWeightEngine
                    ? 'bg-[#D4AF37] text-[#0B0C0E]'
                    : 'bg-white/10 text-stone-300'
                }`}
              >
                {config.enableWeightEngine ? '加权开启' : '全员等概'}
              </button>
            </div>

            {/* Batch Count Stepper (Only for GLOBAL_MIX and TARGET_GROUPS) */}
            {(config.groupStrategy === 'GLOBAL_MIX' ||
              config.groupStrategy === 'TARGET_GROUPS') && (
              <div className="flex items-center justify-between text-xs pt-2 border-t border-white/[0.06]">
                <div>
                  <div className="text-[#F5F2EB] font-medium">单次连抽数量</div>
                  <div className="text-[11px] text-stone-500">
                    一次并发揭晓多个中签展品或名单
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-[#121316] border border-white/15 rounded-lg px-2 py-1">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConfig({
                        batchCount: Math.max(1, config.batchCount - 1),
                      })
                    }
                    aria-label="减少连抽数量"
                    className="px-1.5 text-stone-300 hover:text-white"
                  >
                    -
                  </button>
                  <span className="font-mono-tabular text-xs font-semibold text-[#D4AF37] min-w-[28px] text-center">
                    {config.batchCount}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConfig({
                        batchCount: Math.min(24, config.batchCount + 1),
                      })
                    }
                    aria-label="增加连抽数量"
                    className="px-1.5 text-stone-300 hover:text-white"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section C: Group Draw Strategy & Contextual Matrix */}
        <section className="space-y-2.5 pt-3 border-t border-white/10">
          <div className="text-xs font-medium text-stone-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#D4AF37]" />
            分组抽取与随机分队机制
          </div>

          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0B0C0E] rounded-lg border border-white/10">
            {STRATEGY_OPTIONS.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => onUpdateConfig({ groupStrategy: st.id })}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  config.groupStrategy === st.id
                    ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-stone-400">
            {STRATEGY_OPTIONS.find((s) => s.id === config.groupStrategy)?.desc}
          </p>

          {/* Contextual Controls per Strategy */}
          {config.groupStrategy === 'TARGET_GROUPS' && (
            <div className="space-y-1.5 bg-[#0B0C0E]/70 p-3 rounded-lg border border-white/10">
              <div className="text-xs text-stone-300 mb-1">
                勾选参与本轮抽签的指定分组:
              </div>
              {groups.map((grp) => {
                const checked = config.selectedGroupIds.includes(grp.id);
                const availInGrp = availableItems.filter(
                  (i) => i.groupId === grp.id
                ).length;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => handleToggleTargetGroup(grp.id)}
                    className="w-full flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/[0.04] text-xs transition-colors"
                  >
                    <span className="flex items-center gap-2 text-[#F5F2EB] truncate">
                      {checked ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      )}
                      <span className="truncate">{grp.name}</span>
                    </span>
                    <span className="font-mono-tabular text-stone-400 shrink-0 ml-2">
                      待抽 {availInGrp}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {config.groupStrategy === 'GROUP_QUOTA' && (
            <div className="space-y-2 bg-[#0B0C0E]/70 p-3 rounded-lg border border-white/10">
              <div className="flex items-center justify-between text-xs text-stone-300">
                <span>各组定额抽取配置</span>
                <span className="font-mono-tabular text-[#D4AF37]">
                  本轮共抽 {totalQuotaSum} 项
                </span>
              </div>
              <div className="space-y-1.5">
                {groups.map((grp) => {
                  const availInGrp = availableItems.filter(
                    (i) => i.groupId === grp.id
                  ).length;
                  return (
                    <div
                      key={grp.id}
                      className="flex items-center justify-between gap-2 text-xs py-1 border-b border-white/[0.04] last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[#F5F2EB] truncate">{grp.name}</div>
                        <div className="text-[10px] text-stone-500 font-mono-tabular">
                          池内可用: {availInGrp} 项
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-[#121316] border border-white/15 rounded px-1.5 py-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateGroupQuota(grp.id, Math.max(0, grp.quota - 1))
                          }
                          aria-label={`减少 ${grp.name} 定额`}
                          className="px-1 text-stone-400 hover:text-white"
                        >
                          -
                        </button>
                        <span className="font-mono-tabular text-xs text-[#D4AF37] min-w-[22px] text-center">
                          {grp.quota}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateGroupQuota(
                              grp.id,
                              Math.min(20, grp.quota + 1)
                            )
                          }
                          aria-label={`增加 ${grp.name} 定额`}
                          className="px-1 text-stone-400 hover:text-white"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {config.groupStrategy === 'RANDOM_TEAMS' && (
            <div className="space-y-2.5 bg-[#0B0C0E]/70 p-3 rounded-lg border border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#F5F2EB] font-medium">目标划分战队数量</span>
                <div className="flex items-center gap-1.5 bg-[#121316] border border-white/15 rounded px-2 py-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConfig({
                        teamCount: Math.max(2, config.teamCount - 1),
                      })
                    }
                    aria-label="减少分队数量"
                    className="px-1 text-stone-300 hover:text-white"
                  >
                    -
                  </button>
                  <span className="font-mono-tabular text-xs font-semibold text-[#D4AF37] min-w-[24px] text-center">
                    {config.teamCount} 队
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateConfig({
                        teamCount: Math.min(12, config.teamCount + 1),
                      })
                    }
                    aria-label="增加分队数量"
                    className="px-1 text-stone-300 hover:text-white"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-white/[0.06]">
                <div>
                  <div className="text-[#F5F2EB]">同组人员均匀打散</div>
                  <div className="text-[10px] text-stone-500">
                    将原相同分组的成员交叉分配至不同战队
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateConfig({
                      balanceGroupsAcrossTeams: !config.balanceGroupsAcrossTeams,
                    })
                  }
                  className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 ${
                    config.balanceGroupsAcrossTeams
                      ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                      : 'bg-white/10 text-stone-300'
                  }`}
                >
                  {config.balanceGroupsAcrossTeams ? '均衡打散' : '完全随机'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Section D: Live Mathematical Audit Preview */}
        <section className="space-y-2 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-stone-300 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-[#D4AF37]" />
              实时概率分布公证预览
            </span>
            <span className="font-mono-tabular text-[11px] text-stone-500">
              ΣP = {availableItems.length > 0 ? '100.00%' : '0.00%'}
            </span>
          </div>

          <div className="bg-[#0B0C0E]/70 p-3 rounded-lg border border-white/10 space-y-2">
            {topProbItems.length === 0 ? (
              <p className="text-xs text-stone-500 text-center py-2">
                活跃签池为空，请先导入或放回签项
              </p>
            ) : (
              topProbItems.map((item) => {
                const p = (exactProbMap.get(item.id) ?? 0) * 100;
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-300 truncate max-w-[160px]">
                        {item.accessionNo} · {item.title}
                      </span>
                      <span className="font-mono-tabular text-[#D4AF37]">
                        {p.toFixed(2)}%
                      </span>
                    </div>
                    <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#D4AF37] transition-all duration-200"
                        style={{ width: `${Math.min(100, Math.max(2, p))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </aside>
  );
};
