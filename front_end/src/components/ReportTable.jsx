import { useState } from 'react';
import { getDay, format } from 'date-fns';

/**
 * 月間の作業報告を入力・表示するためのテーブルコンポーネント。
 * @param {object} props - プロパティ。
 * @param {Date} props.currentDate - 表示対象年月。
 * @param {object[]} props.workRecords - 1ヶ月分の作業記録リスト。
 * @param {object} props.holidays - 祝日データ。
 * @param {Function} props.onWorkRecordsChange - 作業記録データ変更時のコールバック。
 * @param {Function} props.onRowClick - テーブル行ダブルクリック時のコールバック。
 * @param {boolean} props.isReadOnly - 読み取り専用か否か。
 * @returns {JSX.Element} レンダリングされたテーブルコンポーネント。
 */
const ReportTable = ({ currentDate, workRecords, holidays, onWorkRecordsChange, onRowClick, isReadOnly }) => {
  /** @type {[number | null, Function]} クリックで選択された行のインデックス */
  const [selectedRow, setSelectedRow] = useState(null);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  /**
   * "HH:mm" 形式の時刻文字列を分単位の数値に変換します。
   * @param {string} timeStr - 時刻文字列。
   * @returns {number} 経過分数。
   */
  const timeToMinutes = (timeStr) => {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  /**
   * 分数を "HH:mm" 形式の時刻文字列に変換します。
   * @param {number} totalMinutes - 合計分数。
   * @returns {string} 時刻文字列。
   */
  const minutesToTime = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return '';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  /**
   * 勤務時間（分）を計算します（休憩含まず）。
   * @param {string} start - 開始時刻。
   * @param {string} end - 終了時刻。
   * @param {string} breakTime - 休憩時間。
   * @returns {number} 実働分数。
   */
  const calculateActualWorkMinutes = (start, end, breakTime) => {
    const startMins = timeToMinutes(start);
    const endMins = timeToMinutes(end);
    if (endMins < startMins) return 0; // 日またぎは考慮外
    return Math.max(0, endMins - startMins - timeToMinutes(breakTime));
  };

  /**
   * テーブル内の入力フィールド変更ハンドラ。
   * @param {number} dayIndex - 変更があった行のインデックス (0-indexed)。
   * @param {string} field - 変更があったフィールド名。
   * @param {string} value - 新しい値。
   */
  const handleInputChange = (dayIndex, field, value) => {
    onWorkRecordsChange(prev => {
      const updated = [...prev];
      const record = { ...updated[dayIndex] };
      record[field] = value;
      if (field === 'work_content' && value.trim() === '休み') {
        record.start_time = '00:00'; record.end_time = '00:00'; record.break_time = '00:00';
      } else if (value && (field === 'start_time' || field === 'end_time' || field === 'break_time')) {
        const [h, m] = value.split(':');
        const roundedM = Math.round(parseInt(m, 10) / 15) * 15;
        record[field] = `${String(parseInt(h, 10) + Math.floor(roundedM / 60)).padStart(2,'0')}:${String(roundedM % 60).padStart(2, '0')}`;
      }
      updated[dayIndex] = record;
      return updated;
    });
  };
  
  /** @type {number} 月間合計実働時間（分） */
  const totalWorkTimeMinutes = workRecords.reduce((total, record) =>
    total + calculateActualWorkMinutes(record.start_time, record.end_time, record.break_time), 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-400 text-center">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-1 w-[4%]">日付</th><th className="border p-1 w-[4%]">曜日</th>
            <th className="border p-1 w-[8%]">作業時間</th><th className="border p-1 w-[30%]">作業内容</th>
            <th className="border p-1 w-[8%]">①出社</th><th className="border p-1 w-[8%]">②退社</th>
            <th className="border p-1 w-[8%]">③勤務時間</th><th className="border p-1 w-[8%]">④休憩</th>
            <th className="border p-1 w-[8%]">⑤作業時間</th>
          </tr>
        </thead>
        <tbody>
          {workRecords.map((record, i) => {
            const date = new Date(year, month, record.day);
            const dayOfWeek = getDay(date);
            const actualWorkMinutes = calculateActualWorkMinutes(record.start_time, record.end_time, record.break_time);
            const rowClass = selectedRow === i ? 'bg-yellow-200' : (dayOfWeek === 0 || holidays[format(date, 'yyyy-MM-dd')]) ? 'bg-red-50' : dayOfWeek === 6 ? 'bg-blue-50' : '';
            return (
              <tr key={record.day} className={rowClass} onClick={() => setSelectedRow(i)} onDoubleClick={() => onRowClick(record)}>
                <td className="border p-1">{record.day}</td>
                <td className="border p-1">{weekdays[dayOfWeek]}</td>
                <td className="border p-1 bg-gray-100">{minutesToTime(actualWorkMinutes)}</td>
                <td className="border p-1 text-left"><textarea value={record.work_content || ''} onChange={e => handleInputChange(i, 'work_content', e.target.value)} className={`w-full h-full p-1 border-none resize-none min-h-[40px] bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`} readOnly={isReadOnly} /></td>
                <td className="border p-1"><input type="time" step="900" value={record.start_time || ''} onChange={e => handleInputChange(i, 'start_time', e.target.value)} className={`w-full p-1 border-none bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`} readOnly={isReadOnly} /></td>
                <td className="border p-1"><input type="time" step="900" value={record.end_time || ''} onChange={e => handleInputChange(i, 'end_time', e.target.value)} className={`w-full p-1 border-none bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`} readOnly={isReadOnly} /></td>
                <td className="border p-1 bg-gray-100">{minutesToTime(timeToMinutes(record.end_time) - timeToMinutes(record.start_time))}</td>
                <td className="border p-1"><input type="time" step="900" value={record.break_time || '00:00'} onChange={e => handleInputChange(i, 'break_time', e.target.value)} className={`w-full p-1 border-none bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`} readOnly={isReadOnly} /></td>
                <td className="border p-1 bg-gray-100">{minutesToTime(actualWorkMinutes)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td colSpan="2" className="border p-1">合計</td>
            <td className="border p-1">{minutesToTime(totalWorkTimeMinutes)}</td>
            <td colSpan="6" className="border p-1"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ReportTable;
