import React, { useState } from 'react';
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
  return `${year}年`;
};

/**
 * 作業報告書のメイン画面UIを提供するコンポーネント。
 */
const ReportScreen = ({
  employees, selectedEmployee, onEmployeeChange, company, currentDate, workRecords, holidays, specialNotes, monthlySummary,
  projectSummary,
  approvalDate, // 互換用
  status, submittedDate, managerApprovalDate, accountingApprovalDate, remandReason,
  user,
  isLoading, message, isReportScreenDirty, onDateChange, onWorkRecordsChange, onSpecialNotesChange, onMonthlySummaryChange,
  onSave, onPrint,
  onSubmitReport, onApproveReport, onRemandReport, onFinalizeReport, onCancelStatus,
  onOpenDailyReportList, onOpenMaster, onRowClick, clients, projects
}) => {
  const [remandModalOpen, setRemandModalOpen] = useState(false);
  const [remandReasonInput, setRemandReasonInput] = useState('');

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

  // 権限とステータスに基づくUI制御
  const isEmployee = user?.role === 'employee';
  const isManager = user?.role === 'manager';
  const isAccounting = user?.role === 'accounting';
  const isSelf = user?.employee_id === selectedEmployee?.employee_id;

  // 編集可能かどうか: 本人 かつ (draft または remanded)
  const isEditable = isSelf && (status === 'draft' || status === 'remanded');

  // ステータスバッジの色
  const getStatusBadge = () => {
    switch(status) {
      case 'draft': return <span className="bg-gray-200 text-gray-800 px-2 py-1 rounded text-sm">下書き</span>;
      case 'submitted': return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">提出済</span>;
      case 'approved': return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">部長承認済</span>;
      case 'finalized': return <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">完了</span>;
      case 'remanded': return <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">差戻し</span>;
      default: return null;
    }
  };

  const handleRemandSubmit = () => {
    onRemandReport(remandReasonInput);
    setRemandModalOpen(false);
    setRemandReasonInput('');
  };

  return (
    <div className="container mx-auto p-4 bg-white shadow-lg rounded-lg relative">
      <header className="grid grid-cols-1 md:grid-cols-3 items-center mb-4 gap-4">
        {/* 年月・社員選択 */}
        <div className="flex items-center space-x-4">
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
          {/* 社員選択: 自分のデータのみならdisabled、権限あれば選択可能 */}
          <select
            value={selectedEmployee?.employee_id}
            onChange={onEmployeeChange}
            className="p-1 border rounded"
            disabled={isEmployee && !isManager && !isAccounting} // 社員は変更不可
          >
            {employees.map(emp => (
              <option key={emp.employee_id} value={emp.employee_id}>{emp.employee_name}</option>
            ))}
          </select>
        </div>

        <div className="text-center">
          <h1 className="text-lg font-bold inline-block" style={{fontSize: '14pt', letterSpacing: '0.1em'}}>
            作業報告書
          </h1>
          <div className="ml-2 inline-block align-middle">
            {getStatusBadge()}
            {isReportScreenDirty && <span className="text-red-500 ml-2 text-xs">(未保存)</span>}
          </div>
        </div>

        {/* 操作ボタンエリア: 役割とステータスに応じて可変 */}
        <div className="flex justify-end items-center space-x-2 flex-wrap">
            {message && <div className="text-green-600 mr-4 text-sm w-full text-right mb-1">{message}</div>}

            <button onClick={onOpenDailyReportList} className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm">日報一覧</button>

            {/* マスターボタン: 管理者のみ */}
            {(isManager || isAccounting) && (
              <button onClick={onOpenMaster} className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm">マスター</button>
            )}

            {/* 保存ボタン: 編集可能な場合のみ */}
            {isEditable && (
              <button onClick={onSave} className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 text-sm">保存</button>
            )}

            <button onClick={onPrint} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-500 text-sm">印刷</button>
        </div>
      </header>

      {/* 承認操作パネル (新しいUI要件) */}
      <div className="bg-blue-50 border border-blue-200 p-2 rounded mb-4 flex justify-between items-center">
        <div className="text-sm">
           <span className="font-bold mr-2">承認状況:</span>
           {status === 'draft' && '未提出'}
           {status === 'submitted' && `提出済 (${submittedDate || ''})`}
           {status === 'approved' && `部長承認済 (${managerApprovalDate || ''})`}
           {status === 'finalized' && `完了 (${accountingApprovalDate || ''})`}
           {status === 'remanded' && `差戻し中 (理由: ${remandReason || ''})`}
        </div>
        <div className="space-x-2">
           {/* 本人: 提出 (draft/remanded の場合) */}
           {isSelf && (status === 'draft' || status === 'remanded') && (
             <button onClick={onSubmitReport} className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-500 shadow text-sm font-bold">
               提出する
             </button>
           )}
           {/* 本人: 提出取消 (submitted の場合) */}
           {isSelf && status === 'submitted' && (
             <button onClick={onCancelStatus} className="text-red-600 hover:underline text-sm ml-2">
               提出を取り消す
             </button>
           )}

           {/* 部長: 承認/差戻し (submitted の場合) */}
           {isManager && status === 'submitted' && (
             <>
               <button onClick={onApproveReport} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-500 shadow text-sm font-bold">
                 承認
               </button>
               <button onClick={() => setRemandModalOpen(true)} className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-400 shadow text-sm font-bold">
                 差戻し
               </button>
             </>
           )}
           {/* 部長: 承認取消 (approved の場合) */}
           {isManager && status === 'approved' && (
              <button onClick={onCancelStatus} className="text-red-600 hover:underline text-sm ml-2">
                承認を取り消す
              </button>
           )}

           {/* 経理: 完了 (approved の場合) */}
           {isAccounting && status === 'approved' && (
             <button onClick={onFinalizeReport} className="bg-purple-600 text-white px-4 py-1 rounded hover:bg-purple-500 shadow text-sm font-bold">
               完了 (最終承認)
             </button>
           )}
           {/* 経理: 完了取消 (finalized の場合) */}
           {isAccounting && status === 'finalized' && (
              <button onClick={onCancelStatus} className="text-red-600 hover:underline text-sm ml-2">
                完了を取り消す
              </button>
           )}
        </div>
      </div>

      {/* 社員情報と印鑑欄 */}
      <div className="flex justify-between items-start mb-4">
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

        {/* 印鑑欄 (新仕様に合わせて表示を調整) */}
        <div className="flex border border-black h-16">
           <div className="w-16 border-r border-black flex flex-col">
              <div className="text-xs text-center border-b border-black bg-gray-100">担当</div>
              <div className="flex-grow flex items-center justify-center text-xs">
                 {submittedDate ? '済' : ''}
              </div>
           </div>
           <div className="w-16 border-r border-black flex flex-col">
              <div className="text-xs text-center border-b border-black bg-gray-100">部長</div>
              <div className="flex-grow flex items-center justify-center text-xs text-red-500">
                 {managerApprovalDate ? (
                    <div className="text-center leading-tight">
                        <div>承認</div>
                        <div className="text-[9px]">{managerApprovalDate.slice(5)}</div>
                    </div>
                 ) : ''}
              </div>
           </div>
           <div className="w-16 flex flex-col">
              <div className="text-xs text-center border-b border-black bg-gray-100">経理</div>
              <div className="flex-grow flex items-center justify-center text-xs text-red-500">
                 {accountingApprovalDate ? (
                    <div className="text-center leading-tight">
                        <div>完了</div>
                        <div className="text-[9px]">{accountingApprovalDate.slice(5)}</div>
                    </div>
                 ) : ''}
              </div>
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
          isReadOnly={!isEditable} // 編集不可ステータスならRead-Only
          clients={clients}
          projects={projects}
        />
      )}
      
      <div className="mt-4">
        <h2 className="font-bold block mb-1">請求先・案件別集計表</h2>
        {projectSummary && projectSummary.length > 0 ? (
          <table className="w-full border-collapse border border-gray-400 text-center">
            <thead className="bg-gray-200">
              <tr>
                <th className="border border-gray-300 p-1">請求先 (取引先)</th>
                <th className="border border-gray-300 p-1">案件名</th>
                <th className="border border-gray-300 p-1 text-right">合計時間</th>
              </tr>
            </thead>
            <tbody>
              {projectSummary.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-300 p-1 text-left">{item.client_name}</td>
                  <td className="border border-gray-300 p-1 text-left">{item.project_name}</td>
                  <td className="border border-gray-300 p-1 text-right">{item.total_hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-gray-500 p-4 text-center border border-gray-300 rounded bg-gray-50">
            集計データはありません。日報入力で「案件」を登録するとここに集計が表示されます。
          </div>
        )}
      </div>

      {/* 特記事項 (連絡・申し送り事項) */}
      <div className="mt-4">
        <label htmlFor="special-notes-textarea" className="font-bold block mb-1">
          特記事項 / 連絡・申し送り事項
        </label>
        <textarea
          id="special-notes-textarea"
          value={specialNotes}
          onChange={(e) => onSpecialNotesChange(e.target.value)}
          rows="5"
          className="w-full p-2 border rounded bg-white"
          placeholder="業務報告や申し送り事項を入力してください..."
          readOnly={!isEditable} // ここもレポート本体と同じロック条件とする
        ></textarea>
      </div>

      {/* 差戻しモーダル */}
      {remandModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="text-lg font-bold mb-4">差戻し理由を入力</h3>
            <textarea
              className="w-full border p-2 rounded mb-4 h-32"
              value={remandReasonInput}
              onChange={(e) => setRemandReasonInput(e.target.value)}
              placeholder="修正が必要な箇所などを入力してください"
            ></textarea>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setRemandModalOpen(false)} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">キャンセル</button>
              <button onClick={handleRemandSubmit} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500">差戻し実行</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ReportScreen;
