import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// =============================================================================
// ヘルパー関数
// =============================================================================

// 時間(HH:MM)を分に変換
const timeToMinutes = (time) => {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// 分を時間(HH:MM)に変換
const minutesToTime = (minutes) => {
  if (isNaN(minutes) || minutes < 0) return '0:00';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}:${String(mins).padStart(2, '0')}`;
};

// 西暦を和暦（令和）に変換
const toReiwaYear = (year) => (year >= 2019 ? year - 2018 : year);

// =============================================================================
// Excelエクスポート関数
// =============================================================================

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
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  };

  const headerStyle = {
    font: { bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }, // Light Grey
    },
    border: borderStyle,
  };

  // --- ヘッダー情報の書き込み ---

  // 年月
  worksheet.mergeCells('B2:C2');
  const dateCell = worksheet.getCell('B2');
  dateCell.value = `令和 ${toReiwaYear(year)}年 ${month}月`;
  dateCell.font = { size: 14 };

  // タイトル
  worksheet.mergeCells('B4:F4');
  const titleCell = worksheet.getCell('B4');
  titleCell.value = '作　業　報　告　書';
  titleCell.font = { size: 16, bold: true };
  titleCell.alignment = { horizontal: 'center' };

  // 会社名
  worksheet.mergeCells('B5:F5');
  worksheet.getCell('B5').value = `会社名　　：　${masterData.company_name || ''}`;

  // 部署名（ユーザー要件）
  worksheet.mergeCells('B6:F6');
  const departmentCell = worksheet.getCell('B6');
  departmentCell.value = `部署　　　：　${masterData.department_name || ''}`;
  departmentCell.font = { underline: true };
  departmentCell.alignment = { horizontal: 'left' };

  // 氏名（ユーザー要件）
  worksheet.mergeCells('B7:F7');
  const employeeCell = worksheet.getCell('B7');
  employeeCell.value = `氏名　　　：　${masterData.employee_name || ''}`;
  employeeCell.font = { underline: true };
  employeeCell.alignment = { horizontal: 'left' };


  // --- テーブルの書き込み ---
  let currentRow = 9;

  // テーブルヘッダー
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
    return {
      ...row,
      actualWorkTime: minutesToTime(actualWorkTimeMin),
    };
  });

  // データ行
  processedRows.forEach(row => {
    const date = new Date(row.date);
    worksheet.getCell(`B${currentRow}`).value = date.getDate();
    worksheet.getCell(`C${currentRow}`).value = row.dayOfWeek;
    const actualTime = timeToMinutes(row.actualWorkTime) > 0 ? row.actualWorkTime : '';
    worksheet.getCell(`D${currentRow}`).value = actualTime;

    worksheet.mergeCells(`E${currentRow}:F${currentRow}`);
    worksheet.getCell(`E${currentRow}`).value = row.summary || ''; // 作業内容はsummaryから取得

    // スタイル設定
    ['B', 'C', 'D'].forEach(col => {
        worksheet.getCell(`${col}${currentRow}`).alignment = { horizontal: 'center' };
    });

    ['B', 'C', 'D', 'E', 'F'].forEach(col => {
       worksheet.getCell(`${col}${currentRow}`).border = borderStyle;
    });

    worksheet.getRow(currentRow).height = 20;
    currentRow++;
  });

  // 合計行
  const totalWorkTime = minutesToTime(
    processedRows.reduce((acc, row) => acc + timeToMinutes(row.actualWorkTime), 0)
  );
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

  currentRow += 2; // 1行空ける

  // --- 特記事項の書き込み ---
  worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
  const specialNotesTitleCell = worksheet.getCell(`B${currentRow}`);
  specialNotesTitleCell.value = '特記事項';
  specialNotesTitleCell.font = { bold: true };

  currentRow++;

  const specialNotesCellRange = `B${currentRow}:F${currentRow + 4}`;
  worksheet.mergeCells(specialNotesCellRange);
  const specialNotesCell = worksheet.getCell(`B${currentRow}`);
  specialNotesCell.value = specialNotes;
  specialNotesCell.alignment = { vertical: 'top', wrapText: true };

  // 結合したセル範囲に枠線を設定
  // Note: ExcelJSの制約上、結合セルの左上のセルに枠線を設定する必要がある
  specialNotesCell.border = borderStyle;


  // --- ファイルの生成とダウンロード ---
  try {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const fileName = `作業報告_${masterData.employee_name || '未設定'}_${year}${String(month).padStart(2, '0')}.xlsx`;
    saveAs(blob, fileName);
  } catch (error) {
    console.error("Excelファイルの生成に失敗しました。", error);
    alert("Excelファイルの生成に失敗しました。");
  }
};