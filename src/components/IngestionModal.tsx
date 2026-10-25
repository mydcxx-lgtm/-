import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Upload,
  X,
  Download,
  Sparkles,
  Check,
  AlertCircle,
} from 'lucide-react';
import { DrawGroup, DrawItem, ParsedImportBatch } from '../types/draw';
import {
  parseUploadedFiles,
  parseTextContent,
  downloadSampleCsvTemplate,
} from '../utils/fileParser';
import { createArtifactSvgDataUrl } from '../utils/drawEngine';

interface IngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: DrawGroup[];
  onCommitImport: (
    items: Omit<DrawItem, 'id' | 'accessionNo' | 'status'>[],
    detectedGroups: string[],
    mode: 'append' | 'replace'
  ) => void;
}

export const IngestionModal: React.FC<IngestionModalProps> = ({
  isOpen,
  onClose,
  groups,
  onCommitImport,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'paste' | 'gallery'>('files');
  const [defaultGroupName, setDefaultGroupName] = useState<string>(
    groups[0]?.name || 'A馆 · 首席策展与架构组'
  );
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  // Parsed preview state
  const [parsedBatches, setParsedBatches] = useState<ParsedImportBatch[]>([]);

  // Smart paste state
  const [rawPasteText, setRawPasteText] = useState<string>(
    '宋宴清 | A馆 · 首席策展与架构组 | 2.0 | 建筑空间叙事主理人\n江逾白 | B馆 · 全息数字交互实验室 | 1.5 | 实时流体动力学算法设计师\n许星河 | C馆 · 典藏文物修复中心 | 1.0 | 敦煌壁画矿物颜料研究员\n唐晚舟 | A馆 · 首席策展与架构组 | 1.8 | 当代装置艺术策展人'
  );
  const [delimiterMode, setDelimiterMode] = useState<
    'auto' | 'newline' | 'comma' | 'pause' | 'semicolon'
  >('auto');

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsParsing(true);
    try {
      const files = Array.from(fileList);
      const batches = await parseUploadedFiles(files, defaultGroupName);
      setParsedBatches((prev) => [...prev, ...batches]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleParseTextPreview = () => {
    const res = parseTextContent(rawPasteText, delimiterMode, defaultGroupName);
    setParsedBatches([
      {
        sourceType: 'paste',
        fileName: '智能文本提取快照',
        items: res.items,
        detectedGroups: res.detectedGroups,
        warnings: res.warnings,
      },
    ]);
  };

  const handleInjectMuseumImagePack = () => {
    const galleryPack: Omit<DrawItem, 'id' | 'accessionNo' | 'status'>[] = [
      {
        title: '帕特农黄金分割星图 · 1740',
        subtitle: '铜版蚀刻星象图 · 大英策展馆藏',
        groupId: 'D馆 · 稀世馆藏映像签池',
        mediaType: 'image',
        imageUrl: createArtifactSvgDataUrl('PARTHENON STAR MAP', '#D4AF37', 'astrolabe'),
        weight: 2.0,
      },
      {
        title: '青金石巴比伦滚筒印章',
        subtitle: '公元前18世纪楔形文字铭文',
        groupId: 'D馆 · 稀世馆藏映像签池',
        mediaType: 'image',
        imageUrl: createArtifactSvgDataUrl('LAPIS CYLINDER SEAL', '#60A5FA', 'seal'),
        weight: 1.5,
      },
      {
        title: '包豪斯光学棱镜装置 · 1926',
        subtitle: '魏玛工坊水晶玻璃与黄铜底座',
        groupId: 'D馆 · 稀世馆藏映像签池',
        mediaType: 'image',
        imageUrl: createArtifactSvgDataUrl('BAUHAUS PRISM 1926', '#F59E0B', 'prism'),
        weight: 1.2,
      },
      {
        title: '美第奇家族徽章金质怀表',
        subtitle: '佛罗伦萨珐琅微绘双擒纵器',
        groupId: 'D馆 · 稀世馆藏映像签池',
        mediaType: 'image',
        imageUrl: createArtifactSvgDataUrl('MEDICI CREST WATCH', '#C084FC', 'crest'),
        weight: 1.6,
      },
    ];

    setParsedBatches([
      {
        sourceType: 'image',
        fileName: '馆藏级艺术映像批量包 (4件)',
        items: galleryPack,
        detectedGroups: ['D馆 · 稀世馆藏映像签池'],
        warnings: [],
      },
    ]);
  };

  const allPreviewItems = parsedBatches.flatMap((b) => b.items);
  const allDetectedGroups = Array.from(
    new Set(parsedBatches.flatMap((b) => b.detectedGroups))
  );
  const allWarnings = parsedBatches.flatMap((b) => b.warnings);

  const handleConfirmCommit = () => {
    if (allPreviewItems.length === 0) return;
    onCommitImport(allPreviewItems, allDetectedGroups, importMode);
    setParsedBatches([]);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingestion-modal-title"
    >
      <div className="w-full max-w-4xl bg-[#121316] border border-white/15 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2
              id="ingestion-modal-title"
              className="text-xl font-display font-semibold tracking-wide text-[#F5F2EB]"
            >
              全能文件解析与批量映像导入舱
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              支持 Excel (.xlsx/.xls) · CSV/TSV · Word (.docx) · TXT 文本智能切分 · 批量图片成签
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导入舱"
            className="p-2 text-stone-400 hover:text-[#F5F2EB] rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Tabs & Default Group Selector */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-[#0B0C0E]/60 border-b border-white/10">
          <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('files')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'files'
                  ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              多格式文件与图片上传
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('paste')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'paste'
                  ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Word/TXT 智能文本切分
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gallery')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'gallery'
                  ? 'bg-[#D4AF37] text-[#0B0C0E] font-semibold'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              图片批量作签工作台
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <label htmlFor="default-group-input" className="text-stone-400 whitespace-nowrap">
              默认归属分组:
            </label>
            <input
              id="default-group-input"
              type="text"
              value={defaultGroupName}
              onChange={(e) => setDefaultGroupName(e.target.value)}
              list="existing-groups-datalist"
              className="px-3 py-1.5 bg-white/[0.04] border border-white/15 rounded-md text-[#F5F2EB] text-xs focus:outline-none focus:border-[#D4AF37]"
              placeholder="输入或选择分组名称"
            />
            <datalist id="existing-groups-datalist">
              {groups.map((g) => (
                <option key={g.id} value={g.name} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'files' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  handleFilesSelected(e.dataTransfer.files);
                }}
                className={`border border-dashed rounded-xl p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                    : 'border-white/20 bg-white/[0.02] hover:border-white/35'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.csv,.tsv,.docx,.txt,.md,image/*"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-[#D4AF37] mx-auto mb-3 opacity-90" />
                <p className="text-sm font-medium text-[#F5F2EB]">
                  将文件拖拽至此，或点击选择本地文件（支持多选混传）
                </p>
                <p className="text-xs text-stone-400 mt-1.5 max-w-xl mx-auto">
                  自动识别 Excel/CSV 表头（姓名/标题、分组/部门、权重、锁定概率、副标题）；Word (.docx) 与 TXT 自动按行或标点提取名单；图片文件自动生成高清缩略图签项。
                </p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] text-[#0B0C0E] rounded-lg hover:bg-[#e0bd42] transition-colors whitespace-nowrap shrink-0"
                  >
                    选择本地文件上传
                  </button>
                  <button
                    type="button"
                    onClick={downloadSampleCsvTemplate}
                    className="px-4 py-2 text-xs font-medium bg-white/[0.06] text-[#F5F2EB] border border-white/15 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    下载标准 CSV 导入模板
                  </button>
                </div>
              </div>
              {isParsing && (
                <p className="text-xs text-[#D4AF37] text-center">
                  正在解析多源文档与影像数据，请稍候...
                </p>
              )}
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-stone-300">
                  支持直接粘贴 Word 段落、TXT 名单或 Excel 单元格区域。支持管道符语法：
                  <span className="font-mono-tabular text-[#D4AF37] ml-1">
                    标题 | 分组名称 | 权重 | 副标题备注
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { id: 'auto', label: '智能识别' },
                      { id: 'newline', label: '按换行' },
                      { id: 'comma', label: '按逗号' },
                      { id: 'pause', label: '按顿号(、)' },
                      { id: 'semicolon', label: '按分号' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setDelimiterMode(mode.id)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 ${
                        delimiterMode === mode.id
                          ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40'
                          : 'bg-white/[0.04] text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={6}
                value={rawPasteText}
                onChange={(e) => setRawPasteText(e.target.value)}
                aria-label="智能文本提取输入框"
                className="w-full p-3.5 bg-[#0B0C0E] border border-white/15 rounded-lg text-xs text-[#F5F2EB] font-mono-tabular leading-relaxed focus:outline-none focus:border-[#D4AF37]"
                placeholder="在此粘贴名单或表格文本..."
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseTextPreview}
                  className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] text-[#0B0C0E] rounded-lg hover:bg-[#e0bd42] transition-colors whitespace-nowrap shrink-0"
                >
                  解析并生成预览列表
                </button>
              </div>
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="space-y-4">
              <div className="p-6 bg-white/[0.02] border border-white/10 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[#F5F2EB]">
                    批量图片一键转制为馆藏映像签项
                  </h3>
                  <p className="text-xs text-stone-400">
                    支持一次性拖入数十张奖品照片、员工头像或艺术作品图，系统自动提取文件名作为主标题并生成高帧率缩略图。
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-semibold bg-[#D4AF37] text-[#0B0C0E] rounded-lg hover:bg-[#e0bd42] transition-colors whitespace-nowrap shrink-0"
                  >
                    批量选择本地图片
                  </button>
                  <button
                    type="button"
                    onClick={handleInjectMuseumImagePack}
                    className="px-4 py-2 text-xs font-medium bg-white/[0.06] text-[#F5F2EB] border border-white/15 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                    载入示例馆藏艺术映像包
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Warnings */}
          {allWarnings.length > 0 && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                {allWarnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            </div>
          )}

          {/* Parsed Preview Table */}
          {allPreviewItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="text-stone-300">
                  解析就绪：共识别{' '}
                  <span className="font-mono-tabular font-semibold text-[#D4AF37]">
                    {allPreviewItems.length}
                  </span>{' '}
                  个签项 · 涉及{' '}
                  <span className="font-mono-tabular font-semibold text-[#F5F2EB]">
                    {allDetectedGroups.length}
                  </span>{' '}
                  个分组（自动创建不存在的分组）
                </div>
                <button
                  type="button"
                  onClick={() => setParsedBatches([])}
                  className="text-stone-400 hover:text-stone-200 underline"
                >
                  清空预览
                </button>
              </div>

              <div className="max-h-56 overflow-y-auto border border-white/10 rounded-lg bg-[#0B0C0E]/80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-stone-400 bg-white/[0.02]">
                      <th className="py-2 px-3 font-medium">序号</th>
                      <th className="py-2 px-3 font-medium">载体</th>
                      <th className="py-2 px-3 font-medium">主标题 / 签项名</th>
                      <th className="py-2 px-3 font-medium">归属分组</th>
                      <th className="py-2 px-3 font-medium text-right">相对权重</th>
                      <th className="py-2 px-3 font-medium">副标题 / 备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {allPreviewItems.slice(0, 60).map((item, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 font-mono-tabular text-stone-500">
                          #{String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="py-2 px-3 text-stone-300">
                          {item.mediaType === 'image' && item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-8 h-6 object-cover rounded border border-white/15"
                            />
                          ) : (
                            <span className="text-stone-400">文本签</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-medium text-[#F5F2EB]">
                          {item.title}
                        </td>
                        <td className="py-2 px-3 text-stone-300">{item.groupId}</td>
                        <td className="py-2 px-3 text-right font-mono-tabular text-[#D4AF37]">
                          {item.weight.toFixed(2)}x
                        </td>
                        <td className="py-2 px-3 text-stone-400 truncate max-w-[180px]">
                          {item.subtitle || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#0B0C0E] border-t border-white/10">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-stone-400">入库策略:</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-stone-200">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'append'}
                onChange={() => setImportMode('append')}
                className="accent-[#D4AF37]"
              />
              追加至当前签池
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-stone-200">
              <input
                type="radio"
                name="importMode"
                checked={importMode === 'replace'}
                onChange={() => setImportMode('replace')}
                className="accent-[#D4AF37]"
              />
              覆盖并清空原有签池
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-300 hover:text-white rounded-lg border border-white/10 hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
            >
              取消
            </button>
            <button
              type="button"
              disabled={allPreviewItems.length === 0}
              onClick={handleConfirmCommit}
              className="px-5 py-2 text-xs font-semibold bg-[#D4AF37] text-[#0B0C0E] rounded-lg hover:bg-[#e0bd42] disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Check className="w-4 h-4" />
              确认导入 ({allPreviewItems.length} 项)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
