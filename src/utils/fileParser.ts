import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { DrawItem, ParsedImportBatch } from '../types/draw';

/**
 * Normalize column header keys to semantic fields
 */
function detectColumnRole(
  header: string
): 'title' | 'subtitle' | 'group' | 'weight' | 'probability' | null {
  const clean = header.trim().toLowerCase();
  if (
    ['姓名', '名称', '签项', '标题', '展品', '奖项', '候选人', 'name', 'title', 'item', 'label'].some(
      (k) => clean.includes(k)
    )
  ) {
    return 'title';
  }
  if (
    ['分组', '组别', '部门', '展区', '类别', '战队', 'group', 'category', 'department', 'team'].some(
      (k) => clean.includes(k)
    )
  ) {
    return 'group';
  }
  if (['权重', '倍率', '分值', 'weight', 'score', 'ratio'].some((k) => clean.includes(k))) {
    return 'weight';
  }
  if (['锁定概率', '绝对概率', '概率', 'prob', 'probability'].some((k) => clean.includes(k))) {
    return 'probability';
  }
  if (
    ['副标题', '备注', '描述', '简介', '职务', '头衔', 'subtitle', 'note', 'desc', 'role', 'bio'].some(
      (k) => clean.includes(k)
    )
  ) {
    return 'subtitle';
  }
  return null;
}

/**
 * Convert 2D rows (from Excel or CSV/TSV) into structured DrawItem candidates
 */
export function parseTabularRows(
  rows: (string | number | undefined | null)[][],
  defaultGroupName: string = '导入默认展区'
): {
  items: Omit<DrawItem, 'id' | 'accessionNo' | 'status'>[];
  detectedGroups: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const nonEmptyRows = rows
    .map((r) => r.map((cell) => (cell === undefined || cell === null ? '' : String(cell).trim())))
    .filter((r) => r.some((cell) => cell.length > 0));

  if (nonEmptyRows.length === 0) {
    return { items: [], detectedGroups: [], warnings: ['未检测到有效数据行'] };
  }

  // Check if first row looks like a header
  const firstRow = nonEmptyRows[0];
  const roleMap: Record<number, 'title' | 'subtitle' | 'group' | 'weight' | 'probability'> = {};
  let hasHeader = false;

  firstRow.forEach((cell, idx) => {
    const role = detectColumnRole(cell);
    if (role) {
      roleMap[idx] = role;
      hasHeader = true;
    }
  });

  const dataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;
  const groupSet = new Set<string>();
  const items: Omit<DrawItem, 'id' | 'accessionNo' | 'status'>[] = [];

  dataRows.forEach((row, rowIndex) => {
    let title = '';
    let subtitle = '';
    let groupName = defaultGroupName;
    let weight = 1.0;
    let fixedProbability: number | undefined = undefined;

    if (hasHeader) {
      row.forEach((val, colIdx) => {
        const role = roleMap[colIdx];
        if (!val) return;
        if (role === 'title' && !title) title = val;
        else if (role === 'subtitle' && !subtitle) subtitle = val;
        else if (role === 'group') groupName = val;
        else if (role === 'weight') {
          const parsed = parseFloat(val);
          if (!isNaN(parsed) && parsed > 0) weight = parsed;
        } else if (role === 'probability') {
          const cleanProb = val.endsWith('%')
            ? parseFloat(val.replace('%', '')) / 100
            : parseFloat(val);
          if (!isNaN(cleanProb) && cleanProb > 0 && cleanProb <= 1) {
            fixedProbability = cleanProb;
          }
        }
      });
      // Fallback if no explicit title column matched
      if (!title) {
        title = row.find((c) => c.length > 0) || '';
      }
    } else {
      // Positional heuristic: Col 0 = Title, Col 1 = Group or Subtitle, Col 2 = Weight, Col 3 = Subtitle
      title = row[0] || '';
      if (row[1]) {
        const maybeNum = parseFloat(row[1]);
        if (!isNaN(maybeNum) && String(maybeNum) === row[1]) {
          weight = Math.max(0.01, maybeNum);
        } else {
          groupName = row[1];
        }
      }
      if (row[2]) {
        const maybeWeight = parseFloat(row[2]);
        if (!isNaN(maybeWeight) && maybeWeight > 0) {
          weight = maybeWeight;
        } else if (!subtitle) {
          subtitle = row[2];
        }
      }
      if (row[3] && !subtitle) {
        subtitle = row[3];
      }
    }

    if (!title) {
      warnings.push(`第 ${rowIndex + (hasHeader ? 2 : 1)} 行缺少主标题，已自动跳过`);
      return;
    }

    groupSet.add(groupName);
    items.push({
      title,
      subtitle: subtitle || undefined,
      groupId: groupName, // Temporarily holds groupName until mapped to DrawGroup.id
      mediaType: 'text',
      weight,
      fixedProbability,
    });
  });

  return {
    items,
    detectedGroups: Array.from(groupSet),
    warnings,
  };
}

/**
 * Parse raw delimited text (TXT / Word extracted prose / Smart Paste)
 */
export function parseTextContent(
  rawText: string,
  delimiterMode: 'auto' | 'newline' | 'comma' | 'pause' | 'semicolon',
  defaultGroupName: string = '文本导入展区'
): {
  items: Omit<DrawItem, 'id' | 'accessionNo' | 'status'>[];
  detectedGroups: string[];
  warnings: string[];
} {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { items: [], detectedGroups: [], warnings: ['输入文本为空'] };
  }

  // If the text looks like multi-column CSV or TSV (multiple lines with tabs or commas)
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (
    delimiterMode === 'auto' &&
    lines.length >= 2 &&
    lines.every((l) => l.includes('\t') || l.split(',').length >= 2)
  ) {
    const rows = lines.map((line) =>
      line.includes('\t') ? line.split('\t') : line.split(',')
    );
    return parseTabularRows(rows, defaultGroupName);
  }

  let tokens: string[] = [];
  switch (delimiterMode) {
    case 'newline':
      tokens = trimmed.split(/\r?\n/);
      break;
    case 'comma':
      tokens = trimmed.split(/[,，\r\n]+/);
      break;
    case 'pause':
      tokens = trimmed.split(/[、\r\n]+/);
      break;
    case 'semicolon':
      tokens = trimmed.split(/[;；\r\n]+/);
      break;
    case 'auto':
    default:
      tokens = trimmed.split(/[\r\n,，、;；]+/);
      break;
  }

  const cleanedTokens = tokens
    .map((t) => t.replace(/^\d+[\.\、\-\)\s]+/, '').trim())
    .filter((t) => t.length > 0);

  const items: Omit<DrawItem, 'id' | 'accessionNo' | 'status'>[] = cleanedTokens.map(
    (token) => {
      // Support inline syntax like "林知夏 | A组 | 2.5 | 首席策展" or "林知夏:2.5"
      if (token.includes('|')) {
        const parts = token.split('|').map((p) => p.trim());
        const title = parts[0] || token;
        const groupName = parts[1] || defaultGroupName;
        const weight = parts[2] && !isNaN(parseFloat(parts[2])) ? parseFloat(parts[2]) : 1.0;
        const subtitle = parts[3] || undefined;
        return {
          title,
          subtitle,
          groupId: groupName,
          mediaType: 'text',
          weight: Math.max(0.01, weight),
        };
      }
      return {
        title: token,
        groupId: defaultGroupName,
        mediaType: 'text',
        weight: 1.0,
      };
    }
  );

  const detectedGroups = Array.from(new Set(items.map((i) => i.groupId)));
  return { items, detectedGroups, warnings: [] };
}

/**
 * Compress and convert an uploaded image File into a crisp DataURL for smooth 60fps canvas rendering
 */
async function fileToThumbnailDataUrl(file: File, maxDim = 560): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (file.type === 'image/svg+xml') {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error(`读取图片失败: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/**
 * Universal File Parser Entrypoint (Excel .xlsx/.xls, CSV/TSV, Word .docx, TXT/MD, Images)
 */
export async function parseUploadedFiles(
  files: File[],
  defaultGroupName: string = '外部导入展区'
): Promise<ParsedImportBatch[]> {
  const batches: ParsedImportBatch[] = [];

  // Group image files into a single visual batch if multiple images are dropped together
  const imageFiles = files.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name));
  const docFiles = files.filter((f) => !imageFiles.includes(f));

  if (imageFiles.length > 0) {
    const imageItems: Omit<DrawItem, 'id' | 'accessionNo' | 'status'>[] = [];
    const warnings: string[] = [];

    for (const imgFile of imageFiles) {
      try {
        const dataUrl = await fileToThumbnailDataUrl(imgFile);
        const cleanTitle = imgFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ');
        imageItems.push({
          title: cleanTitle || '未命名影像展品',
          subtitle: `图像签项 · ${(imgFile.size / 1024).toFixed(1)} KB`,
          groupId: defaultGroupName,
          mediaType: 'image',
          imageUrl: dataUrl,
          weight: 1.0,
        });
      } catch (err) {
        warnings.push(`图片 ${imgFile.name} 解析失败`);
      }
    }

    batches.push({
      sourceType: 'image',
      fileName: imageFiles.length === 1 ? imageFiles[0].name : `${imageFiles.length} 张批量图像签项`,
      items: imageItems,
      detectedGroups: [defaultGroupName],
      warnings,
    });
  }

  for (const file of docFiles) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
        header: 1,
        defval: '',
      });
      const parsed = parseTabularRows(rows, defaultGroupName);
      batches.push({
        sourceType: 'excel',
        fileName: file.name,
        ...parsed,
      });
    } else if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      const workbook = XLSX.read(text, { type: 'string' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<(string | number | undefined)[]>(sheet, {
        header: 1,
        defval: '',
      });
      const parsed = parseTabularRows(rows, defaultGroupName);
      batches.push({
        sourceType: 'csv',
        fileName: file.name,
        ...parsed,
      });
    } else if (ext === 'docx') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const parsed = parseTextContent(result.value, 'auto', defaultGroupName);
        batches.push({
          sourceType: 'word',
          fileName: file.name,
          ...parsed,
        });
      } catch (err) {
        batches.push({
          sourceType: 'word',
          fileName: file.name,
          items: [],
          detectedGroups: [],
          warnings: [`Word 文档 (${file.name}) 解析失败，请确认为标准 .docx 格式`],
        });
      }
    } else {
      // Treat as TXT / Markdown / raw text
      const text = await file.text();
      const parsed = parseTextContent(text, 'auto', defaultGroupName);
      batches.push({
        sourceType: 'txt',
        fileName: file.name,
        ...parsed,
      });
    }
  }

  return batches;
}

/**
 * Generate a downloadable CSV sample template for users
 */
export function downloadSampleCsvTemplate(): void {
  const sampleRows = [
    ['姓名', '分组', '权重', '副标题'],
    ['宋宴清', 'A馆 · 首席策展与架构组', '2.0', '建筑空间叙事主理人'],
    ['江逾白', 'B馆 · 全息数字交互实验室', '1.5', '实时流体动力学算法设计师'],
    ['许星河', 'C馆 · 典藏文物修复中心', '1.0', '敦煌壁画矿物颜料研究员'],
    ['唐晚舟', 'A馆 · 首席策展与架构组', '1.2', '当代装置艺术策展人'],
  ];
  const csvContent =
    '\uFEFF' + sampleRows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Lumina_抽签导入模板.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
