import ReportTable from './ReportTable';

/**
 * 西暦年から和暦（元号）に変換するヘルパー関数。
 * @param {Date} date - 変換対象の日付オブジェクト
 * @returns {string} 和暦表記の文字列 (例: "令和6年")
 */
const toJapaneseEra = (date) => {
  const year = date.getFullYear();
  if (year >= 2019) {
    return `令和${year - 2018}年`;
  }
  // 必要に応じて平成、昭和などの他の元号もここに追加できる
  return `${year}年`;
};

/**
 * 作業報告書のメイン画面UIを提供するコンポーネント。
 * ヘッダー、社員情報、作業報告テーブル、特記事項欄で構成される。
 * このコンポーネントは状態（state）を持たず、親コンポーネント(App.jsx)から渡された
 * propsを通じて表示と操作を行う「Presentational Component」としての役割を担う。
 * @param {object} props - コンポーネントのプロパティ
 * @param {Array} props.employees - 全社員のリスト
 * @param {object} props.selectedEmployee - 選択中の社員オブジェクト
 * @param {object} props.company - 選択中の社員が所属する会社オブジェクト
 * @param {Date} props.currentDate - 表示対象の年月が設定されたDateオブジェクト
 * @param {Array} props.workRecords - 表示対象の1ヶ月分の作業記録リスト
 * @param {object} props.holidays - 祝日データ (キー: 'YYYY-MM-DD', 値: 祝日名)
 * @param {string} props.specialNotes - 特記事項のテキスト
 * @param {boolean} props.isLoading - データ読み込み中かどうかを示すフラグ
 * @param {string} props.message - ユーザーへの通知メッセージ (保存成功時など)
 * @param {Function} props.onEmployeeChange - 社員選択プルダウンが変更されたときのコールバック関数
 * @param {Function} props.onDateChange - 年月選択プルダウンが変更されたときのコールバック関数
 * @param {Function} props.onWorkRecordsChange - 作業記録データが変更されたときのコールバック関数
 * @param {Function} props.onSpecialNotesChange - 特記事項テキストエリアが変更されたときのコールバック関数
 * @param {Function} props.onSave - 「保存」ボタンクリック時のコールバック関数
 * @param {Function} props.onPrint - 「印刷」ボタンクリック時のコールバック関数
 * @param {Function} props.onOpenDailyReportList - 「日報一覧」ボタンクリック時のコールバック関数
 * @param {Function} props.onOpenMaster - 「マスター」ボタンクリック時のコールバック関数
 * @param {Function} props.onRowClick - テーブルの行がダブルクリックされたときのコールバック関数
 */
const ReportScreen = ({
  selectedEmployee, company, currentDate, workRecords, holidays, specialNotes,
  isLoading, message, isReadOnly, onDateChange, onWorkRecordsChange, onSpecialNotesChange,
  onSave, onPrint, onOpenDailyReportList, onOpenMaster, onRowClick
}) => {

  /**
   * 年選択プルダウンが変更されたときに呼ばれるハンドラ。
   * 新しい年でDateオブジェクトを更新し、親コンポーネントに状態の変更を通知する。
   * @param {object} e - イベントオブジェクト
   */
  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    const newDate = new Date(currentDate);
    newDate.setFullYear(newYear);
    onDateChange(newDate); // 親コンポーネントのcurrentDateを更新
  };

  /**
   * 月選択プルダウンが変更されたときに呼ばれるハンドラ。
   * 新しい月でDateオブジェクトを更新し、親コンポーネントに状態の変更を通知する。
   * @param {object} e - イベントオブジェクト
   */
  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value);
    const newDate = new Date(currentDate);
    newDate.setMonth(newMonth);
    onDateChange(newDate); // 親コンポーネントのcurrentDateを更新
  };
  
  // 年月プルダウンの選択肢として表示する年と月の配列を生成
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i); // 現在の年を中心に前後5年、計10年分
  const months = Array.from({ length: 12 }, (_, i) => i); // 0 (1月) から 11 (12月)

  return (
    <div className="container mx-auto p-4 bg-white shadow-lg rounded-lg">
      {/* --- ヘッダーセクション --- */}
      <header className="grid grid-cols-3 items-center mb-4">
        {/* 左側: 年月選択プルダウン */}
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

        {/* 中央: タイトル */}
        <h1 className="text-center text-lg font-bold" style={{fontSize: '14pt', letterSpacing: '0.5em'}}>
          作業報告書
        </h1>

        {/* 右側: 操作ボタンエリア */}
        <div className="flex justify-end items-center space-x-2">
            {/* 保存完了時などのメッセージ表示エリア */}
            {message && <div className="text-green-600 mr-4">{message}</div>}
            <button onClick={onOpenDailyReportList} className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-600">日報一覧</button>
            <button onClick={onOpenMaster} className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-600">マスター</button>
            <button
              onClick={onSave}
              className={`px-4 py-1 rounded ${isReadOnly ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
              disabled={isReadOnly}
            >
              保存
            </button>
            <button onClick={onPrint} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-500">印刷</button>
        </div>
      </header>

      {/* --- 社員情報セクション --- */}
      <div className="mb-4 space-y-1 text-10pt">
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

      {/* --- 作業報告テーブルセクション --- */}
      {isLoading ? (
        <div className="text-center p-8">データを読み込んでいます...</div>
      ) : (
        <ReportTable
          currentDate={currentDate}
          workRecords={workRecords}
          holidays={holidays}
          onWorkRecordsChange={onWorkRecordsChange}
          onRowClick={onRowClick}
          isReadOnly={isReadOnly}
        />
      )}
      
      {/* --- 特記事項セクション --- */}
      <div className="mt-4">
        <label className="font-bold block mb-1">特記事項</label>
        <textarea
          value={specialNotes}
          onChange={(e) => onSpecialNotesChange(e.target.value)}
          rows="5"
          className={`w-full p-2 border rounded ${isReadOnly ? 'bg-gray-100' : ''}`}
          placeholder={isReadOnly ? "オーナーのみ編集可能です。" : "この月の特記事項を入力してください..."}
          readOnly={isReadOnly}
        ></textarea>
      </div>
    </div>
  );
};

export default ReportScreen;