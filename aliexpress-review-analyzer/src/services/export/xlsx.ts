import type { DataOrigin, Review } from '../../types/review';
import { EXPORT_COLUMNS, neutralizeFormula, toExportRow } from './rows';

/** Builds an .xlsx workbook. ExcelJS is loaded on demand to keep the main bundle small. */
export async function toXlsx(reviews: Review[], summary: Array<[string, string | number]>, origin?: DataOrigin): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AliExpress Review Analyzer Pro';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Reviews', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = EXPORT_COLUMNS.map((key) => ({
    header: key,
    key,
    width: key === 'review_text' ? 80 : key === 'review_images' || key === 'source_url' ? 40 : 16,
  }));
  for (const r of reviews) {
    const row = toExportRow(r, origin);
    sheet.addRow(Object.fromEntries(EXPORT_COLUMNS.map((c) => [c, typeof row[c] === 'string' ? neutralizeFormula(row[c] as string) : row[c]])));
  }
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn('review_text').alignment = { wrapText: true, vertical: 'top' };
  sheet.autoFilter = { from: 'A1', to: { row: 1, column: EXPORT_COLUMNS.length } };

  const info = wb.addWorksheet('Summary');
  info.columns = [{ header: 'Metric', key: 'k', width: 40 }, { header: 'Value', key: 'v', width: 60 }];
  for (const [k, v] of summary) info.addRow({ k, v: typeof v === 'string' ? neutralizeFormula(v) : v });
  info.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
