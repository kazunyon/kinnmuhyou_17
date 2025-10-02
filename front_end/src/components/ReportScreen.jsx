import React, { useState } from 'react';
import ReportTable from './ReportTable';
import { format, addMonths, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';

// 和暦変換（簡易版）
const toJapaneseEra = (date) => {
  const year = date.getFullYear();
  if (year >= 2019) {
    return `令和${year - 2018}年`;
  }
  // 必要に応じて他の元号も追加
  return `${year}年`;
};

const ReportScreen = ({
  employees, selectedEmployee, company, currentDate, workRecords, holidays, specialNotes,
  isLoading, message, onEmployeeChange, onDateChange, onWorkRecordsChange, onSpecialNotesChange,
  onSave, onPrint, onOpenDailyReportList, onOpenMaster, onRowClick
}) => {

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value);
    const newDate = new Date(currentDate);
    newDate.setFullYear(newYear);
    onDateChange(newDate);
  };

  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value);
    const newDate = new Date(currentDate);
    newDate.setMonth(newMonth);
    onDateChange(newDate);
  };
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i); // 今年を中央に5年分
  const months = Array.from({ length: 12 }, (_, i) => i);

  return (
    <div className="container mx-auto p-4 bg-white shadow-lg rounded-lg">
      {/* ヘッダー */}
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

        {/* タイトル */}
        <h1 className="text-center text-lg font-bold" style={{fontSize: '14pt'}}>
          作　業　報　告　書
        </h1>

        {/* ボタンエリア */}
        <div className="flex justify-end items-center space-x-2">
            {message && <div className="text-green-600 mr-4">{message}</div>}
            <button onClick={onOpenDailyReportList} className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-600">日報一覧</button>
            <button onClick={onOpenMaster} className="bg-gray-700 text-white px-4 py-1 rounded hover:bg-gray-600">マスター</button>
            <button onClick={onSave} className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-500">保存</button>
            <button onClick={onPrint} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-500">印刷</button>
        </div>
      </header>

      {/* 社員情報 */}
      <div className="mb-4 space-y-1 text-10pt">
        <div className="border-b border-black pb-1" style={{ width: '300px' }}>
          会社名　：{company?.company_name || ''}
        </div>
        <div className="border-b border-black pb-1" style={{ width: '300px' }}>
          部署　　：{selectedEmployee?.department_name || ''}
        </div>
        <div className="border-b border-black pb-1" style={{ width: '300px' }}>
          氏名　　：
          <select value={selectedEmployee?.employee_id || ''} onChange={(e) => onEmployeeChange(e.target.value)} className="ml-2 border-none bg-transparent">
             {employees.map(emp => (
               <option key={emp.employee_id} value={emp.employee_id}>
                 {emp.employee_name}
               </option>
             ))}
          </select>
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
          onWorkRecordsChange={onWorkRecordsChange}
          onRowClick={onRowClick}
        />
      )}
      
      {/* 特記事項 */}
      <div className="mt-4">
        <label className="font-bold block mb-1">特記事項</label>
        <textarea
          value={specialNotes}
          onChange={(e) => onSpecialNotesChange(e.target.value)}
          rows="5"
          className="w-full p-2 border rounded"
          placeholder="この月の特記事項を入力してください..."
        ></textarea>
      </div>
    </div>
  );
};

export default ReportScreen;
