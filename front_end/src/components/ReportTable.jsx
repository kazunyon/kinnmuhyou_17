import { useState, useMemo } from 'react';
import { getDay, format } from 'date-fns';

const ReportTable = ({
  currentDate, workRecords, holidays, monthlySummary, onWorkRecordsChange,
  onMonthlySummaryChange, onRowClick, isReadOnly, clients, projects
}) => {
  const [selectedRow, setSelectedRow] = useState(null);
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  // --- 時間計算ロジック ---
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
    return endMinutes < startMinutes ? 0 : endMinutes - startMinutes;
  };

  // --- イベントハンドラ ---
  const handleInputChange = (dayIndex, field, value) => {
    onWorkRecordsChange(prevRecords => {
      const updatedRecords = [...prevRecords];
      const record = { ...updatedRecords[dayIndex] };
      record[field] = value;

      if (['start_time', 'end_time', 'break_time'].includes(field) && value) {
          const [h, m] = value.split(':');
          const minutes = parseInt(m, 10);
          const roundedMinutes = Math.round(minutes / 15) * 15;
          if (roundedMinutes === 60) {
            record[field] = `${String(parseInt(h, 10) + 1).padStart(2,'0')}:00`;
          } else {
            record[field] = `${h}:${String(roundedMinutes).padStart(2, '0')}`;
          }
      }
      updatedRecords[dayIndex] = record;
      return updatedRecords;
    });
  };

  const handleDetailChange = (dayIndex, detailIndex, field, value) => {
    onWorkRecordsChange(prevRecords => {
      const updatedRecords = [...prevRecords];
      const record = { ...updatedRecords[dayIndex] };
      const newDetails = [...(record.details || [])];
      const detail = { ...newDetails[detailIndex] };

      // ID関連のフィールドは数値に変換
      const finalValue = (field === 'client_id' || field === 'project_id') && value ? parseInt(value, 10) : value;
      detail[field] = finalValue;

      if (field === 'client_id') {
          detail.project_id = ''; // 取引先が変わったら案件をリセット
      }

      newDetails[detailIndex] = detail;
      record.details = newDetails;
      updatedRecords[dayIndex] = record;
      return updatedRecords;
    });
  };

  const addDetailRow = (dayIndex) => {
    onWorkRecordsChange(prevRecords => {
      const updatedRecords = [...prevRecords];
      const record = { ...updatedRecords[dayIndex] };
      record.details = [...(record.details || []), { client_id: '', project_id: '', work_time: '00:00' }];
      updatedRecords[dayIndex] = record;
      return updatedRecords;
    });
  };
  
  const removeDetailRow = (dayIndex, detailIndex) => {
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

  // --- レンダリング前の計算 ---
  const totalWorkTimeMinutes = workRecords.reduce((total, record) => {
    const dailyTotal = (record.details || []).reduce((dailySum, detail) => dailySum + timeToMinutes(detail.work_time), 0);
    return total + dailyTotal;
  }, 0);

  const projectsByClient = useMemo(() => {
    return projects.reduce((acc, project) => {
      (acc[project.client_id] = acc[project.client_id] || []).push(project);
      return acc;
    }, {});
  }, [projects]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-400 text-center">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 p-1 w-[4%]">日付</th>
            <th className="border border-gray-300 p-1 w-[4%]">曜日</th>
            <th className="border border-gray-300 p-1 w-[8%]">作業時間</th>
            <th className="border border-gray-300 p-1 w-[30%]">作業内容詳細</th>
            <th className="border border-gray-300 p-1 w-[8%]">①出社時刻</th>
            <th className="border border-gray-300 p-1 w-[8%]">②退社時刻</th>
            <th className="border border-gray-300 p-1 w-[8%]">③勤務時間</th>
            <th className="border border-gray-300 p-1 w-[8%]">④休憩時間</th>
          </tr>
        </thead>
        <tbody>
          {workRecords.map((record, i) => {
            const date = new Date(year, month, record.day);
            const dayOfWeek = getDay(date);
            const isHoliday = !!holidays[format(date, 'yyyy-MM-dd')] || dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const rowClass = selectedRow === i ? 'bg-selected-yellow' : isHoliday ? 'bg-holiday-red' : isSaturday ? 'bg-saturday-blue' : '';
            const totalDetailMinutes = (record.details || []).reduce((sum, detail) => sum + timeToMinutes(detail.work_time), 0);
            const workMinutes = calculateDuration(record.start_time, record.end_time);
            const breakMinutes = timeToMinutes(record.break_time);
            const netWorkMinutes = workMinutes - breakMinutes;

            // 作業時間合計と実働時間が一致しない場合に警告するためのクラス
            const timeMismatch = totalDetailMinutes > 0 && totalDetailMinutes !== netWorkMinutes;
            const totalTimeClass = timeMismatch ? 'text-red-500 font-bold' : '';

            return (
              <tr key={record.day} className={rowClass} onClick={() => setSelectedRow(i)} onDoubleClick={() => onRowClick(record)}>
                <td className="border border-gray-300 p-1">{record.day}</td>
                <td className="border border-gray-300 p-1">{weekdays[dayOfWeek]}</td>
                <td className={`border border-gray-300 p-1 bg-gray-100 ${totalTimeClass}`}>{minutesToTime(totalDetailMinutes)}</td>
                <td className="border border-gray-300 p-1 text-left align-top">
                  {(record.details || []).map((detail, detailIndex) => (
                    <div key={detailIndex} className="grid grid-cols-12 gap-1 mb-1 items-center">
                      <select
                        value={detail.client_id || ''}
                        onChange={(e) => handleDetailChange(i, detailIndex, 'client_id', e.target.value)}
                        className={`col-span-4 p-1 border rounded text-xs ${isReadOnly ? 'bg-gray-100' : ''}`}
                        disabled={isReadOnly}
                      >
                        <option value="">取引先</option>
                        {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
                      </select>
                      <select
                        value={detail.project_id || ''}
                        onChange={(e) => handleDetailChange(i, detailIndex, 'project_id', e.target.value)}
                        className={`col-span-5 p-1 border rounded text-xs ${isReadOnly || !detail.client_id ? 'bg-gray-100' : ''}`}
                        disabled={isReadOnly || !detail.client_id}
                      >
                        <option value="">案件</option>
                        {(projectsByClient[detail.client_id] || []).map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
                      </select>
                      <input
                        type="time"
                        step="900"
                        value={detail.work_time || '00:00'}
                        onChange={(e) => handleDetailChange(i, detailIndex, 'work_time', e.target.value)}
                        className={`col-span-2 p-1 border rounded text-xs ${isReadOnly ? 'bg-gray-100' : ''}`}
                        readOnly={isReadOnly}
                      />
                      {!isReadOnly && <button onClick={() => removeDetailRow(i, detailIndex)} className="col-span-1 text-red-500 hover:text-red-700 text-xs">×</button>}
                    </div>
                  ))}
                  {!isReadOnly && <button onClick={() => addDetailRow(i)} className="mt-1 text-blue-600 hover:text-blue-800 text-xs">+ 作業を追加</button>}
                </td>
                <td><input type="time" step="900" value={record.start_time || ''} onChange={e => handleInputChange(i, 'start_time', e.target.value)} disabled={isReadOnly} className={`w-full p-1 border-none bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`} /></td>
                <td><input type="time" step="900" value={record.end_time || ''} onChange={e => handleInputChange(i, 'end_time', e.target.value)} disabled={isReadOnly} className={`w-full p-1 border-none bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`} /></td>
                <td className="bg-gray-100">{minutesToTime(workMinutes)}</td>
                <td><input type="time" step="900" value={record.break_time || '00:00'} onChange={e => handleInputChange(i, 'break_time', e.target.value)} disabled={isReadOnly} className={`w-full p-1 border-none bg-transparent ${isReadOnly ? 'bg-gray-100' : ''}`} /></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-bold">
            <td colSpan="2" className="border border-gray-300 p-1">合計</td>
            <td className="border border-gray-300 p-1">{minutesToTime(totalWorkTimeMinutes)}</td>
            <td colSpan="5" className="border border-gray-300 p-1"></td>
          </tr>
          {monthlySummary && (
            <>
              {/* monthly summary rows */}
            </>
          )}
        </tfoot>
      </table>
    </div>
  );
};

export default ReportTable;
