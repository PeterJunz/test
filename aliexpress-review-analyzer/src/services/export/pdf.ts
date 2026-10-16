import type { DashboardStats } from '../../features/dashboard/stats';
import type { AspectInsight, RuleSummary, TagInsight } from '../../features/insights/insights';
import type { AiAnalysis, DataOrigin } from '../../types/review';

export interface ReportInput {
  datasetName: string;
  origin: DataOrigin;
  productId?: string;
  filterSummary: string;
  completeness: string;
  stats: DashboardStats;
  tags: TagInsight[];
  aspects: AspectInsight[];
  ruleSummary: RuleSummary;
  ai?: AiAnalysis;
}

/**
 * The built-in PDF fonts only cover Latin-1. Text is transliterated (diacritics removed)
 * and anything still outside Latin-1 is dropped, rather than printed as garbage.
 */
export function pdfSafe(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, (c) => (c === 'đ' ? 'd' : 'D'))
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, '')
    .trim();
}

export async function buildPdfReport(input: ReportInput): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 40;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const heading = (t: string) => {
    ensure(40);
    y += 10;
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(20);
    doc.text(pdfSafe(t), margin, y);
    y += 18;
  };
  const para = (t: string, size = 10, color = 60) => {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(color);
    const lines = doc.splitTextToSize(pdfSafe(t), width) as string[];
    ensure(lines.length * (size + 3));
    doc.text(lines, margin, y);
    y += lines.length * (size + 3) + 4;
  };
  const bullets = (items: string[]) => {
    if (!items.length) return para('None detected in this selection.', 10, 120);
    for (const item of items) para(`- ${item}`);
  };
  const table = (head: string[], body: Array<Array<string | number>>) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.map((row) => row.map((c) => (typeof c === 'string' ? pdfSafe(c) : c))),
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [232, 70, 30] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  };

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(20);
  doc.text('Product Review Quality Report', margin, y);
  y += 22;
  para(`Dataset: ${input.datasetName}`);
  if (input.productId) para(`Product ID: ${input.productId}`);
  para(`Selection: ${input.filterSummary}`);
  para(`Data completeness: ${input.completeness}. Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`);
  if (input.origin === 'demo') para('WARNING: DEMO DATA - these reviews are synthetic and do not come from AliExpress.', 11, 180);

  const s = input.stats;
  heading('Key metrics');
  table(['Metric', 'Value'], [
    ['Reviews in selection', s.total],
    ['Average rating', s.averageRating === null ? '-' : s.averageRating.toFixed(2)],
    ['Positive / Neutral / Negative / Uncertain', `${s.positive} / ${s.neutral} / ${s.negative} / ${s.uncertain}`],
    ['Reviews with photos', s.photos],
    ['Reviews with video', s.videos],
    ['Reviews with text', s.withText],
    ['US reviews (avg rating)', s.usCount ? `${s.usCount} (${s.usAverage?.toFixed(2)})` : '0'],
    ['Date range', s.firstDate ? `${s.firstDate} to ${s.lastDate}` : 'No dates'],
  ]);

  heading('Star distribution');
  table(['Stars', 'Reviews', 'Share'], s.distribution.map((d) => [`${d.stars} star`, d.count, `${(d.share * 100).toFixed(1)}%`]));

  heading('Rule-based summary (inference from keyword counts)');
  para('Strengths', 11, 30);
  bullets(input.ruleSummary.strengths);
  para('Complaints', 11, 30);
  bullets(input.ruleSummary.complaints);
  if (input.ruleSummary.cautions.length) {
    para('Caveats', 11, 30);
    bullets(input.ruleSummary.cautions);
  }

  if (input.tags.length) {
    heading('Detected feedback themes');
    table(['Theme', 'Type', 'Reviews', 'Example customer quote'], input.tags.slice(0, 17).map((t) => [
      t.label, t.polarity, t.count, t.quotes.map((q) => pdfSafe(q.text)).find(Boolean) ?? '',
    ]));
  }

  if (input.aspects.length) {
    heading('Aspects mentioned');
    table(['Aspect', 'Mentions', 'Positive', 'Negative', 'Neutral'], input.aspects.map((a) => [a.label, a.mentions, a.positive, a.negative, a.neutral]));
  }

  if (input.ai) {
    const ai = input.ai;
    heading(`AI analysis (${ai.model}, ${ai.reviewCount} reviews, ${ai.createdAt.slice(0, 10)})`);
    para('AI-generated inference. Verify against the cited reviews before acting on it.', 9, 120);
    para(ai.summary);
    const section = (title: string, items: AiAnalysis['commonPositives']) => {
      if (!items.length) return;
      para(title, 11, 30);
      bullets(items.map((p) => `${p.point} (${p.mentions} mentions)`));
    };
    section('Common positive feedback', ai.commonPositives);
    section('Common complaints', ai.commonComplaints);
    section('Recurring defects', ai.recurringDefects);
    section('Material issues', ai.materialIssues);
    section('Packaging & shipping', ai.packagingShippingIssues);
    section('Unmet expectations', ai.unmetExpectations);
    section('What customers value most', ai.highlyValued);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(140);
    doc.text(`AliExpress Review Analyzer Pro - page ${i} of ${pages}`, margin, doc.internal.pageSize.getHeight() - 20);
  }
  return doc.output('blob');
}
