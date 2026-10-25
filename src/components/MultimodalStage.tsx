import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  Shuffle,
  Award,
  Layers,
  Globe,
  Disc,
  Box,
  Users,
  RotateCw,
} from 'lucide-react';
import {
  DrawGroup,
  DrawItem,
  DrawModality,
  DrawRuleConfig,
  DrawnWinnerEntry,
  RandomTeamBucket,
} from '../types/draw';
import { soundEngine } from '../utils/soundEngine';

interface MultimodalStageProps {
  items: DrawItem[];
  groups: DrawGroup[];
  config: DrawRuleConfig;
  exactProbMap: Map<string, number>;
  isDrawing: boolean;
  latestWinners: DrawnWinnerEntry[];
  latestTeams: RandomTeamBucket[];
  onTriggerDraw: () => void;
  onSelectModality: (modality: DrawModality) => void;
}

export const MultimodalStage: React.FC<MultimodalStageProps> = ({
  items,
  groups,
  config,
  exactProbMap,
  isDrawing,
  latestWinners,
  latestTeams,
  onTriggerDraw,
  onSelectModality,
}) => {
  const availableItems = items.filter((i) => i.status === 'available');
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  // Flipped card state in TAROT_MONOLITH mode
  const [flippedCardIds, setFlippedCardIds] = useState<Set<string>>(new Set());

  // Blindbox cloche open state
  const [blindboxOpened, setBlindboxOpened] = useState<boolean>(false);

  // Rolling ticker index for CHRONO_REEL & shuffling preview
  const [rollingIndex, setRollingIndex] = useState<number>(0);

  // Canvas ref for 3D CELESTIAL_SPHERE
  const sphereCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<{ yaw: number; pitch: number; speed: number }>({
    yaw: 0.3,
    pitch: 0.15,
    speed: 0.008,
  });

  // When a new draw finishes, automatically reveal cards / open blindbox
  useEffect(() => {
    if (isDrawing) {
      setFlippedCardIds(new Set());
      setBlindboxOpened(false);
      rotationRef.current.speed = 0.085;
    } else {
      rotationRef.current.speed = 0.007;
      if (latestWinners.length > 0) {
        setFlippedCardIds(new Set(latestWinners.map((w) => w.item.id)));
        setBlindboxOpened(true);
      }
    }
  }, [isDrawing, latestWinners]);

  // High-speed escapement ticker while isDrawing is active
  useEffect(() => {
    if (!isDrawing || availableItems.length === 0) return;
    const interval = setInterval(() => {
      setRollingIndex((prev) => (prev + 1) % availableItems.length);
      soundEngine.playTick(0.9 + Math.random() * 0.25, config.soundEnabled);
    }, 65);
    return () => clearInterval(interval);
  }, [isDrawing, availableItems.length, config.soundEnabled]);

  // 3D Fibonacci Sphere Canvas Renderer (CELESTIAL_SPHERE modality)
  useEffect(() => {
    if (config.modality !== 'CELESTIAL_SPHERE' || config.groupStrategy === 'RANDOM_TEAMS') {
      return;
    }
    const canvas = sphereCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const displayList =
      availableItems.length > 0 ? availableItems.slice(0, 48) : items.slice(0, 24);

    const renderSphere = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Subtle radial museum spotlight backdrop
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        20,
        width / 2,
        height / 2,
        Math.min(width, height) * 0.46
      );
      grad.addColorStop(0, 'rgba(212, 175, 55, 0.10)');
      grad.addColorStop(0.6, 'rgba(29, 32, 40, 0.04)');
      grad.addColorStop(1, 'rgba(11, 12, 14, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Outer orbital brass ring
      const radius = Math.min(width, height) * 0.34;
      ctx.strokeStyle = 'rgba(212, 175, 55, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius * 1.08, 0, Math.PI * 2);
      ctx.stroke();

      rotationRef.current.yaw += rotationRef.current.speed;
      const yaw = rotationRef.current.yaw;
      const pitch = rotationRef.current.pitch;

      const n = Math.max(1, displayList.length);
      const goldenRatio = (1 + Math.sqrt(5)) / 2;

      const projectedPoints = displayList.map((item, idx) => {
        const i = idx + 0.5;
        const phi = Math.acos(1 - (2 * i) / n);
        const theta = (2 * Math.PI * i) / goldenRatio;

        const x0 = Math.cos(theta) * Math.sin(phi);
        const y0 = Math.sin(theta) * Math.sin(phi);
        const z0 = Math.cos(phi);

        // Rotate around Y (yaw) and X (pitch)
        const x1 = x0 * Math.cos(yaw) - z0 * Math.sin(yaw);
        const z1 = x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
        const y2 = y0 * Math.cos(pitch) - z1 * Math.sin(pitch);
        const z2 = y0 * Math.sin(pitch) + z1 * Math.cos(pitch);

        const perspective = 2.6 / (2.6 - z2 * 0.85);
        const sx = width / 2 + x1 * radius * perspective;
        const sy = height / 2 + y2 * radius * perspective;

        const isWinner = latestWinners.some((w) => w.item.id === item.id);
        return { item, sx, sy, z: z2, scale: perspective, isWinner };
      });

      // Sort back-to-front
      projectedPoints.sort((a, b) => a.z - b.z);

      for (const pt of projectedPoints) {
        const alpha = Math.max(0.2, Math.min(1, (pt.z + 1.2) / 2.1));
        ctx.save();
        ctx.translate(pt.sx, pt.sy);

        // Node Tag Box
        const label = `${pt.item.accessionNo} · ${pt.item.title.slice(0, 8)}`;
        ctx.font = `${Math.round(11 * pt.scale)}px "Plus Jakarta Sans", "Noto Sans SC", sans-serif`;
        const textWidth = ctx.measureText(label).width;
        const padX = 8 * pt.scale;
        const padY = 5 * pt.scale;

        ctx.fillStyle = pt.isWinner
          ? `rgba(212, 175, 55, ${Math.min(1, alpha + 0.3)})`
          : `rgba(18, 19, 22, ${alpha * 0.88})`;
        ctx.strokeStyle = pt.isWinner
          ? '#F5F2EB'
          : `rgba(212, 175, 55, ${alpha * 0.45})`;
        ctx.lineWidth = pt.isWinner ? 1.8 : 1;

        ctx.beginPath();
        ctx.roundRect(
          -textWidth / 2 - padX,
          -padY * 1.6,
          textWidth + padX * 2,
          padY * 3.2,
          4
        );
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pt.isWinner
          ? '#0B0C0E'
          : `rgba(245, 242, 235, ${alpha})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }

      animId = requestAnimationFrame(renderSphere);
    };

    animId = requestAnimationFrame(renderSphere);
    return () => cancelAnimationFrame(animId);
  }, [config.modality, config.groupStrategy, availableItems, items, latestWinners]);

  // Compute primary CTA label
  const getPrimaryActionLabel = () => {
    if (isDrawing) return '正在演算密码学随机序列...';
    switch (config.groupStrategy) {
      case 'RANDOM_TEAMS':
        return `一键随机分队 (${config.teamCount} 支策展战队)`;
      case 'GROUP_QUOTA': {
        const totalQuota = groups
          .filter((g) => !g.isLocked)
          .reduce((s, g) => s + g.quota, 0);
        return `启动各组定额抽取 (共 ${totalQuota} 项)`;
      }
      case 'TARGET_GROUPS':
        return `从指定组抽取 (${config.batchCount} 项)`;
      case 'GLOBAL_MIX':
      default:
        return config.batchCount > 1
          ? `启动策展连抽 (${config.batchCount} 连抽)`
          : '启动单签策展抽取';
    }
  };

  // Cards to show on TAROT_MONOLITH stage
  const stageCards: DrawItem[] =
    latestWinners.length > 0 && !isDrawing
      ? latestWinners.map((w) => w.item)
      : availableItems.slice(0, Math.max(6, Math.min(8, config.batchCount || 6)));

  const currentRollingItem =
    availableItems[rollingIndex % Math.max(1, availableItems.length)] || items[0];

  return (
    <section
      aria-label="多模态全息抽签中央展台"
      data-testid="multimodal-draw-stage"
      data-modality={config.modality}
      data-drawing={isDrawing ? 'true' : 'false'}
      className="flex flex-col bg-[#121316]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-full relative"
    >
      {/* Stage Top Bar: Modality Quick Switcher & Pool Status */}
      <div className="px-5 py-3.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#0B0C0E]/40">
        <div>
          <h2 className="text-base font-display font-semibold tracking-wide text-[#F5F2EB]">
            02. 全息策展抽签主舞台
          </h2>
          <p className="text-xs text-stone-400 font-mono-tabular mt-0.5">
            当前策略: {config.groupStrategy} · 候选池 {availableItems.length} 项待命
          </p>
        </div>

        {/* Modality Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-[#0B0C0E] rounded-lg border border-white/10">
          {(
            [
              { id: 'TAROT_MONOLITH', label: '卡牌翻转', icon: Layers },
              { id: 'CELESTIAL_SPHERE', label: '3D球体', icon: Globe },
              { id: 'CHRONO_REEL', label: '机械滚轮', icon: Disc },
              { id: 'CURIO_BLINDBOX', label: '展柜盲盒', icon: Box },
            ] as const
          ).map((m) => {
            const Icon = m.icon;
            const active = config.modality === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectModality(m.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Viewport */}
      <div className="flex-1 flex flex-col justify-between p-6 relative overflow-y-auto">
        {/* Ambient Museum Radial Glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(212,175,55,0.11),transparent_70%)]"
        />

        {/* Curatorial Stage Telemetry & Active Group Summary Bar */}
        <div className="relative z-10 grid grid-cols-3 gap-3 pb-4 mb-4 border-b border-white/10 text-xs">
          <div className="p-3 rounded-lg bg-[#0B0C0E]/60 border border-white/[0.07]">
            <div className="text-stone-400">活跃待抽签项</div>
            <div className="text-lg font-mono-tabular font-semibold text-[#F5F2EB] mt-0.5">
              {availableItems.length}{' '}
              <span className="text-xs font-normal text-stone-500">
                / 共 {items.length} 项
              </span>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0C0E]/60 border border-white/[0.07]">
            <div className="text-stone-400">当前分组抽取策略</div>
            <div className="text-sm font-semibold text-[#D4AF37] mt-1 truncate">
              {config.groupStrategy === 'GLOBAL_MIX' && '全局混抽 (跨组加权)'}
              {config.groupStrategy === 'TARGET_GROUPS' &&
                `按指定组抽 (${config.selectedGroupIds.length} 组)`}
              {config.groupStrategy === 'GROUP_QUOTA' && '各组定额同步抽取'}
              {config.groupStrategy === 'RANDOM_TEAMS' &&
                `蛇形均衡分队 (${config.teamCount} 队)`}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-[#0B0C0E]/60 border border-white/[0.07]">
            <div className="text-stone-400">活跃池总权重积分</div>
            <div className="text-lg font-mono-tabular font-semibold text-[#F5F2EB] mt-0.5">
              {availableItems.reduce((s, i) => s + i.weight, 0).toFixed(1)}x{' '}
              <span className="text-xs font-normal text-stone-500">
                · {groups.filter((g) => !g.isLocked).length} 展区开放
              </span>
            </div>
          </div>
        </div>

        {/* CASE 1: RANDOM_TEAMS Strategy View */}
        {config.groupStrategy === 'RANDOM_TEAMS' ? (
          <div className="relative z-10 flex-1 flex flex-col justify-start space-y-5 pt-2">
            <div className="text-center space-y-1">
              <div className="text-xs uppercase tracking-widest text-[#D4AF37] font-mono-tabular">
                CURATORIAL SNAKE-DRAFT PARTITION
              </div>
              <h3 className="text-2xl font-display font-semibold text-[#F5F2EB]">
                蛇形加权均衡随机分队沙盘
              </h3>
              <p className="text-xs text-stone-400 max-w-lg mx-auto">
                点击下方主按钮，系统将使用密码学洗牌将 {availableItems.length} 名待抽成员均衡分配至 {config.teamCount} 支策展战队。
              </p>
            </div>

            {latestTeams.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto w-full">
                {Array.from({ length: config.teamCount }).map((_, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-dashed border-white/15 bg-[#0B0C0E]/50 text-center space-y-1"
                  >
                    <Users className="w-5 h-5 text-[#D4AF37]/60 mx-auto" />
                    <div className="text-xs font-semibold text-stone-300">
                      第 {idx + 1} 策展战队
                    </div>
                    <div className="text-[11px] text-stone-500 font-mono-tabular">
                      预计分配 ~{Math.ceil(availableItems.length / config.teamCount)} 项
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {latestTeams.map((team) => (
                  <div
                    key={team.teamId}
                    className="p-4 rounded-xl bg-[#0B0C0E]/85 border border-[#D4AF37]/35 flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-sm font-display font-semibold text-[#D4AF37]">
                        {team.teamName}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-stone-400">
                        {team.members.length} 人 · 权重和 {team.totalWeightScore}
                      </span>
                    </div>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {team.members.map((m, mIdx) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between text-xs py-1 border-b border-white/[0.04] last:border-0"
                        >
                          <span className="text-[#F5F2EB] font-medium truncate">
                            {mIdx + 1}. {m.title}
                          </span>
                          <span className="text-[11px] font-mono-tabular text-stone-400 shrink-0 ml-2">
                            {groupMap.get(m.groupId)?.name.split('·')[0].trim()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* CASE 2: Standard Multimodal Stage (4 Modalities) */
          <div className="relative z-10 flex-1 flex flex-col justify-start pt-1">
            {/* MODALITY 1: TAROT_MONOLITH (3D Obsidian Flip Cards) */}
            {config.modality === 'TAROT_MONOLITH' && (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <span className="text-xs font-mono-tabular uppercase tracking-widest text-[#D4AF37]">
                    MODALITY I · OBSIDIAN TAROT MONOLITH
                  </span>
                  <h3 className="text-xl font-display font-semibold text-[#F5F2EB]">
                    {latestWinners.length > 0 && !isDrawing
                      ? `本轮策展揭晓 · 共 ${latestWinners.length} 项中签`
                      : '黑曜石典藏卡牌阵列 · 点击单卡翻转或一键启动抽签'}
                  </h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                  {stageCards.map((cardItem, idx) => {
                    const isFlipped =
                      !isDrawing &&
                      (flippedCardIds.has(cardItem.id) || latestWinners.length > 0);
                    const winnerEntry = latestWinners.find(
                      (w) => w.item.id === cardItem.id
                    );
                    const prob =
                      winnerEntry?.theoreticalProbability ??
                      exactProbMap.get(cardItem.id) ??
                      0;

                    return (
                      <button
                        key={`${cardItem.id}-${idx}`}
                        type="button"
                        onClick={() => {
                          setFlippedCardIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(cardItem.id)) next.delete(cardItem.id);
                            else next.add(cardItem.id);
                            return next;
                          });
                          soundEngine.playTick(1.1, config.soundEnabled);
                        }}
                        className={`group perspective-1200 h-52 w-full text-left focus:outline-none ${
                          isDrawing ? 'animate-pulse' : ''
                        }`}
                      >
                        <div
                          className={`relative w-full h-full duration-500 preserve-3d transition-transform ${
                            isFlipped ? 'rotate-y-180' : ''
                          }`}
                        >
                          {/* Card Back: Obsidian Monolith */}
                          <div className="absolute inset-0 backface-hidden rounded-xl bg-[#0B0C0E] border border-[#D4AF37]/35 p-4 flex flex-col items-center justify-between hover:border-[#D4AF37] transition-colors">
                            <div className="w-full flex items-center justify-between text-[10px] font-mono-tabular text-stone-500">
                              <span>LUMINA ARCHIVE</span>
                              <span>#{String(idx + 1).padStart(2, '0')}</span>
                            </div>
                            <div className="w-14 h-14 rounded-full border border-[#D4AF37]/40 flex items-center justify-center bg-[#D4AF37]/5">
                              <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                            </div>
                            <div className="text-[11px] text-stone-400 font-display tracking-widest uppercase">
                              点击翻转或启动抽签
                            </div>
                          </div>

                          {/* Card Front: Curated Artifact / Winner */}
                          <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl bg-gradient-to-b from-[#1B1D24] to-[#0B0C0E] border-2 border-[#D4AF37] p-4 flex flex-col justify-between shadow-xl">
                            <div className="flex items-center justify-between text-[11px] font-mono-tabular text-[#D4AF37]">
                              <span>{cardItem.accessionNo}</span>
                              <span>{(prob * 100).toFixed(2)}%</span>
                            </div>

                            {cardItem.mediaType === 'image' && cardItem.imageUrl ? (
                              <img
                                src={cardItem.imageUrl}
                                alt={cardItem.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-20 object-cover rounded border border-white/15 my-1"
                              />
                            ) : (
                              <div className="my-auto py-1">
                                <div className="text-lg font-display font-bold text-[#F5F2EB] leading-snug line-clamp-2">
                                  {cardItem.title}
                                </div>
                                {cardItem.subtitle && (
                                  <div className="text-xs text-stone-400 mt-1 line-clamp-2">
                                    {cardItem.subtitle}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-300">
                              <span className="truncate">
                                {groupMap
                                  .get(cardItem.groupId)
                                  ?.name.split('·')[0]
                                  .trim() || '典藏展区'}
                              </span>
                              <span className="font-mono-tabular text-[#D4AF37]">
                                {cardItem.weight.toFixed(1)}x
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODALITY 2: CELESTIAL_SPHERE (3D Fibonacci Orbital Canvas) */}
            {config.modality === 'CELESTIAL_SPHERE' && (
              <div className="flex flex-col items-center justify-center my-auto space-y-3">
                <div className="text-center">
                  <span className="text-xs font-mono-tabular uppercase tracking-widest text-[#D4AF37]">
                    MODALITY II · 3D CELESTIAL FIBONACCI SPHERE
                  </span>
                  <h3 className="text-lg font-display font-semibold text-[#F5F2EB]">
                    3D 引力球体星云 · 实时球面正交投影
                  </h3>
                </div>

                <div className="relative flex items-center justify-center">
                  <canvas
                    ref={sphereCanvasRef}
                    width={520}
                    height={320}
                    className="max-w-full h-auto rounded-xl border border-white/10 bg-[#0B0C0E]/70"
                  />
                </div>
              </div>
            )}

            {/* MODALITY 3: CHRONO_REEL (Horological Damped Mechanical Reel) */}
            {config.modality === 'CHRONO_REEL' && (
              <div className="max-w-xl mx-auto w-full my-auto space-y-5">
                <div className="text-center space-y-1">
                  <span className="text-xs font-mono-tabular uppercase tracking-widest text-[#D4AF37]">
                    MODALITY III · HOROLOGICAL CHRONO REEL
                  </span>
                  <h3 className="text-xl font-display font-semibold text-[#F5F2EB]">
                    瑞士陀飞轮精密阻尼滚轮
                  </h3>
                </div>

                <div className="relative bg-[#0B0C0E] border-2 border-[#D4AF37]/50 rounded-2xl p-6 shadow-2xl overflow-hidden">
                  {/* Horizontal hairlines indicating center escapement lock */}
                  <div className="border-y border-[#D4AF37]/40 py-6 px-4 bg-white/[0.02] rounded-lg text-center space-y-2">
                    {isDrawing ? (
                      <>
                        <div className="text-xs font-mono-tabular text-[#D4AF37]">
                          {currentRollingItem?.accessionNo || 'LOT-000'} · 高速擒纵寻址中
                        </div>
                        <div className="text-3xl font-display font-bold text-[#F5F2EB] tracking-wide">
                          {currentRollingItem?.title || '候选中...'}
                        </div>
                        <div className="text-xs text-stone-400">
                          {currentRollingItem?.subtitle || '陀飞轮惯性运转中'}
                        </div>
                      </>
                    ) : latestWinners.length > 0 ? (
                      <div className="space-y-3">
                        {latestWinners.map((w) => (
                          <div
                            key={w.drawIndex}
                            className="py-2 border-b border-white/10 last:border-0"
                          >
                            <div className="text-xs font-mono-tabular text-[#D4AF37]">
                              #{String(w.drawIndex).padStart(2, '0')} · {w.item.accessionNo} ·{' '}
                              {w.groupName} · 理论中签率{' '}
                              {(w.theoreticalProbability * 100).toFixed(2)}%
                            </div>
                            <div className="text-2xl font-display font-bold text-[#F5F2EB] mt-0.5">
                              {w.item.title}
                            </div>
                            {w.item.subtitle && (
                              <div className="text-xs text-stone-400 mt-0.5">
                                {w.item.subtitle}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="text-xs font-mono-tabular text-stone-400">
                          ESCAPEMENT READY · {availableItems.length} ITEMS IN CYLINDER
                        </div>
                        <div className="text-2xl font-display font-semibold text-[#F5F2EB]">
                          {currentRollingItem?.title || '等待启动滚轮'}
                        </div>
                        <div className="text-xs text-stone-500">
                          点击下方启动按钮触发阻尼惯性旋转
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MODALITY 4: CURIO_BLINDBOX (Museum Glass Vitrine Blindbox) */}
            {config.modality === 'CURIO_BLINDBOX' && (
              <div className="max-w-lg mx-auto w-full my-auto space-y-5 text-center">
                <div className="space-y-1">
                  <span className="text-xs font-mono-tabular uppercase tracking-widest text-[#D4AF37]">
                    MODALITY IV · MUSEUM VITRINE BLINDBOX
                  </span>
                  <h3 className="text-xl font-display font-semibold text-[#F5F2EB]">
                    博物馆恒温玻璃展柜盲盒
                  </h3>
                </div>

                <div className="relative mx-auto w-full max-w-md min-h-[250px] rounded-2xl bg-gradient-to-b from-white/[0.06] to-[#0B0C0E] border border-[#D4AF37]/40 p-6 flex flex-col items-center justify-center overflow-hidden">
                  {!blindboxOpened || isDrawing ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (latestWinners.length > 0) {
                          setBlindboxOpened(true);
                          soundEngine.playRevealChime(config.soundEnabled);
                        } else {
                          onTriggerDraw();
                        }
                      }}
                      className="space-y-3 group focus:outline-none"
                    >
                      <div
                        className={`w-20 h-20 rounded-2xl border border-[#D4AF37]/60 bg-[#D4AF37]/10 flex items-center justify-center mx-auto transition-transform duration-300 group-hover:scale-105 ${
                          isDrawing ? 'animate-bounce' : ''
                        }`}
                      >
                        <Box className="w-9 h-9 text-[#D4AF37]" />
                      </div>
                      <div className="text-base font-display font-semibold text-[#F5F2EB]">
                        {isDrawing
                          ? '正在开启恒温玻璃展罩...'
                          : '磨砂展柜已封存 · 点击揭晓盲盒藏品'}
                      </div>
                      <div className="text-xs text-stone-400 font-mono-tabular">
                        内含 {availableItems.length} 件候选展品 · 权重引擎已就绪
                      </div>
                    </button>
                  ) : (
                    <div className="w-full space-y-3">
                      <div className="text-xs font-mono-tabular text-[#D4AF37] uppercase tracking-widest">
                        ✦ VITRINE UNVEILED · 展柜揭晓 ✦
                      </div>
                      <div className="grid grid-cols-1 gap-3 max-h-56 overflow-y-auto">
                        {latestWinners.map((w) => (
                          <div
                            key={w.drawIndex}
                            className="p-3.5 rounded-xl bg-[#0B0C0E]/90 border border-[#D4AF37] flex items-center gap-3.5 text-left"
                          >
                            {w.item.mediaType === 'image' && w.item.imageUrl && (
                              <img
                                src={w.item.imageUrl}
                                alt={w.item.title}
                                referrerPolicy="no-referrer"
                                className="w-16 h-16 rounded-lg object-cover border border-white/15 shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-mono-tabular text-[#D4AF37]">
                                {w.item.accessionNo} · {w.groupName} · 概率{' '}
                                {(w.theoreticalProbability * 100).toFixed(2)}%
                              </div>
                              <div className="text-lg font-display font-bold text-[#F5F2EB] truncate">
                                {w.item.title}
                              </div>
                              {w.item.subtitle && (
                                <div className="text-xs text-stone-400 truncate">
                                  {w.item.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Winner Spotlight Banner (Shown beneath CELESTIAL_SPHERE or anytime winners exist) */}
            {latestWinners.length > 0 && !isDrawing && (
              <div
                data-testid="winner-spotlight-banner"
                className="mt-5 p-4 rounded-xl bg-[#0B0C0E]/90 border border-[#D4AF37]/50"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1.5">
                    <Award className="w-4 h-4" />
                    本轮公证中签结果 ({latestWinners.length} 项)
                  </span>
                  <span className="text-[11px] font-mono-tabular text-stone-400">
                    已同步写入底部公证账本
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {latestWinners.map((winner) => (
                    <div
                      key={`${winner.item.id}-${winner.drawIndex}`}
                      className="p-2.5 rounded-lg bg-white/[0.03] border border-white/10 flex items-center gap-2.5"
                    >
                      {winner.item.mediaType === 'image' && winner.item.imageUrl && (
                        <img
                          src={winner.item.imageUrl}
                          alt={winner.item.title}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded object-cover border border-white/15 shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#F5F2EB] truncate">
                          #{winner.drawIndex} {winner.item.title}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-stone-400 truncate">
                          {winner.groupName.split('·')[0].trim()} · 概率{' '}
                          {(winner.theoreticalProbability * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stage Bottom Master Action Bar */}
        <div className="relative z-10 pt-5 mt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-stone-400 font-mono-tabular">
            {config.allowReplacement ? '模式: 放回抽签' : '模式: 不放回抽签'} ·{' '}
            {config.enableWeightEngine ? '加权概率引擎已激活' : '全员等概率模式'}
          </div>

          <div className="flex items-center gap-3">
            {config.modality === 'TAROT_MONOLITH' && stageCards.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (flippedCardIds.size === stageCards.length) {
                    setFlippedCardIds(new Set());
                  } else {
                    setFlippedCardIds(new Set(stageCards.map((c) => c.id)));
                  }
                }}
                className="px-3.5 py-2.5 text-xs font-medium text-stone-300 hover:text-white bg-white/[0.04] border border-white/15 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCw className="w-3.5 h-3.5" />
                {flippedCardIds.size === stageCards.length ? '全部盖回背面' : '全翻开检视'}
              </button>
            )}

            <button
              type="button"
              data-testid="execute-draw-button"
              disabled={isDrawing || availableItems.length === 0}
              onClick={onTriggerDraw}
              className="px-6 py-2.5 text-sm font-semibold bg-[#D4AF37] text-[#0B0C0E] rounded-lg hover:bg-[#e2be46] disabled:opacity-40 disabled:pointer-events-none transition-all shadow-lg flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Shuffle className="w-4 h-4" />
              {getPrimaryActionLabel()}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
