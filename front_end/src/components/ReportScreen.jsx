import ReportTable from './ReportTable';

/**
 * 西暦のDateオブジェクトを和暦の年を含む文字列に変換します。
 * @param {Date} date - 変換対象のDateオブジェクト。
 * @returns {string} 和暦表記の年文字列 (例: "令和7年")。
 */
const toJapaneseEra = (date) => {
  const year = date.getFullYear();
  if (year >= 2019) return `令和${year - 2018}年`;
  if (year >= 1989) return `平成${year - 1988}年`;
  if (year >= 1926) return `昭和${year - 1925}年`;
  if (year >= 1912) return `大正${year - 1911}年`;
  return `${year}年`;
};

/**
 * 作業報告書のメイン画面UIを提供するPresentational Component。
 * ヘッダー、社員情報、作業報告テーブル、特記事項欄で構成されます。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {object} props.selectedEmployee - 選択中の社員情報。
 * @param {object} props.company - 所属会社情報。
 * @param {Date} props.currentDate - 表示対象年月。
 * @param {object[]} props.workRecords - 月間作業記録。
 * @param {object} props.holidays - 祝日データ。
 * @param {string} props.specialNotes - 月次特記事項。
 * @param {string|null} props.approvalDate - 承認日。
 * @param {string|null} props.ownerName - オーナー名。
 * @param {boolean} props.isLoading - データ読み込み中フラグ。
 * @param {string} props.message - 通知メッセージ。
 * @param {boolean} props.isReadOnly - 読み取り専用か否か。
 * @param {boolean} props.isReportScreenDirty - 画面が変更されたか否か。
 * @param {Function} props.onDateChange - 年月変更時のコールバック。
 * @param {Function} props.onWorkRecordsChange - 作業記録変更時のコールバック。
 * @param {Function} props.onSpecialNotesChange - 特記事項変更時のコールバック。
 * @param {Function} props.onSave - 保存ボタンクリック時のコールバック。
 * @param {Function} props.onPrint - 印刷ボタンクリック時のコールバック。
 * @param {Function} props.onApprove - 承認アクション時のコールバック。
 * @param {Function} props.onCancelApproval - 承認取り消し時のコールバック。
 * @param {Function} props.onOpenDailyReportList - 「日報一覧」クリック時のコールバック。
 * @param {Function} props.onOpenMaster - 「マスター」クリック時のコールバック。
 * @param {Function} props.onRowClick - テーブル行クリック時のコールバック。
 * @returns {JSX.Element} レンダリングされた作業報告書スクリーン。
 */
const ReportScreen = ({
  selectedEmployee, company, currentDate, workRecords, holidays, specialNotes,
  approvalDate, ownerName,
  isLoading, message, isReadOnly, isReportScreenDirty, onDateChange, onWorkRecordsChange, onSpecialNotesChange,
  onSave, onPrint, onApprove, onCancelApproval, onOpenDailyReportList, onOpenMaster, onRowClick
}) => {

  /**
   * 年選択プルダウンの変更をハンドリングします。
   * @param {React.ChangeEvent<HTMLSelectElement>} e - イベントオブジェクト。
   */
  const handleYearChange = (e) => {
    const newDate = new Date(currentDate);
    newDate.setFullYear(parseInt(e.target.value, 10));
    onDateChange(newDate);
  };

  /**
   * 月選択プルダウンの変更をハンドリングします。
   * @param {React.ChangeEvent<HTMLSelectElement>} e - イベントオブジェクト。
   */
  const handleMonthChange = (e) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(parseInt(e.target.value, 10));
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
             {years.map(year => <option key={year} value={year}>{toJapaneseEra(new Date(year, 0, 1))}</option>)}
           </select>
           <select value={currentDate.getMonth()} onChange={handleMonthChange} className="p-1 border rounded">
             {months.map(month => <option key={month} value={month}>{month + 1}月</option>)}
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
            <button onClick={onSave} className={`px-4 py-1 rounded ${isReadOnly ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500'}`} disabled={isReadOnly}>保存</button>
            <button onClick={onPrint} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-500">印刷</button>
        </div>
      </header>

      {/* 社員情報と印鑑欄 */}
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1 text-xs">
          <p className="border-b border-black pb-1" style={{ width: '300px' }}><span className="inline-block w-14">会社名</span>：{company?.company_name || ''}</p>
          <p className="border-b border-black pb-1" style={{ width: '300px' }}><span className="inline-block w-14">部署</span>：{selectedEmployee?.department_name || ''}</p>
          <p className="border-b border-black pb-1" style={{ width: '300px' }}><span className="inline-block w-14">氏名</span>：{selectedEmployee?.employee_name || ''}</p>
        </div>
        <div className="flex flex-col text-xs" style={{ width: '100pt', height: '50pt', border: '1px solid black' }}>
          <div className="text-center border-b border-black h-1/3">印鑑</div>
          <div className={`grow flex items-center justify-center ${!isReadOnly && !approvalDate ? 'cursor-pointer hover:bg-gray-100' : ''}`} onClick={!isReadOnly && !approvalDate ? onApprove : undefined}>
            {approvalDate && (
              <div className="text-red-500 text-center">
                <p>{ownerName?.split('　')[0] || ''}　{new Date(approvalDate).getMonth() + 1}/{new Date(approvalDate).getDate()}</p>
                {!isReadOnly && <p className="text-blue-600 hover:underline cursor-pointer" onClick={onCancelApproval}>キャンセル</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 作業報告テーブル */}
      {isLoading ? <div className="text-center p-8">データを読み込んでいます...</div> : (
        <ReportTable currentDate={currentDate} workRecords={workRecords} holidays={holidays} onWorkRecordsChange={onWorkRecordsChange} onRowClick={onRowClick} isReadOnly={isReadOnly} />
      )}
      
      {/* 特記事項 */}
      <div className="mt-4">
        <label htmlFor="special-notes-textarea" className="font-bold block mb-1">特記事項</label>
        <textarea id="special-notes-textarea" value={specialNotes} onChange={(e) => onSpecialNotesChange(e.target.value)} rows="5" className={`w-full p-2 border rounded ${isReadOnly ? 'bg-gray-100' : ''}`} placeholder={isReadOnly ? "オーナーのみ編集可能です。" : "この月の特記事級事項を入力してください..."} readOnly={isReadOnly} />
      </div>
    </div>
  );
};

export default ReportScreen;
