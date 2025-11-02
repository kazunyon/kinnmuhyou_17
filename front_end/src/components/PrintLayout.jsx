import React from 'react';
import { getDaysInMonth, getDay, format } from 'date-fns';

/**
 * 印刷用の作業報告書レイアウトコンポーネント。
 * `react-to-print`で利用することを想定し、`React.forwardRef`を使用しています。
 *
 * @param {object} props - プロパティ。
 * @param {object} props.employee - 社員情報。
 * @param {object} props.company - 会社情報。
 * @param {Date} props.currentDate - 表示対象年月。
 * @param {object[]} props.workRecords - 月間勤務記録。
 * @param {object} props.holidays - 祝日データ。
 * @param {string} props.specialNotes - 月次特記事項。
 * @param {React.Ref} ref - `react-to-print`が参照するDOM要素へのref。
 * @returns {JSX.Element} 印刷用レイアウト。
 */
const PrintLayout = React.forwardRef((props, ref) => {
  const { employee, company, currentDate, workRecords, holidays, specialNotes } = props;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentDate);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  /**
   * "HH:mm"形式の時間文字列を分単位の数値に変換します。
   * @param {string | undefined} timeStr - 'HH:MM'形式の時間文字列。
   * @returns {number} 合計分数。
   */
  const timeToMinutes = (timeStr) => {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  /**
   * 分単位の数値を "H:MM" 形式の時間文字列に変換します。
   * @param {number} totalMinutes - 合計分数。
   * @returns {string} フォーマットされた時間文字列。
   */
  const minutesToTime = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };
  
  /**
   * 稼働時間（分）を計算します（休憩時間を除く）。
   * @param {string} start - 開始時刻 ('HH:MM')。
   * @param {string} end - 終了時刻 ('HH:MM')。
   * @param {string} breakTime - 休憩時間 ('HH:MM')。
   * @returns {number} 実働分数。
   */
  const calculateActualWorkMinutes = (start, end, breakTime) => {
    const startMins = timeToMinutes(start);
    const endMins = timeToMinutes(end);
    if (endMins < startMins) return 0; // 日またぎは考慮外
    return Math.max(0, endMins - startMins - timeToMinutes(breakTime));
  };
  
  /** @type {number} 月間の合計実働時間（分） */
  const totalWorkTimeMinutes = workRecords.reduce((total, record) =>
    total + calculateActualWorkMinutes(record.start_time, record.end_time, record.break_time), 0);

  return (
    <div ref={ref} className="bg-white text-black print-container">
      <div className="text-center mb-4">
        <h2 className="text-sm font-bold">{format(currentDate, 'yyyy年 M月')}</h2>
        <h1 className="text-lg font-bold" style={{ letterSpacing: '0.5em' }}>作業報告書</h1>
      </div>
      <div className="flex justify-start mb-4 text-sm">
        <div>
          <p>会社名：{company?.company_name}</p>
          <p>部署：{employee?.department_name}</p>
          <p>氏名：{employee?.employee_name}</p>
        </div>
      </div>

      <table className="w-full border-collapse border border-black text-xs" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-1 w-[10%]">日付</th><th className="border border-black p-1 w-[10%]">曜日</th>
            <th className="border border-black p-1 w-[15%]">作業時間</th><th className="border border-black p-1 w-[65%]">作業内容</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const date = new Date(year, month, day);
            const record = workRecords.find(r => r.day === day) || {};
            const actualWorkMinutes = calculateActualWorkMinutes(record.start_time, record.end_time, record.break_time);
            const dateStr = format(date, 'yyyy-MM-dd');
            const rowClass = (getDay(date) === 0 || holidays[dateStr]) ? 'bg-red-100' : getDay(date) === 6 ? 'bg-blue-100' : '';
            return (
              <tr key={day} className={rowClass} style={{ height: '28px' }}>
                <td className="border border-black p-1 text-center">{day}</td>
                <td className="border border-black p-1 text-center">{weekdays[getDay(date)]}</td>
                <td className="border border-black p-1 text-center">{minutesToTime(actualWorkMinutes)}</td>
                <td className="border border-black p-1 text-left whitespace-pre-wrap break-words">{record.work_content}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ height: '28px' }}>
            <td className="border border-black p-1 text-center font-bold" colSpan="2">合計</td>
            <td className="border border-black p-1 text-center font-bold">{minutesToTime(totalWorkTimeMinutes)}</td>
            <td className="border border-black p-1"></td>
          </tr>
          <tr>
            <td className="border border-black p-1 align-top" rowSpan="4">特記事項</td>
            <td className="p-1 align-top border-t border-r border-black whitespace-pre-wrap" colSpan="3" rowSpan="4" style={{ height: '112px' }}>{specialNotes}</td>
          </tr>
          {/* 結合したセルの高さを確保するためのダミー行 */}
          {Array.from({ length: 3 }).map((_, i) => <tr key={i}><td className="hidden"></td></tr>)}
        </tfoot>
      </table>
    </div>
  );
});

PrintLayout.displayName = 'PrintLayout';

export default PrintLayout;
