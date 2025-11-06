import React from 'react';
import { getDaysInMonth, getDay, format } from 'date-fns';

/**
 * 印刷用の作業報告書レイアウトコンポーネント。
 * このコンポーネントは`react-to-print`ライブラリによって使用されることを想定しており、
 * 親から渡されたrefを受け取って印刷対象のDOM要素として設定します。
 * 画面上には表示されませんが、印刷時にはこのコンポーネントのスタイルが適用されます。
 *
 * @param {object} props - コンポーネントのプロパティ。
 * @param {object} props.employee - 社員情報オブジェクト。
 * @param {object} props.company - 会社情報オブジェクト。
 * @param {Date} props.currentDate - 表示対象の年月を示すDateオブジェクト。
 * @param {Array<object>} props.workRecords - 1ヶ月分の勤務記録データの配列。
 * @param {object} props.holidays - 祝日データ (キー: 'YYYY-MM-DD', 値: 祝日名)。
 * @param {object} props.monthlySummary - 月次集計データ。
 * @param {string} props.approvalDate - 承認日。
 * @param {React.Ref} ref - `react-to-print`が印刷対象を識別するためのref。
 * @returns {JSX.Element} 印刷用のレイアウトを持つJSX要素。
 */
const PrintLayout = React.forwardRef((props, ref) => {
  const { employee, company, currentDate, workRecords, holidays, specialNotes, monthlySummary, approvalDate } = props;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentDate);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  /**
   * "HH:mm"形式の時間文字列を分単位の数値に変換します。
   * @param {string | undefined} timeStr - 'HH:MM'形式の時間文字列。
   * @returns {number} 合計分数。不正な形式の場合は0を返します。
   */
  const timeToMinutes = (timeStr) => {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  /**
   * 分単位の数値を "H:MM" 形式の時間文字列に変換します。
   * @param {number} totalMinutes - 合計分数。
   * @returns {string} フォーマットされた時間文字列。0以下の場合は空文字列を返します。
   */
  const minutesToTime = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  };
  
  /**
   * 開始時刻と終了時刻の差を分単位で計算します。
   * @param {string} start - 開始時刻 ('HH:MM')。
   * @param {string} end - 終了時刻 ('HH:MM')。
   * @returns {number} 稼働時間（分）。日またぎ勤務は0として扱います。
   */
  const calculateDuration = (start, end) => {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (endMinutes < startMinutes) return 0;
    return endMinutes - startMinutes;
  };
  
  /**
   * 月間の合計実働時間（分）を計算します。
   * @type {number}
   */
  const totalWorkTimeMinutes = workRecords.reduce((total, record) => {
      const workMinutes = calculateDuration(record.start_time, record.end_time);
      const breakMinutes = timeToMinutes(record.break_time);
      const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
      return total + actualWorkMinutes;
  }, 0);

  return (
    <div ref={ref} className="bg-white text-black print-container">
      <div className="text-center mb-4">
        <h2 className="text-sm font-bold">{format(currentDate, 'yyyy年 M月')}</h2>
        <h1 className="text-lg font-bold" style={{ letterSpacing: '0.5em' }}>作業報告書</h1>
      </div>
      <div className="flex justify-between items-start mb-4 text-sm">
        <div>
          <p>会社名：{company?.company_name}</p>
          <p>部署  ：{employee?.department_name}</p>
          <p>氏名  ：{employee?.employee_name}</p>
        </div>
        <div className="flex" style={{ marginRight: '20px' }}>
          <div className="flex flex-col text-center border border-black" style={{ width: '70px', height: '70px' }}>
            <div className="border-b border-black h-1/4 flex items-center justify-center text-xs">承認</div>
            <div className="flex-grow flex items-center justify-center text-red-500 text-xs">
              {approvalDate ? (
                <div>
                  <p>{employee?.employee_name?.split(' ')[0] || ''}</p>
                  <p>{format(new Date(approvalDate), 'M/d')}</p>
                </div>
              ) : (
                <div style={{ width: '40px', height: '40px' }}></div>
              )}
            </div>
          </div>
        </div>
      </div>

      <table className="w-full border-collapse border border-black text-xs" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-1 w-[10%]">日付</th>
            <th className="border border-black p-1 w-[10%]">曜日</th>
            <th className="border border-black p-1 w-[15%]">作業時間</th>
            <th className="border border-black p-1 w-[65%]">作業内容</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const date = new Date(year, month, day);
            const dayOfWeek = getDay(date);
            const dateStr = format(date, 'yyyy-MM-dd');
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const isHoliday = !!holidays[dateStr];

            const record = workRecords.find(r => r.day === day) || {};
            const workMinutes = calculateDuration(record.start_time, record.end_time);
            const breakMinutes = timeToMinutes(record.break_time);
            const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
            
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
        <tfoot>
            <tr style={{ height: '28px' }}>
                <td className="border border-black p-1 text-center font-bold" colSpan="2">合計</td>
                <td className="border border-black p-1 text-center font-bold">{minutesToTime(totalWorkTimeMinutes)}</td>
                <td className="border border-black p-1"></td>
            </tr>
        </tfoot>
      </table>

      {/* 勤怠サマリー */}
      <table className="w-full border-collapse border border-black text-xs mt-2" style={{ tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td className="border border-black p-1 text-center bg-gray-200 w-[12.5%]">出勤日数</td>
            <td className="border border-black p-1 text-center w-[12.5%]">{monthlySummary?.work_days ?? 0} 日</td>
            <td className="border border-black p-1 text-center bg-gray-200 w-[12.5%]">欠勤</td>
            <td className="border border-black p-1 text-center w-[12.5%]">{monthlySummary?.absent_days ?? 0} 日</td>
            <td className="border border-black p-1 text-center bg-gray-200 w-[12.5%]">有給</td>
            <td className="border border-black p-1 text-center w-[12.5%]">{monthlySummary?.paid_holidays ?? 0} 日</td>
            <td className="border border-black p-1 text-center bg-gray-200 w-[12.5%]">代休</td>
            <td className="border border-black p-1 text-center w-[12.5%]">{monthlySummary?.compensatory_holidays ?? 0} 日</td>
          </tr>
          <tr>
            <td className="border border-black p-1 text-center bg-gray-200">振休</td>
            <td className="border border-black p-1 text-center">{monthlySummary?.substitute_holidays ?? 0} 日</td>
            <td className="border border-black p-1 text-center bg-gray-200">遅刻・早退</td>
            <td className="border border-black p-1 text-center">{monthlySummary?.late_early_leave_days ?? 0} 回</td>
            <td className="border border-black p-1 text-center bg-gray-200">休日出勤</td>
            <td className="border border-black p-1 text-center">{monthlySummary?.holiday_work_days ?? 0} 日</td>
            <td className="border border-black p-1 bg-gray-200"></td>
            <td className="border border-black p-1"></td>
          </tr>
        </tbody>
      </table>

      {/* 特記事項 */}
      <table className="w-full border-collapse border border-black text-xs mt-2">
        <tbody>
            <tr>
                <td className="border border-black p-1 align-top bg-gray-200" style={{ width: '10%' }}>特記事項</td>
                <td className="p-1 align-top whitespace-pre-wrap" style={{ height: '112px' }}>{specialNotes}</td>
            </tr>
        </tbody>
      </table>
    </div>
  );
});

// React DevToolsでコンポーネントが正しく表示されるようにdisplayNameを設定
PrintLayout.displayName = 'PrintLayout';

export default PrintLayout;
