import ReportTable from './ReportTable';
import { useMemo } from 'react';


/**
 * 西暦の日付オブジェクトを和暦の年を含む文字列に変換します。
 * @param {Date} date - 変換対象のDateオブジェクト。
 * @returns {string} 和暦表記の年文字列 (例: "令和6年")。
 */
const toJapaneseEra = (date) => {
  const year = date.getFullYear();
  if (year >= 2019) {
    return `令和${year - 2018}年`;
  }
  // 他の元号が必要な場合はここに追加
  return `${year}年`;
};

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
 * 作業報告書のメイン画面UIを提供するコンポーネント。
 */
const ReportScreen = ({
  selectedEmployee, company, currentDate, workRecords, holidays, specialNotes, monthlySummary,
  approvalDate, isLoading, message, isReadOnly, isReportScreenDirty, billingSummary, // billingSummary を追加
  onDateChange, onWorkRecordsChange, onSpecialNotesChange, onMonthlySummaryChange, onSave, onPrint,
  onApprove, onCancelApproval, onOpenDailyReportList, onOpenMaster, onRowClick,
  clients, projects
}) => {

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value, 10);
    const newDate = new Date(currentDate);
    newDate.setFullYear(newYear);
    onDateChange(newDate);
  };

  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value, 10);
    const newDate = new Date(currentDate);
    newDate.setMonth(newMonth);
    onDateChange(newDate);
  };
  
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="container mx-auto p-4 bg-white shadow-lg rounded-lg">
      <header className="grid grid-cols-3 items-center mb-4">
        {/* 年月選択 */}
        <div className="flex items-center space-x-2">
           <select value={currentDate.getFullYear()} onChange={handleYearChange} className="p-1 border rounded">
             {years.map(year => (
               <option key={year} value={year}>{toJapaneseEra(new Date(year, 0, 1))}</option>
             ))}
           </select>
           <select value={currentDate.getMonth()} onChange={handleMonthChange} className="p-1 border rounded">
             {months.map(month => (
               <option key={month} value={month}>{month + 1}月</option>
             ))}
           </select>
        </div>

        <h1 className="text-center text-lg font-bold" style={{fontSize: '14pt', letterSpacing: '0.5em'}}>
          作業報告書
          {isReportScreenDirty && <span className="text-red-500 ml-4 text-sm">(更新あり)</span>}
        </h1>

        {/* 操作ボタン */}
        <div className="flex justify-end items-center space-x-2">
            {message && <div className="text-green-600 mr-4">{message}</div>}
            <button onClick={onOpenDailyReportList} className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-600">日報一覧</button>
            <button onClick={onOpenMaster} className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-600">マスター</button>
            <button
              onClick={onSave}
              className={`px-4 py-1 rounded ${isReadOnly ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
              disabled={isReadOnly}
            >
              保存
            </button>
            <button onClick={onPrint} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-500">印刷</button>
        </div>
      </header>

      {/* 社員情報と印鑑欄 */}
      <div className="flex justify-between items-start mb-4">
        {/* 社員情報 */}
        <div className="space-y-1 text-10pt">
          <div className="border-b border-black pb-1 flex items-center" style={{ width: '300px' }}>
            <span className="inline-block w-14">会社名</span>：{company?.company_name || ''}
          </div>
          <div className="border-b border-black pb-1 flex items-center" style={{ width: '300px' }}>
            <span className="inline-block w-14">部署</span>：{selectedEmployee?.department_name || ''}
          </div>
          <div className="border-b border-black pb-1 flex items-center" style={{ width: '300px' }}>
            <span className="inline-block w-14">氏名</span>：{selectedEmployee?.employee_name || ''}
          </div>
        </div>

        {/* 印鑑欄 */}
        <div className="flex flex-col text-10pt" style={{ width: '100pt', height: '50pt', border: '1px solid black' }}>
          <div className="text-center border-b border-black h-1/3 flex-none">印鑑</div>
          <div
            className={`grow flex items-center justify-center ${!isReadOnly && !approvalDate ? 'cursor-pointer hover:bg-gray-100' : ''}`}
            onClick={!isReadOnly && !approvalDate ? onApprove : undefined}
          >
            {approvalDate ? (
              <div className="text-red-500 text-center">
                <p>{selectedEmployee?.employee_name?.split(' ')[0] || ''} {new Date(approvalDate).getMonth() + 1}/{new Date(approvalDate).getDate()}</p>
                {!isReadOnly && (
                  <p
                    className="text-blue-600 hover:underline cursor-pointer"
                    onClick={onCancelApproval}
                  >
                    キャンセル
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 作業報告テーブル */}
      {isLoading ? (
        <div className="text-center p-8">データを読み込んでいます...</div>
      ) : (
        <ReportTable
          currentDate={currentDate}
          workRecords={workRecords}
          holidays={holidays}
          monthlySummary={monthlySummary}
          onWorkRecordsChange={onWorkRecordsChange}
          onMonthlySummaryChange={onMonthlySummaryChange}
          onRowClick={onRowClick}
          isReadOnly={isReadOnly}
          clients={clients}
          projects={projects}
        />
      )}
      
      {/* 特記事項 */}
      <div className="mt-4">
        <label htmlFor="special-notes-textarea" className="font-bold block mb-1">特記事項</label>
        <textarea
          id="special-notes-textarea"
          value={specialNotes}
          onChange={(e) => onSpecialNotesChange(e.target.value)}
          rows="5"
          className={`w-full p-2 border rounded ${isReadOnly ? 'bg-gray-100' : ''}`}
          placeholder={isReadOnly ? "オーナーのみ編集可能です。" : "この月の特記事項を入力してください..."}
          readOnly={isReadOnly}
        ></textarea>
      </div>

      {/* 請求先・案件別 集計表 */}
      <div className="mt-6">
        <h2 className="font-bold text-md mb-2">請求先・案件別 集計表</h2>
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 w-1/3">請求先</th>
              <th className="border border-gray-300 p-2 w-1/3">案件</th>
              <th className="border border-gray-300 p-2 w-1/3">合計時間</th>
            </tr>
          </thead>
          <tbody>
            {billingSummary && billingSummary.length > 0 ? (
              billingSummary.map((item, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 p-2">{item.client_name}</td>
                  <td className="border border-gray-300 p-2">{item.project_name}</td>
                  <td className="border border-gray-300 p-2 text-center">{minutesToTime(item.total_hours * 60)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="border border-gray-300 p-4 text-center text-gray-500">
                  集計データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReportScreen;
