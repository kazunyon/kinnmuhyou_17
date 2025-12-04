import { useState } from 'react';
import { getDay, format } from 'date-fns';

const ReportTable = ({ currentDate, workRecords, holidays, monthlySummary, onWorkRecordsChange, onMonthlySummaryChange, onRowClick, isReadOnly, clients, projects }) => {
  const [selectedRow, setSelectedRow] = useState(null);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const timeToMinutes = (timeStr) => {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes < 0) return '';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const calculateDuration = (start, end) => {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (endMinutes < startMinutes) return 0;
    return endMinutes - startMinutes;
  };

  const handleInputChange = (dayIndex, field, value) => {
    onWorkRecordsChange(prevRecords => {
      const updatedRecords = [...prevRecords];
      const record = { ...updatedRecords[dayIndex] };
      record[field] = value;

      // 時間入力の丸め処理などは維持
      if (field === 'start_time' || field === 'end_time' || field === 'break_time') {
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

  const handleAddDetail = () => {
    if (selectedRow === null) {
      alert("行を選択してください");
      return;
    }
    if (isReadOnly) return;

    onWorkRecordsChange(prevRecords => {
      const updatedRecords = [...prevRecords];
      const record = { ...updatedRecords[selectedRow] };
      const newDetails = record.details ? [...record.details] : [];
      newDetails.push({ client_id: '', project_id: '', description: '', work_time: 0 });
      record.details = newDetails;
      updatedRecords[selectedRow] = record;
      return updatedRecords;
    });
  };

  const handleDetailChange = (dayIndex, detailIndex, field, value) => {
    onWorkRecordsChange(prevRecords => {
      const updatedRecords = [...prevRecords];
      const record = { ...updatedRecords[dayIndex] };
      const newDetails = [...(record.details || [])];

      if (field === 'client_id') {
         newDetails[detailIndex] = { ...newDetails[detailIndex], [field]: value, project_id: '' };
      } else if (field === 'work_time_str') {
         // HH:mm 文字列を受け取り、分に変換して work_time に保存
         const minutes = timeToMinutes(value);
         newDetails[detailIndex] = { ...newDetails[detailIndex], work_time: minutes };
      } else {
         newDetails[detailIndex] = { ...newDetails[detailIndex], [field]: value };
      }

      record.details = newDetails;
      updatedRecords[dayIndex] = record;
      return updatedRecords;
    });
  };

  const handleRemoveDetail = (dayIndex, detailIndex) => {
     if (isReadOnly) return;
     onWorkRecordsChange(prevRecords => {
      const updatedRecords = [...prevRecords];
      const record = { ...updatedRecords[dayIndex] };
      const newDetails = [...(record.details || [])];
      newDetails.splice(detailIndex, 1);
      record.details = newDetails;
      updatedRecords[dayIndex] = record;
      return updatedRecords;
    });
  };

  const totalWorkTimeMinutes = workRecords.reduce((total, record) => {
      const workMinutes = calculateDuration(record.start_time, record.end_time);
      const breakMinutes = timeToMinutes(record.break_time);
      const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
      return total + actualWorkMinutes;
  }, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-400 text-center text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 p-1 w-[40px]">日付</th>
            <th className="border border-gray-300 p-1 w-[40px]">曜日</th>
            <th className="border border-gray-300 p-1 w-[80px]">合計<br/>作業時間</th>
            <th className="border border-gray-300 p-1">
               <div className="flex justify-between items-center px-2">
                 <span>作業内容</span>
                 {!isReadOnly && (
                   <button
                     onClick={handleAddDetail}
                     className={`px-2 py-0.5 rounded text-xs text-white ${selectedRow !== null ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-400 cursor-not-allowed'}`}
                   >
                     追加
                   </button>
                 )}
               </div>
            </th>
            <th className="border border-gray-300 p-1 w-[70px]">①出社</th>
            <th className="border border-gray-300 p-1 w-[70px]">②退社</th>
            <th className="border border-gray-300 p-1 w-[60px]">③勤務<br/>(②-①)</th>
            <th className="border border-gray-300 p-1 w-[60px]">④休憩</th>
            <th className="border border-gray-300 p-1 w-[60px]">⑤作業<br/>(③-④)</th>
          </tr>
        </thead>
        <tbody>
          {workRecords.map((record, i) => {
            const day = record.day;
            const date = new Date(year, month, day);
            const dayOfWeek = getDay(date);
            const dateStr = format(date, 'yyyy-MM-dd');
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const isHoliday = !!holidays[dateStr];

            const workMinutes = calculateDuration(record.start_time, record.end_time);
            const breakMinutes = timeToMinutes(record.break_time);
            const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);

            const details = record.details || [];
            const detailsTotalMinutes = details.reduce((sum, d) => sum + (d.work_time || 0), 0);

            // 警告判定: 作業時間 > 0 のとき、詳細合計と不一致なら警告
            // また、休日などで作業時間0の場合はチェック不要かも？
            // 画像の要件は「両者が一致していること」なので、単純比較でOK
            const isTimeMismatch = actualWorkMinutes !== detailsTotalMinutes;

            const rowClass =
              selectedRow === i ? 'bg-yellow-50' : // 選択色は少し薄めに
              isSunday || isHoliday ? 'bg-red-50' :
              isSaturday ? 'bg-blue-50' :
              'bg-white';

            // 合計作業時間セルのスタイル
            const totalTimeStyle = isTimeMismatch ? "text-red-600 font-bold bg-red-100" : "";

            return (
              <tr key={day} className={rowClass} onClick={() => setSelectedRow(i)} onDoubleClick={() => onRowClick(record)}>
                <td className={`border border-gray-300 p-1 ${selectedRow === i ? 'bg-yellow-200' : ''}`}>{day}</td>
                <td className={`border border-gray-300 p-1 ${isSunday || isHoliday ? 'text-red-600' : isSaturday ? 'text-blue-600' : ''}`}>{weekdays[dayOfWeek]}</td>

                {/* 合計作業時間 (詳細の合計) */}
                <td className={`border border-gray-300 p-1 ${totalTimeStyle}`}>
                   {minutesToTime(detailsTotalMinutes)}
                   {isTimeMismatch && <div className="text-[10px] text-red-600">不一致</div>}
                </td>

                {/* 作業内容 (詳細行リスト) */}
                <td className="border border-gray-300 p-1 align-top">
                  {details.length === 0 && (
                     <div className="text-gray-400 text-xs text-left pl-2">
                        {isReadOnly ? '' : '（行を選択して「追加」で作業を入力）'}
                     </div>
                  )}
                  {details.map((detail, idx) => (
                    <div key={idx} className="flex items-center space-x-1 mb-1 last:mb-0">
                      {/* 取引先 */}
                      <select
                         value={detail.client_id}
                         onChange={(e) => handleDetailChange(i, idx, 'client_id', parseInt(e.target.value))}
                         className="border rounded text-xs p-1 w-[120px]"
                         disabled={isReadOnly}
                      >
                         <option value="">取引先選択</option>
                         {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
                      </select>
                      {/* 案件 */}
                      <select
                         value={detail.project_id}
                         onChange={(e) => handleDetailChange(i, idx, 'project_id', parseInt(e.target.value))}
                         className="border rounded text-xs p-1 w-[150px]"
                         disabled={isReadOnly || !detail.client_id}
                      >
                         <option value="">案件選択</option>
                         {projects.filter(p => p.client_id === detail.client_id).map(p => (
                             <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                         ))}
                      </select>
                      {/* 作業詳細 */}
                      <textarea
                         value={detail.description || ''}
                         onChange={(e) => handleDetailChange(i, idx, 'description', e.target.value)}
                         className="border rounded text-xs p-1 flex-grow min-w-[100px]"
                         placeholder="具体的な作業を入力してください"
                         disabled={isReadOnly}
                         rows={1}
                         style={{ resize: 'vertical' }}
                      />
                      {/* 個別作業時間 */}
                      <input
                         type="time"
                         value={minutesToTime(detail.work_time)}
                         onChange={(e) => handleDetailChange(i, idx, 'work_time_str', e.target.value)}
                         className="border rounded text-xs p-1 w-[80px]"
                         disabled={isReadOnly}
                      />
                      {/* 削除ボタン */}
                      {!isReadOnly && (
                        <button onClick={() => handleRemoveDetail(i, idx)} className="text-gray-500 hover:text-red-500 text-lg leading-none">
                           ×
                        </button>
                      )}
                    </div>
                  ))}
                </td>

                {/* 勤怠時間入力群 */}
                <td className="border border-gray-300 p-1">
                  <input type="time" step="900" value={record.start_time || ''} onChange={(e) => handleInputChange(i, 'start_time', e.target.value)} className="w-full bg-transparent text-center" disabled={isReadOnly} />
                </td>
                <td className="border border-gray-300 p-1">
                  <input type="time" step="900" value={record.end_time || ''} onChange={(e) => handleInputChange(i, 'end_time', e.target.value)} className="w-full bg-transparent text-center" disabled={isReadOnly} />
                </td>
                <td className="border border-gray-300 p-1 bg-gray-100">{minutesToTime(workMinutes)}</td>
                <td className="border border-gray-300 p-1">
                   <input type="time" step="900" value={record.break_time || '00:00'} onChange={(e) => handleInputChange(i, 'break_time', e.target.value)} className="w-full bg-transparent text-center" disabled={isReadOnly} />
                </td>
                <td className={`border border-gray-300 p-1 bg-gray-100 ${isTimeMismatch ? 'text-red-600 font-bold' : ''}`}>{minutesToTime(actualWorkMinutes)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
           {/* フッター部分は変更なしでOKだが、合計時間の計算などは調整が必要か？
               ここでは単純に props から渡される monthlySummary を表示しているのでそのまま */}
           {/* 一応、全体合計時間のロジックは修正済み */}
          <tr className="bg-gray-200 font-bold">
            <td colSpan="2" className="border border-gray-300 p-1">合計</td>
            <td className="border border-gray-300 p-1">
                {/* ここには詳細の総合計を表示すべきか、勤怠の総合計か？
                    通常は勤怠時間の合計が給与計算に使われるので勤怠合計を表示しつつ、詳細合計も括弧書きなどで出すと親切かも。
                    しかし既存UI維持で、勤怠時間を出す。
                 */}
                {minutesToTime(totalWorkTimeMinutes)}
            </td>
            <td colSpan="6" className="border border-gray-300 p-1"></td>
          </tr>
          {/* ... (monthlySummary rows - same as before) */}
           {monthlySummary && (
            <>
              <tr className="bg-gray-100 text-xs text-center">
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">出勤日数</td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">欠勤</td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">有給</td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">代休</td>
                <td className="border border-gray-300" colSpan="1"></td>
              </tr>
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
              <tr className="bg-gray-100 text-xs text-center">
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">振休</td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">遅刻</td>
                <td className="border border-gray-300 p-1 font-semibold" colSpan="2">早退</td>
                <td className="border border-gray-300" colSpan="3"></td>
              </tr>
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
