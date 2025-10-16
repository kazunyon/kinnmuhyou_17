import { useState } from 'react';
import { getDay, format } from 'date-fns';

/**
 * 月間の作業報告を入力・表示するためのテーブルコンポーネント。
 * 日々の勤務時間、休憩時間、作業内容の入力と、それに基づく自動計算を行う。
 * @param {object} props - コンポーネントのプロパティ
 * @param {Date} props.currentDate - 表示対象の年月が設定されたDateオブジェクト
 * @param {Array} props.workRecords - 表示対象の1ヶ月分の作業記録リスト
 * @param {object} props.holidays - 祝日データ (キー: 'YYYY-MM-DD', 値: 祝日名)
 * @param {Function} props.onWorkRecordsChange - 作業記録データが変更されたときのコールバック関数
 * @param {Function} props.onRowClick - テーブルの行がダブルクリックされたときのコールバック関数
 */
const ReportTable = ({ currentDate, workRecords, holidays, onWorkRecordsChange, onRowClick, isReadOnly }) => {
  // クリックで選択された行のインデックスを管理するstate
  const [selectedRow, setSelectedRow] = useState(null);
  
  // --- 表示のための準備 ---
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  // --- 時間計算ロジック (ヘルパー関数) ---

  /**
   * "HH:mm" 形式の時刻文字列を、その日の0時からの経過分数に変換する。
   * @param {string} timeStr - "HH:mm" 形式の時刻文字列
   * @returns {number} 経過分数。無効な入力の場合は0を返す。
   */
  const timeToMinutes = (timeStr) => {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  /**
   * 分の合計値を "HH:mm" 形式の時刻文字列に変換する。
   * @param {number} totalMinutes - 合計分数
   * @returns {string} "HH:mm" 形式の文字列。無効な入力の場合は空文字を返す。
   */
  const minutesToTime = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return '';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    // padStartで常に2桁表示にする (例: 7 -> "07")
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  /**
   * 開始時刻と終了時刻から、経過時間（分数）を計算する。
   * @param {string} start - 開始時刻 ("HH:mm")
   * @param {string} end - 終了時刻 ("HH:mm")
   * @returns {number} 経過分数。終了時刻が開始時刻より前の場合は0を返す。
   */
  const calculateDuration = (start, end) => {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (endMinutes < startMinutes) return 0; // 日付をまたぐ勤務は考慮しない
    return endMinutes - startMinutes;
  };

  // --- イベントハンドラ ---

  /**
   * テーブル内の入力フィールド（textarea, input[type="time"]）の値が変更されたときに呼ばれる。
   * @param {number} dayIndex - 変更があった行のインデックス (0-indexed)
   * @param {string} field - 変更があったフィールド名 (例: 'work_content', 'start_time')
   * @param {string} value - 新しい値
   */
  const handleInputChange = (dayIndex, field, value) => {
    onWorkRecordsChange(prevRecords => {
      const updatedRecords = [...prevRecords];
      const record = { ...updatedRecords[dayIndex] };

      // 更新したレコードの値を設定
      record[field] = value;

      // もし作業内容が「休み」と入力されたら、関連する時間を0にする
      if (field === 'work_content' && value.trim() === '休み') {
        record.start_time = '00:00';
        record.end_time = '00:00';
        record.break_time = '00:00';
      } else if (field === 'start_time' || field === 'end_time' || field === 'break_time') {
        // 時間入力の場合、値を15分刻みに丸める
        if (value) {
          const [h, m] = value.split(':');
          const minutes = parseInt(m, 10);
          const roundedMinutes = Math.round(minutes / 15) * 15;
          if (roundedMinutes === 60) {
            const hours = parseInt(h, 10) + 1;
            record[field] = `${String(hours).padStart(2,'0')}:00`;
          } else {
            record[field] = `${h}:${String(roundedMinutes).padStart(2, '0')}`;
          }
        }
      }

      updatedRecords[dayIndex] = record;
      return updatedRecords;
    });
  };
  
  // --- レンダリング前の合計時間計算 ---
  // 全ての日について作業時間を計算し、合計する
  const totalWorkTimeMinutes = workRecords.reduce((total, record) => {
      const workMinutes = calculateDuration(record.start_time, record.end_time); // ③勤務時間
      const breakMinutes = timeToMinutes(record.break_time); // ④休憩時間
      const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes); // ⑤作業時間 (マイナスにならないように)
      return total + actualWorkMinutes;
  }, 0);


  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-400 text-center">
        {/* --- テーブルヘッダー --- */}
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 p-1 w-[4%]">日付</th>
            <th className="border border-gray-300 p-1 w-[4%]">曜日</th>
            <th className="border border-gray-300 p-1 w-[8%]">作業時間</th>
            <th className="border border-gray-300 p-1 w-[30%]">作業内容</th>
            <th className="border border-gray-300 p-1 w-[8%]">①出社時刻</th>
            <th className="border border-gray-300 p-1 w-[8%]">②退社時刻</th>
            <th className="border border-gray-300 p-1 w-[8%]">③勤務時間<br/>(②-①)</th>
            <th className="border border-gray-300 p-1 w-[8%]">④休憩時間</th>
            <th className="border border-gray-300 p-1 w-[8%]">⑤作業時間<br/>(③-④)</th>
          </tr>
        </thead>
        {/* --- テーブルボディ (各日の行) --- */}
        <tbody>
          {workRecords.map((record, i) => {
            // --- 各行の表示に必要なデータを計算・準備 ---
            const day = record.day;
            const date = new Date(year, month, day);
            const dayOfWeek = getDay(date); // 曜日を数値で取得 (0=日, 6=土)
            const dateStr = format(date, 'yyyy-MM-dd'); // 祝日チェック用の日付文字列

            // 行の背景色を決定するためのフラグ
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const isHoliday = !!holidays[dateStr]; // 祝日データに該当の日付が存在するか

            // 表示用の自動計算
            const workMinutes = calculateDuration(record.start_time, record.end_time); // ③勤務時間
            const breakMinutes = timeToMinutes(record.break_time); // ④休憩時間
            const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes); // ⑤作業時間

            // 行のCSSクラスを動的に決定
            const rowClass =
              selectedRow === i ? 'bg-selected-yellow' : // 選択されている行
              isSunday || isHoliday ? 'bg-holiday-red' : // 日曜または祝日
              isSaturday ? 'bg-saturday-blue' : // 土曜
              ''; // 平日

            return (
              <tr key={day} className={rowClass} onClick={() => setSelectedRow(i)} onDoubleClick={() => onRowClick(record)}>
                <td className="border border-gray-300 p-1">{day}</td>
                <td className="border border-gray-300 p-1">{weekdays[dayOfWeek]}</td>
                {/* 1列目の作業時間 (⑤と同じ) */}
                <td className="border border-gray-300 p-1 bg-gray-100">{minutesToTime(actualWorkMinutes)}</td>
                <td className="border border-gray-300 p-1 text-left align-middle">
                  <textarea
                    value={record.work_content || ''}
                    onChange={(e) => handleInputChange(i, 'work_content', e.target.value)}
                    className={
                      `w-full h-full p-1 border-none resize-none min-h-[40px] ` +
                      ((record.work_content || '').trim() === '休み' ? "rest-day-badge text-center" : "bg-transparent") +
                      (isReadOnly ? ' bg-gray-100' : '')
                    }
                    rows="2"
                    readOnly={isReadOnly}
                  />
                </td>
                <td className="border border-gray-300 p-1">
                  <input
                    type="time"
                    step="900" // HTML5の機能で15分(900秒)刻みの入力UIを提供
                    value={record.start_time || ''}
                    onChange={(e) => handleInputChange(i, 'start_time', e.target.value)}
                    className={`w-full p-1 border-none bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`}
                    readOnly={isReadOnly}
                  />
                </td>
                <td className="border border-gray-300 p-1">
                  <input
                    type="time"
                    step="900"
                    value={record.end_time || ''}
                    onChange={(e) => handleInputChange(i, 'end_time', e.target.value)}
                    className={`w-full p-1 border-none bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`}
                    readOnly={isReadOnly}
                  />
                </td>
                {/* ③勤務時間 (自動計算・表示のみ) */}
                <td className="border border-gray-300 p-1 bg-gray-100">{minutesToTime(workMinutes)}</td>
                <td className="border border-gray-300 p-1">
                   <input
                    type="time"
                    step="900"
                    value={record.break_time || '00:00'}
                    onChange={(e) => handleInputChange(i, 'break_time', e.target.value)}
                    className={`w-full p-1 border-none bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`}
                    readOnly={isReadOnly}
                  />
                </td>
                {/* ⑤作業時間 (自動計算・表示のみ) */}
                <td className="border border-gray-300 p-1 bg-gray-100">{minutesToTime(actualWorkMinutes)}</td>
              </tr>
            );
          })}
        </tbody>
        {/* --- テーブルフッター (合計欄) --- */}
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td colSpan="2" className="border border-gray-300 p-1">合計</td>
            <td className="border border-gray-300 p-1">{minutesToTime(totalWorkTimeMinutes)}</td>
            <td colSpan="6" className="border border-gray-300 p-1"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default ReportTable;