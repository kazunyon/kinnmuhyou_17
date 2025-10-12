import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// =============================================================================
// ヘルパー関数
// =============================================================================

/**
 * "HH:MM"形式の時間文字列を分単位の数値に変換します。
 * @param {string | undefined} time - 'HH:MM'形式の時間文字列。
 * @returns {number} 合計分数。不正な形式の場合は0を返します。
 */
const timeToMinutes = (time) => {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * 分単位の数値を "H:MM" 形式の時間文字列に変換します。
 * @param {number} minutes - 合計分数。
 * @returns {string} フォーマットされた時間文字列。負数やNaNの場合は'0:00'を返します。
 */
const minutesToTime = (minutes) => {
  if (isNaN(minutes) || minutes < 0) return '0:00';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}:${String(mins).padStart(2, '0')}`;
};

/**
 * 西暦を和暦（令和）の年に変換します。
 * @param {number} year - 西暦年。
 * @returns {number} 令和の年、または2019年より前の場合は西暦年。
 */
const toReiwaYear = (year) => (year >= 2019 ? year - 2018 : year);

// =============================================================================
// Excelエクスポート関数
// =============================================================================

/**
 * 作業報告書データをExcelファイルとしてエクスポートします。
 * ExcelJSを使用してワークブックを生成し、file-saverでダウンロードをトリガーします。
 * @param {object} masterData - 社員と会社のマスターデータ。
 * @param {string} masterData.company_name - 会社名。
 * @param {string} masterData.department_name - 部署名。
 * @param {string} masterData.employee_name - 社員名。
 * @param {number} year - 対象の年。
 * @param {number} month - 対象の月。
 * @param {Array<object>} reportRows - 作業報告テーブルの行データ。
 * @param {string} specialNotes - 特記事項のテキスト。
 * @returns {Promise<void>} ファイルの生成とダウンロードが完了すると解決されるPromise。
 * @async
 */
export const exportWorkReportToExcel = async (masterData, year, month, reportRows, specialNotes) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('作業報告書');

  // --- 列幅の設定 ---
  worksheet.columns = [
    { key: 'A', width: 2 },
    { key: 'B', width: 12 }, // 日付
    { key: 'C', width: 8 },  // 曜日
    { key: 'D', width: 12 }, // 作業時間
    { key: 'E', width: 45 }, // 作業内容
    { key: 'F', width: 15 },
  ];

  // --- スタイルの定義 ---
  const borderStyle = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' },
  };
  const headerStyle = {
    font: { bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } },
    border: borderStyle,
  };

  // --- ヘッダー情報の書き込み ---
  worksheet.mergeCells('B2:C2');
  worksheet.getCell('B2').value = `令和 ${toReiwaYear(year)}年 ${month}月`;
  worksheet.getCell('B2').font = { size: 14 };

  worksheet.mergeCells('B4:F4');
  worksheet.getCell('B4').value = '作業報告書';
  worksheet.getCell('B4').font = { size: 16, bold: true };
  worksheet.getCell('B4').alignment = { horizontal: 'center' };

  worksheet.mergeCells('B5:F5');
  worksheet.getCell('B5').value = `会社名： ${masterData.company_name || ''}`;

  worksheet.mergeCells('B6:F6');
  worksheet.getCell('B6').value = `部署： ${masterData.department_name || ''}`;
  worksheet.getCell('B6').font = { underline: true };

  worksheet.mergeCells('B7:F7');
  worksheet.getCell('B7').value = `氏名： ${masterData.employee_name || ''}`;
  worksheet.getCell('B7').font = { underline: true };

  // --- テーブルヘッダーの書き込み ---
  let currentRow = 9;
  worksheet.getCell(`B${currentRow}`).value = '日付';
  worksheet.getCell(`C${currentRow}`).value = '曜日';
  worksheet.getCell(`D${currentRow}`).value = '作業時間';
  worksheet.mergeCells(`E${currentRow}:F${currentRow}`);
  worksheet.getCell(`E${currentRow}`).value = '作業内容';
  ['B', 'C', 'D', 'E', 'F'].forEach(col => {
     worksheet.getCell(`${col}${currentRow}`).style = headerStyle;
  });
  worksheet.getRow(currentRow).height = 20;
  currentRow++;

  // --- テーブルデータの処理と書き込み ---
  const processedRows = reportRows.map(row => {
    const startTimeMin = timeToMinutes(row.start_time);
    const endTimeMin = timeToMinutes(row.end_time);
    const breakTimeMin = timeToMinutes(row.break_time);
    const workDurationMin = endTimeMin > startTimeMin ? endTimeMin - startTimeMin : 0;
    const actualWorkTimeMin = Math.max(0, workDurationMin - breakTimeMin);
    return { ...row, actualWorkTime: minutesToTime(actualWorkTimeMin) };
  });

  processedRows.forEach(row => {
    const date = new Date(row.date);
    worksheet.getCell(`B${currentRow}`).value = date.getDate();
    worksheet.getCell(`C${currentRow}`).value = row.dayOfWeek;
    worksheet.getCell(`D${currentRow}`).value = timeToMinutes(row.actualWorkTime) > 0 ? row.actualWorkTime : '';
    worksheet.mergeCells(`E${currentRow}:F${currentRow}`);
    worksheet.getCell(`E${currentRow}`).value = row.summary || '';

    ['B', 'C', 'D'].forEach(col => worksheet.getCell(`${col}${currentRow}`).alignment = { horizontal: 'center' });
    ['B', 'C', 'D', 'E', 'F'].forEach(col => worksheet.getCell(`${col}${currentRow}`).border = borderStyle);
    worksheet.getRow(currentRow).height = 20;
    currentRow++;
  });

  // --- 合計行の書き込み ---
  const totalWorkTime = minutesToTime(processedRows.reduce((acc, row) => acc + timeToMinutes(row.actualWorkTime), 0));
  worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
  worksheet.getCell(`B${currentRow}`).value = '合計';
  worksheet.getCell(`D${currentRow}`).value = totalWorkTime;
  worksheet.mergeCells(`E${currentRow}:F${currentRow}`);
  ['B', 'D', 'E'].forEach(col => {
      const cell = worksheet.getCell(`${col}${currentRow}`);
      cell.font = { bold: true };
      cell.border = borderStyle;
      cell.alignment = { horizontal: 'center' };
  });
  worksheet.getRow(currentRow).height = 20;
  currentRow += 2;

  // --- 特記事項の書き込み ---
  worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
  worksheet.getCell(`B${currentRow}`).value = '特記事項';
  worksheet.getCell(`B${currentRow}`).font = { bold: true };
  currentRow++;
  worksheet.mergeCells(`B${currentRow}:F${currentRow + 4}`);
  const specialNotesCell = worksheet.getCell(`B${currentRow}`);
  specialNotesCell.value = specialNotes;
  specialNotesCell.alignment = { vertical: 'top', wrapText: true };
  specialNotesCell.border = borderStyle;

  // --- ファイルの生成とダウンロード ---
  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `作業報告_${masterData.employee_name || '未設定'}_${year}${String(month).padStart(2, '0')}.xlsx`;
    saveAs(blob, fileName);
  } catch (error) {
    console.error("Excelファイルの生成に失敗しました。", error);
    alert("Excelファイルの生成に失敗しました。");
  }
};
