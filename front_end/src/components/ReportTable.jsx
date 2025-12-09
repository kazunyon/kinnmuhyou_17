import { useState } from 'react';
import { getDay, format } from 'date-fns';

/**
 * 月間の作業報告を入力・表示するためのテーブルコンポーネント。
 * 日々の勤務時間、休憩時間、作業内容の入力と、それに基づく自動計算を行う。
 * @param {object} props - コンポーネントのプロパティ
 * @param {Date} props.currentDate - 表示対象の年月が設定されたDateオブジェクト
 * @param {Array<object>} props.workRecords - 表示対象の1ヶ月分の作業記録リスト
 * @param {object} props.holidays - 祝日データ (キー: 'YYYY-MM-DD', 値: 祝日名)
 * @param {object} props.monthlySummary - 月次集計データ
 * @param {Function} props.onWorkRecordsChange - 作業記録データが変更されたときのコールバック関数
 * @param {Function} props.onMonthlySummaryChange - 月次集計データが変更されたときのコールバック関数
 * @param {Function} props.onRowClick - テーブルの行がダブルクリックされたときのコールバック関数
 * @param {boolean} props.isReadOnly - テーブルが読み取り専用かどうか
 */
const ReportTable = ({ currentDate, workRecords, holidays, monthlySummary, onWorkRecordsChange, onMonthlySummaryChange, onRowClick, isReadOnly }) => {
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
    if (!timeStr || !/^\d+:\d+$/.test(timeStr)) return 0;
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

      // 休暇関連のキーワードが入力されたら、関連する時間を0にする
      const restKeywords = ['休み', '代休', '振休', '有給', '欠勤'];
      if (field === 'work_content' && restKeywords.includes(value.trim())) {
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

            // 明細合計時間の計算 (ディテールとの整合性チェック用)
            const detailsTotalMinutes = (record.details || []).reduce((sum, d) => sum + (d.work_time || 0), 0);
            const isTimeMismatch = actualWorkMinutes !== detailsTotalMinutes;

            // 行のCSSクラスを動的に決定
            const rowClass =
              selectedRow === i ? 'bg-selected-yellow' : // 選択されている行
              isSunday || isHoliday ? 'bg-holiday-red' : // 日曜または祝日
              isSaturday ? 'bg-saturday-blue' : // 土曜
              ''; // 平日

            // 不整合がある場合のスタイル
            // 太字かつ赤枠
            const mismatchStyle = isTimeMismatch ? "font-bold border-2 border-red-600 relative z-10" : "border border-gray-300";

            // 作業内容に応じてテキストエリアのクラスを決定するヘルパー関数
            const getTextareaClassName = (content) => {
              const baseClass = "w-full h-full p-1 border-none resize-none min-h-[40px]";
              const trimmedContent = (content || '').trim();

              // 特殊なステータスかどうかを判定
              const isSpecialStatus = ['代休', '振休', '有給', '欠勤', '休み'].includes(trimmedContent);

              // 読み取り専用の場合、特殊なステータスでなければグレー背景にする
              // 特殊なステータスの場合は、読み取り専用でも本来の色（青や黒など）を優先して表示する
              const readOnlyClass = (isReadOnly && !isSpecialStatus) ? ' bg-gray-100' : '';

              let colorClass = 'bg-transparent';
              if (['代休', '振休'].includes(trimmedContent)) {
                  colorClass = 'bg-yellow-200 text-center';
              } else if (trimmedContent === '有給') {
                  colorClass = 'bg-blue-200 text-center';
              } else if (trimmedContent === '欠勤') {
                  colorClass = 'bg-black text-center text-white';
              } else if (trimmedContent === '休み') {
                  colorClass = 'rest-day-badge text-center'; // 旧「休み」用のクラス
              }

              return `${baseClass} ${colorClass} ${readOnlyClass}`;
            };

            return (
              <tr key={day} className={rowClass} onClick={() => setSelectedRow(i)} onDoubleClick={() => onRowClick(record)}>
                <td className={`p-1 ${mismatchStyle}`}>{day}</td>
                <td className={`p-1 ${mismatchStyle}`}>{weekdays[dayOfWeek]}</td>
                {/* 1列目の作業時間 (⑤と同じ) */}
                <td className="border border-gray-300 p-1 bg-gray-100">{minutesToTime(actualWorkMinutes)}</td>
                <td className="border border-gray-300 p-1 text-left align-middle">
                  <textarea
                    value={record.work_content || ''}
                    onChange={(e) => handleInputChange(i, 'work_content', e.target.value)}
                    className={getTextareaClassName(record.work_content)}
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
            <td colSpan="6" className="border border-gray-300 p-1 text-xs text-right align-middle">
              {monthlySummary && (
                <div className="flex justify-end space-x-3">
                  <span>所定内: {monthlySummary.total_scheduled_work || '0:00'}</span>
                  <span>法定外残業: {monthlySummary.total_statutory_outer_overtime || '0:00'}</span>
                  <span className="text-red-600">休日労働: {monthlySummary.total_holiday_work || '0:00'}</span>
                  <span className="text-green-600">深夜労働: {
                    minutesToTime(
                      timeToMinutes(monthlySummary.total_late_night_work) +
                      timeToMinutes(monthlySummary.total_late_night_holiday_work)
                    )
                  }</span>
                </div>
              )}
            </td>
          </tr>
          {/* --- 月次集計フッター --- */}
          {monthlySummary && (
            <>
              {/* 1行目: ヘッダー */}
              <tr className="bg-gray-100 text-xs text-center">
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">出勤日数</td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">欠勤</td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">有給</td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">
                  <a href="/holiday_difference.docx" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    代休
                  </a>
                </td>
                <td className="border border-gray-300" colSpan="1"></td>
              </tr>
              {/* 1行目: データ */}
              <tr className="bg-white text-xs text-center">
                <td className="border border-gray-300 p-1" colSpan="2">{monthlySummary.working_days || 0}日</td>
                <td className="border border-gray-300 p-0" colSpan="2">
                  <input type="number" min="0" max="31" className={`w-full h-full p-1 text-center border-none ${isReadOnly ? 'bg-gray-100' : 'bg-transparent'}`}
                    value={monthlySummary.absent_days || 0} onChange={(e) => onMonthlySummaryChange('absent_days', parseInt(e.target.value, 10))} readOnly={isReadOnly} />
                </td>
                <td className="border border-gray-300 p-0" colSpan="2">
                  <input type="number" min="0" max="31" className={`w-full h-full p-1 text-center border-none ${isReadOnly ? 'bg-gray-100' : 'bg-transparent'}`}
                    value={monthlySummary.paid_holidays || 0} onChange={(e) => onMonthlySummaryChange('paid_holidays', parseInt(e.target.value, 10))} readOnly={isReadOnly} />
                </td>
                <td className="border border-gray-300 p-0" colSpan="2">
                  <input type="number" min="0" max="31" className={`w-full h-full p-1 text-center border-none ${isReadOnly ? 'bg-gray-100' : 'bg-transparent'}`}
                    value={monthlySummary.compensatory_holidays || 0} onChange={(e) => onMonthlySummaryChange('compensatory_holidays', parseInt(e.target.value, 10))} readOnly={isReadOnly} />
                </td>
                <td className="border border-gray-300" colSpan="1"></td>
              </tr>
              {/* 2行目: ヘッダー */}
              <tr className="bg-gray-100 text-xs text-center">
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">
                  <a href="/holiday_difference.docx" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    振休
                  </a>
                </td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">遅刻</td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">早退</td>
                <td className="border border-gray-300" colSpan="3"></td>
              </tr>
              {/* 2行目: データ */}
              <tr className="bg-white text-xs text-center">
                <td className="border border-gray-300 p-0" colSpan="2">
                  <input type="number" min="0" max="31" className={`w-full h-full p-1 text-center border-none ${isReadOnly ? 'bg-gray-100' : 'bg-transparent'}`}
                    value={monthlySummary.substitute_holidays || 0} onChange={(e) => onMonthlySummaryChange('substitute_holidays', parseInt(e.target.value, 10))} readOnly={isReadOnly} />
                </td>
                <td className="border border-gray-300 p-0" colSpan="2">
                  <input type="number" min="0" max="31" className={`w-full h-full p-1 text-center border-none ${isReadOnly ? 'bg-gray-100' : 'bg-transparent'}`}
                    value={monthlySummary.late_days || 0} onChange={(e) => onMonthlySummaryChange('late_days', parseInt(e.target.value, 10))} readOnly={isReadOnly} />
                </td>
                <td className="border border-gray-300 p-0" colSpan="2">
                  <input type="number" min="0" max="31" className={`w-full h-full p-1 text-center border-none ${isReadOnly ? 'bg-gray-100' : 'bg-transparent'}`}
                    value={monthlySummary.early_leave_days || 0} onChange={(e) => onMonthlySummaryChange('early_leave_days', parseInt(e.target.value, 10))} readOnly={isReadOnly} />
                </td>
                <td className="border border-gray-300" colSpan="3"></td>
              </tr>
            </>
          )}
        </tfoot>
      </table>
    </div>
  );
};

export default ReportTable;