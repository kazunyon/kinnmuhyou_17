import React from 'react';
import { getDaysInMonth, getDay, format } from 'date-fns';

/**
 * 印刷用の作業報告書レイアウトコンポーネント。
 * react-to-printライブラリから呼び出されることを想定しています。
 * @param {object} props - コンポーネントのプロパティ
 * @param {object} props.employee - 従業員情報
 * @param {object} props.company - 会社情報
 * @param {Date} props.currentDate - 表示対象の年月
 * @param {Array} props.workRecords - 勤務記録の配列
 * @param {object} props.holidays - 祝日情報
 * @param {React.Ref} ref - 印刷コンポーネント用のref
 */
const PrintLayout = React.forwardRef((props, ref) => {
  const { employee, company, currentDate, workRecords, holidays } = props;

  // 現在の年月を取得
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentDate);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  /**
   * "HH:mm"形式の時刻文字列を分単位の数値に変換します。
   * @param {string} timeStr - 時刻文字列 (例: "09:00")
   * @returns {number} - 分単位の合計時間
   */
  const timeToMinutes = (timeStr) => {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  /**
   * 分単位の数値を"H:mm"形式の時刻文字列に変換します。
   * @param {number} totalMinutes - 分単位の合計時間
   * @returns {string} - "H:mm"形式の時刻文字列 (例: "8:00")
   */
  const minutesToTime = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  };
  
  /**
   * 開始時刻と終了時刻から稼働時間（分）を計算します。
   * @param {string} start - 開始時刻 ("HH:mm")
   * @param {string} end - 終了時刻 ("HH:mm")
   * @returns {number} - 稼働時間（分）
   */
  const calculateDuration = (start, end) => {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    // 日付をまたぐ場合などは考慮しない
    if (endMinutes < startMinutes) return 0;
    return endMinutes - startMinutes;
  };
  
  // 月間の合計実働時間を計算
  const totalWorkTimeMinutes = workRecords.reduce((total, record) => {
      const workMinutes = calculateDuration(record.start_time, record.end_time);
      const breakMinutes = timeToMinutes(record.break_time);
      const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
      return total + actualWorkMinutes;
  }, 0);

  return (
    // refはreact-to-printに印刷対象を教えるために必要
    <div ref={ref} className="p-8 bg-white text-black print-container">
      {/* ヘッダー：タイトルと年月 */}
      <div className="text-center mb-4">
        <h2 className="text-sm font-bold">{format(currentDate, 'yyyy年 M月')}</h2>
        <h1 className="text-lg font-bold" style={{ letterSpacing: '0.5em' }}>作業報告書</h1>
      </div>
      {/* 従業員情報 */}
      <div className="flex justify-start mb-4 text-sm">
        <div>
          <p>会社名：{company?.company_name}</p>
          <p>部署  ：{employee?.department_name}</p>
          <p>氏名  ：{employee?.employee_name}</p>
        </div>
      </div>

      {/* 勤務記録テーブル */}
      <table className="w-full border-collapse border border-black text-xs" style={{ tableLayout: 'fixed' }}>
        {/* テーブルヘッダー */}
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-1 w-[40px]">日付</th>
            <th className="border border-black p-1 w-[40px]">曜日</th>
            <th className="border border-black p-1 w-[70px]">作業時間</th>
            <th className="border border-black p-1">作業内容</th>
          </tr>
        </thead>
        {/* テーブルボディ */}
        <tbody>
          {/* 1ヶ月（31日分）の行を生成 */}
          {Array.from({ length: 31 }, (_, i) => {
            const day = i + 1;
            // 月の最終日を超えたら空行をレンダリング
            if (day > daysInMonth) {
                return (
                    <tr key={day} style={{ height: '28px' }}><td className="border border-black" colSpan="4"></td></tr>
                );
            }
            const date = new Date(year, month, day);
            const dayOfWeek = getDay(date);
            const dateStr = format(date, 'yyyy-MM-dd');
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const isHoliday = !!holidays[dateStr];

            // その日の勤務記録を検索
            const record = workRecords.find(r => r.day === day) || {};
            // 実働時間を計算
            const workMinutes = calculateDuration(record.start_time, record.end_time);
            const breakMinutes = timeToMinutes(record.break_time);
            const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
            
            // 行の背景色を決定（日曜・祝日は赤、土曜は青）
            const rowClass = 
              isSunday || isHoliday ? 'bg-red-100' :
              isSaturday ? 'bg-blue-100' : '';

            return (
              <tr key={day} className={rowClass} style={{ height: '28px' }}>
                <td className="border border-black p-1 text-center">{day}</td>
                <td className="border border-black p-1 text-center">{weekdays[dayOfWeek]}</td>
                <td className="border border-black p-1 text-center">{minutesToTime(actualWorkMinutes) || ''}</td>
                <td className="border border-black p-1 text-left whitespace-pre-wrap break-words">{record.work_content}</td>
              </tr>
            );
          })}
        </tbody>
        {/* テーブルフッター */}
        <tfoot>
            {/* 合計時間 */}
            <tr style={{ height: '28px' }}>
                <td className="border border-black p-1 text-center font-bold" colSpan="2">合計</td>
                <td className="border border-black p-1 text-center font-bold">{minutesToTime(totalWorkTimeMinutes)}</td>
                <td className="border border-black p-1"></td>
            </tr>
            {/* 特記事項 */}
            <tr>
                <td className="border border-black p-1 align-top" rowSpan="10">特記事項</td>
                <td className="p-1 align-top border-t border-r border-black" colSpan="3" rowSpan="10" style={{ height: '280px' }}></td>
            </tr>
            {/* rowSpanを使用するために必要な空の行。CSSで非表示にする */}
            {Array.from({ length: 9 }).map((_, i) => (
                <tr key={`note-fill-${i}`} className="hidden">
                    <td colSpan="3"></td>
                </tr>
            ))}
        </tfoot>
      </table>
    </div>
  );
});

PrintLayout.displayName = 'PrintLayout';

export default PrintLayout;

