import React from 'react';
import { Download, RotateCcw, Trash2, History } from 'lucide-react';
import { DrawHistorySession } from '../types/draw';

interface ArchivalLedgerProps {
  history: DrawHistorySession[];
  drawnCount: number;
  onExportHistoryCsv: () => void;
  onResetAllDrawn: () => void;
  onClearHistory: () => void;
}

export const ArchivalLedger: React.FC<ArchivalLedgerProps> = ({
  history,
  drawnCount,
  onExportHistoryCsv,
  onResetAllDrawn,
  onClearHistory,
}) => {
  return (
    <section
      id="archival-ledger-section"
      aria-label="典藏公证历史账本"
      className="bg-[#121316]/90 backdrop-blur-xl border border-white/10 rounded-xl p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-3.5">
        <div className="flex items-center gap-2.5">
          <History className="w-4 h-4 text-[#D4AF37]" />
          <div>
            <h2 className="text-base font-display font-semibold tracking-wide text-[#F5F2EB]">
              04. 典藏公证账本与审计记录
            </h2>
            <p className="text-xs text-stone-400 font-mono-tabular">
              共记录 {history.length} 轮抽签/分队快照 · 支持导出含瞬时理论概率的 CSV 报告
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {drawnCount > 0 && (
            <button
              type="button"
              onClick={onResetAllDrawn}
              className="px-3.5 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              将已中签项 ({drawnCount}) 全部放回签池
            </button>
          )}

          <button
            type="button"
            disabled={history.length === 0}
            onClick={onExportHistoryCsv}
            className="px-3.5 py-1.5 text-xs font-medium text-[#F5F2EB] bg-white/[0.06] border border-white/15 rounded-lg hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
            导出公证 CSV 报告
          </button>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="px-3 py-1.5 text-xs text-stone-400 hover:text-rose-400 transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空记录
            </button>
          )}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="py-6 text-center text-xs text-stone-500">
          尚未产生抽签或随机分队记录。点击中央展台的「启动策展抽签」即可生成实时数学公证快照。
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {history.map((session, sIdx) => {
            const timeStr = new Date(session.timestamp).toLocaleTimeString('zh-CN', {
              hour12: false,
            });
            const roundNo = history.length - sIdx;

            return (
              <div
                key={session.sessionId}
                className="p-3.5 rounded-lg bg-[#0B0C0E]/70 border border-white/10 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400 font-mono-tabular">
                  <div>
                    <span>第 #{String(roundNo).padStart(2, '0')} 轮公证记录</span>
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[#D4AF37]">{session.strategy}</span>
                    <span className="mx-1.5" aria-hidden="true">
                      ·
                    </span>
                    <span>模态: {session.modality}</span>
                  </div>
                  <span>{timeStr}</span>
                </div>

                {session.winners && session.winners.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs pt-1">
                    {session.winners.map((w) => (
                      <div
                        key={w.drawIndex}
                        className="text-[#F5F2EB] font-mono-tabular flex items-center gap-1.5"
                      >
                        <span className="text-stone-500">#{w.drawIndex}</span>
                        <span className="font-sans font-semibold">{w.item.title}</span>
                        <span className="text-stone-500">·</span>
                        <span className="text-stone-400 font-sans">
                          {w.groupName.split('·')[0].trim()}
                        </span>
                        <span className="text-stone-500">·</span>
                        <span className="text-[#D4AF37]">
                          {(w.theoreticalProbability * 100).toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {session.teams && session.teams.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                    {session.teams.map((t) => (
                      <div key={t.teamId} className="text-stone-300">
                        <span className="text-[#D4AF37] font-semibold">
                          {t.teamName}:
                        </span>{' '}
                        {t.members.map((m) => m.title).join('、')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
