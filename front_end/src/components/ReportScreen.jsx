import ReportTable from './ReportTable';

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
 * 作業報告書のメイン画面UIを提供するコンポーネント。
 * ヘッダー、社員情報、作業報告テーブル、特記事項欄で構成されます。
 * このコンポーネントは状態（state）を持たず、親コンポーネント(App.jsx)から渡された
 * propsを通じて表示と操作を行う「Presentational Component」としての役割を担います。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {object} props.selectedEmployee - 選択中の社員情報。
 * @param {object} props.company - 選択中の社員が所属する会社情報。
 * @param {Date} props.currentDate - 表示対象の年月。
 * @param {Array<object>} props.workRecords - 1ヶ月分の作業記録。
 * @param {object} props.holidays - 祝日データ。
 * @param {string} props.specialNotes - 月次の特記事項。
 * @param {boolean} props.isLoading - データ読み込み中かを示すフラグ。
 * @param {string} props.message - ユーザーへの通知メッセージ。
 * @param {boolean} props.isReadOnly - 表示が読み取り専用かを示すフラグ。
 * @param {Function} props.onDateChange - 年月が変更されたときのコールバック関数。
 * @param {Function} props.onWorkRecordsChange - 作業記録が変更されたときのコールバック関数。
 * @param {Function} props.onSpecialNotesChange - 特記事項が変更されたときのコールバック関数。
 * @param {Function} props.onSave - 保存ボタンクリック時のコールバック関数。
 * @param {Function} props.onPrint - 印刷ボタンクリック時のコールバック関数。
 * @param {Function} props.onOpenDailyReportList - 「日報一覧」ボタンクリック時のコールバック関数。
 * @param {Function} props.onOpenMaster - 「マスター」ボタンクリック時のコールバック関数。
 * @param {Function} props.onRowClick - テーブルの行がクリックされたときのコールバック関数。
 * @returns {JSX.Element} レンダリングされた作業報告書スクリーン。
 */
const ReportScreen = ({
  selectedEmployee, company, currentDate, workRecords, holidays, specialNotes, monthlySummary,
  projectSummary, // 追加
  approvalDate,
  isLoading, message, isReadOnly, isReportScreenDirty, onDateChange, onWorkRecordsChange, onSpecialNotesChange, onMonthlySummaryChange,
  onSave, onPrint, onApprove, onCancelApproval, onOpenDailyReportList, onOpenMaster, onRowClick
}) => {

  /**
   * 年選択プルダウンの変更をハンドリングします。
   * @param {React.ChangeEvent<HTMLSelectElement>} e - イベントオブジェクト。
   */
  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value, 10);
    const newDate = new Date(currentDate);
    newDate.setFullYear(newYear);
    onDateChange(newDate);
  };

  /**
   * 月選択プルダウンの変更をハンドリングします。
   * @param {React.ChangeEvent<HTMLSelectElement>} e - イベントオブジェクト。
   */
  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value, 10);
    const newDate = new Date(currentDate);
    newDate.setMonth(newMonth);
    onDateChange(newDate);
  };
  
  /**
   * 年月プルダウン用の選択肢配列。
   * @type {{years: number[], months: number[]}}
   */
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

      {/* 請求先・案件別集計表 */}
      {projectSummary && projectSummary.length > 0 && (
        <div className="mt-8">
          <h2 className="font-bold text-lg mb-2 border-b border-gray-400 pb-1">請求先・案件別集計表</h2>
          <table className="min-w-full border-collapse border border-gray-400 text-sm">
            <thead className="bg-gray-200">
              <tr>
                <th className="border border-gray-300 p-2 text-left">請求先 (取引先)</th>
                <th className="border border-gray-300 p-2 text-left">案件名</th>
                <th className="border border-gray-300 p-2 text-right">合計時間</th>
              </tr>
            </thead>
            <tbody>
              {projectSummary.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {/* 同じ取引先が連続する場合はセルを結合する等のUI工夫も可能だが、今回は単純リスト表示 */}
                  <td className="border border-gray-300 p-2">{item.client_name}</td>
                  <td className="border border-gray-300 p-2">{item.project_name}</td>
                  <td className="border border-gray-300 p-2 text-right">{item.total_hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReportScreen;
