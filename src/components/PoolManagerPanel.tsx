import React, { useState } from 'react';
import {
  Plus,
  Upload,
  Search,
  RotateCcw,
  Trash2,
  Lock,
  Unlock,
  SlidersHorizontal,
  FolderPlus,
} from 'lucide-react';
import {
  CuratorialColorToken,
  DrawGroup,
  DrawItem,
} from '../types/draw';
import { COLOR_TOKEN_STYLES } from '../utils/drawEngine';

interface PoolManagerPanelProps {
  items: DrawItem[];
  groups: DrawGroup[];
  exactProbMap: Map<string, number>;
  onOpenIngestionModal: () => void;
  onAddSingleItem: (item: {
    title: string;
    subtitle?: string;
    groupId: string;
    weight: number;
  }) => void;
  onUpdateItemWeight: (id: string, weight: number) => void;
  onUpdateItemFixedProb: (id: string, fixedProb: number | undefined) => void;
  onToggleItemStatus: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onResetAllDrawn: () => void;
  onNormalizeAllWeights: () => void;
  onAddGroup: (name: string, colorToken: CuratorialColorToken) => void;
  onToggleGroupLock: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
}

export const PoolManagerPanel: React.FC<PoolManagerPanelProps> = ({
  items,
  groups,
  exactProbMap,
  onOpenIngestionModal,
  onAddSingleItem,
  onUpdateItemWeight,
  onUpdateItemFixedProb,
  onToggleItemStatus,
  onDeleteItem,
  onResetAllDrawn,
  onNormalizeAllWeights,
  onAddGroup,
  onToggleGroupLock,
  onDeleteGroup,
}) => {
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'available' | 'drawn' | 'image'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick add single item state
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newGroupId, setNewGroupId] = useState(groups[0]?.id || '');
  const [newWeight, setNewWeight] = useState('1.0');

  // Quick add group state
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState<CuratorialColorToken>('brass');

  // Expanded item ID for fine-grained probability locking
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const filteredItems = items.filter((item) => {
    if (selectedGroupFilter !== 'ALL' && item.groupId !== selectedGroupFilter) {
      return false;
    }
    if (statusFilter === 'available' && item.status !== 'available') return false;
    if (statusFilter === 'drawn' && item.status !== 'drawn') return false;
    if (statusFilter === 'image' && item.mediaType !== 'image') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.accessionNo.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const availableCount = items.filter((i) => i.status === 'available').length;
  const drawnCount = items.filter((i) => i.status === 'drawn').length;

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddSingleItem({
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || undefined,
      groupId: newGroupId || groups[0]?.id || 'default',
      weight: Math.max(0.01, parseFloat(newWeight) || 1.0),
    });
    setNewTitle('');
    setNewSubtitle('');
    setNewWeight('1.0');
    setIsAddingItem(false);
  };

  const handleAddGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    onAddGroup(newGroupName.trim(), newGroupColor);
    setNewGroupName('');
    setIsAddingGroup(false);
  };

  return (
    <aside
      aria-label="抽签池与分组可视化管理面板"
      className="flex flex-col bg-[#121316]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden h-full"
    >
      {/* Top Header & Universal Import Trigger */}
      <div className="p-4 border-b border-white/10 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-display font-semibold tracking-wide text-[#F5F2EB] whitespace-nowrap">
              01. 典藏签池与分组管理
            </h2>
            <p className="text-xs text-stone-400 font-mono-tabular mt-0.5 whitespace-nowrap">
              待抽 {availableCount} · 已中 {drawnCount} · 共 {items.length} 项
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenIngestionModal}
            className="px-3 py-2 text-xs font-semibold bg-[#D4AF37] text-[#0B0C0E] rounded-lg hover:bg-[#e0bd42] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            全能导入
          </button>
        </div>

        {/* Group Filter & Visual Management Strip */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>策展分组矩阵 ({groups.length})</span>
            <button
              type="button"
              onClick={() => setIsAddingGroup((v) => !v)}
              className="text-[#D4AF37] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              新建分组
            </button>
          </div>

          {isAddingGroup && (
            <form
              onSubmit={handleAddGroupSubmit}
              className="p-2.5 bg-[#0B0C0E] border border-white/15 rounded-lg space-y-2"
            >
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="输入新分组名称，如：特邀嘉宾池"
                aria-label="新分组名称"
                className="w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/15 rounded text-xs text-[#F5F2EB] focus:outline-none focus:border-[#D4AF37]"
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  value={newGroupColor}
                  onChange={(e) => setNewGroupColor(e.target.value as CuratorialColorToken)}
                  aria-label="分组策展色标"
                  className="px-2 py-1 bg-[#121316] border border-white/15 rounded text-xs text-stone-200"
                >
                  {(Object.keys(COLOR_TOKEN_STYLES) as CuratorialColorToken[]).map((token) => (
                    <option key={token} value={token}>
                      {COLOR_TOKEN_STYLES[token].label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsAddingGroup(false)}
                    className="px-2.5 py-1 text-xs text-stone-400 hover:text-white"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 text-xs font-semibold bg-[#D4AF37] text-[#0B0C0E] rounded"
                  >
                    创建
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Interactive Group Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedGroupFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedGroupFilter === 'ALL'
                  ? 'bg-white/15 text-[#F5F2EB]'
                  : 'bg-white/[0.03] text-stone-400 hover:text-stone-200'
              }`}
            >
              全部 ({items.length})
            </button>
            {groups.map((grp) => {
              const count = items.filter((i) => i.groupId === grp.id).length;
              const style = COLOR_TOKEN_STYLES[grp.colorToken] || COLOR_TOKEN_STYLES.brass;
              const isSelected = selectedGroupFilter === grp.id;
              return (
                <div
                  key={grp.id}
                  className={`flex items-center rounded-md border transition-colors shrink-0 ${
                    isSelected
                      ? `${style.borderClass} bg-white/10`
                      : 'border-transparent bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedGroupFilter(grp.id)}
                    className={`px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${
                      isSelected ? style.textClass : 'text-stone-300'
                    }`}
                  >
                    {grp.name.split('·')[0].trim()} ({count})
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleGroupLock(grp.id)}
                    title={grp.isLocked ? '已锁定（不参与混抽），点击解锁' : '点击锁定该组'}
                    aria-label={`${grp.isLocked ? '解锁' : '锁定'} ${grp.name}`}
                    className="pr-1.5 text-stone-500 hover:text-stone-200"
                  >
                    {grp.isLocked ? (
                      <Lock className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Unlock className="w-3 h-3 opacity-50 hover:opacity-100" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Search & Secondary Filter Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索编号、姓名或备注..."
              aria-label="搜索签池"
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#0B0C0E] border border-white/10 rounded-lg text-xs text-[#F5F2EB] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="flex items-center bg-[#0B0C0E] p-0.5 rounded-lg border border-white/10 shrink-0">
            {(
              [
                { id: 'ALL', label: '全' },
                { id: 'available', label: '待抽' },
                { id: 'drawn', label: '已中' },
                { id: 'image', label: '图像' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st.id
                    ? 'bg-white/15 text-[#F5F2EB] font-medium'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0B0C0E]/60 border-b border-white/10 text-xs">
        <button
          type="button"
          onClick={() => {
            setNewGroupId(
              selectedGroupFilter !== 'ALL' ? selectedGroupFilter : groups[0]?.id || ''
            );
            setIsAddingItem((v) => !v);
          }}
          className="text-[#D4AF37] hover:underline font-medium flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          手动新增签项
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onNormalizeAllWeights}
            className="text-stone-400 hover:text-[#F5F2EB] transition-colors whitespace-nowrap shrink-0"
            title="将所有签项权重重置为 1.0x 等概率"
          >
            等权重置
          </button>
          {drawnCount > 0 && (
            <button
              type="button"
              onClick={onResetAllDrawn}
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              放回已中 ({drawnCount})
            </button>
          )}
        </div>
      </div>

      {/* Inline Add Single Item Drawer */}
      {isAddingItem && (
        <form
          onSubmit={handleQuickAddSubmit}
          className="p-3.5 bg-[#0B0C0E] border-b border-white/15 space-y-2.5"
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="签项主标题 / 姓名 *"
              aria-label="新签项主标题"
              className="px-2.5 py-1.5 bg-white/[0.04] border border-white/15 rounded text-xs text-[#F5F2EB] focus:outline-none focus:border-[#D4AF37]"
            />
            <input
              type="text"
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
              placeholder="副标题 / 部门备注 (可选)"
              aria-label="新签项副标题"
              className="px-2.5 py-1.5 bg-white/[0.04] border border-white/15 rounded text-xs text-[#F5F2EB] focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              aria-label="选择所属分组"
              className="flex-1 px-2.5 py-1.5 bg-[#121316] border border-white/15 rounded text-xs text-stone-200"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.1"
              min="0.01"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              aria-label="初始权重"
              className="w-20 px-2 py-1.5 bg-white/[0.04] border border-white/15 rounded text-xs text-[#D4AF37] font-mono-tabular text-right"
              title="初始相对权重"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold bg-[#D4AF37] text-[#0B0C0E] rounded whitespace-nowrap shrink-0"
            >
              入库
            </button>
          </div>
        </form>
      )}

      {/* Selected Group Management Header if filtering a single group */}
      {selectedGroupFilter !== 'ALL' && groupMap.get(selectedGroupFilter) && (
        <div className="px-4 py-2 bg-white/[0.02] border-b border-white/10 flex items-center justify-between text-xs">
          <span className="text-stone-300 truncate">
            {groupMap.get(selectedGroupFilter)?.name}
          </span>
          {groups.length > 1 && (
            <button
              type="button"
              onClick={() => {
                onDeleteGroup(selectedGroupFilter);
                setSelectedGroupFilter('ALL');
              }}
              className="text-stone-500 hover:text-rose-400 transition-colors whitespace-nowrap shrink-0"
            >
              删除此分组
            </button>
          )}
        </div>
      )}

      {/* Scrollable Curatorial Item List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06] max-h-[520px] xl:max-h-none">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-xs text-stone-400">当前筛选条件下暂无签项</p>
            <button
              type="button"
              onClick={() => {
                setSelectedGroupFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
              className="text-xs text-[#D4AF37] hover:underline"
            >
              重置筛选条件
            </button>
          </div>
        ) : (
          filteredItems.map((item) => {
            const grp = groupMap.get(item.groupId);
            const prob = exactProbMap.get(item.id) ?? 0;
            const probPercent = (prob * 100).toFixed(2);
            const isExpanded = expandedItemId === item.id;

            return (
              <div
                key={item.id}
                className={`p-3 transition-colors ${
                  item.status === 'drawn'
                    ? 'opacity-50 bg-black/20'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  {/* Optional Thumbnail for Image Items */}
                  {item.mediaType === 'image' && item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded object-cover border border-white/15 shrink-0 mt-0.5"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono-tabular text-[11px] text-stone-500 shrink-0">
                        {item.accessionNo}
                      </span>
                      <span className="text-stone-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-sm font-medium text-[#F5F2EB] truncate">
                        {item.title}
                      </span>
                    </div>

                    {item.subtitle && (
                      <p className="text-xs text-stone-400 truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    )}

                    {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-400 mt-1 font-mono-tabular">
                      <span className="text-stone-300">
                        {grp ? grp.name.split('·')[0].trim() : '默认展区'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {item.status === 'available'
                          ? `概率 ${probPercent}%`
                          : '已中签归档'}
                      </span>
                      {item.fixedProbability !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#D4AF37]">
                            锁定 {(item.fixedProbability * 100).toFixed(1)}%
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Controls: Weight Stepper & Status Actions */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 bg-[#0B0C0E] border border-white/10 rounded px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateItemWeight(
                            item.id,
                            Math.max(0.1, Number((item.weight - 0.5).toFixed(2)))
                          )
                        }
                        aria-label={`降低 ${item.title} 权重`}
                        className="text-xs text-stone-400 hover:text-white px-1"
                      >
                        -
                      </button>
                      <span className="text-xs font-mono-tabular text-[#D4AF37] min-w-[36px] text-center">
                        {item.weight.toFixed(1)}x
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateItemWeight(
                            item.id,
                            Number((item.weight + 0.5).toFixed(2))
                          )
                        }
                        aria-label={`增加 ${item.title} 权重`}
                        className="text-xs text-stone-400 hover:text-white px-1"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-stone-500">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedItemId(isExpanded ? null : item.id)
                        }
                        title="精确设置锁定概率或权重"
                        aria-label={`配置 ${item.title} 精确概率`}
                        className={`hover:text-[#D4AF37] transition-colors ${
                          isExpanded ? 'text-[#D4AF37]' : ''
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleItemStatus(item.id)}
                        title={
                          item.status === 'available'
                            ? '标记为已中签/暂离'
                            : '重新放回活跃签池'
                        }
                        aria-label={
                          item.status === 'available'
                            ? `将 ${item.title} 移出待抽池`
                            : `将 ${item.title} 放回待抽池`
                        }
                        className="hover:text-stone-200 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        aria-label={`删除 ${item.title}`}
                        className="hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Precision Probability Drawer */}
                {isExpanded && (
                  <div className="mt-2.5 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
                    <label className="text-stone-400">
                      锁定绝对中签率 (0~99%):
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="99"
                        step="1"
                        placeholder="未锁定"
                        value={
                          item.fixedProbability !== undefined
                            ? Math.round(item.fixedProbability * 100)
                            : ''
                        }
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val) || val <= 0) {
                            onUpdateItemFixedProb(item.id, undefined);
                          } else {
                            onUpdateItemFixedProb(
                              item.id,
                              Math.min(0.99, val / 100)
                            );
                          }
                        }}
                        className="w-20 px-2 py-1 bg-[#0B0C0E] border border-white/15 rounded text-right font-mono-tabular text-[#D4AF37]"
                      />
                      <span className="text-stone-400">%</span>
                      {item.fixedProbability !== undefined && (
                        <button
                          type="button"
                          onClick={() => onUpdateItemFixedProb(item.id, undefined)}
                          className="text-stone-400 hover:text-white underline ml-1"
                        >
                          解除
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
