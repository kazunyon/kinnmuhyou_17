import { useState } from 'react';
import { getDay, format } from 'date-fns';

const ReportTable = ({ currentDate, workRecords, holidays, onWorkRecordsChange, onRowClick }) => {
  const [selectedRow, setSelectedRow] = useState(null);
  
  // 日付、曜日、祝日情報を生成
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
    if (endMinutes < startMinutes) return 0; // 日付をまたぐ場合は考慮しない
    return endMinutes - startMinutes;
  };

  // --- イベントハンドラ ---
  const handleInputChange = (dayIndex, field, value) => {
    const updatedRecords = [...workRecords];
    const record = { ...updatedRecords[dayIndex] };
    
    // 15分刻みに補正
    if (field === 'start_time' || field === 'end_time' || field === 'break_time') {
      const [h, m] = value.split(':');
      const minutes = parseInt(m, 10);
      const roundedMinutes = Math.round(minutes / 15) * 15;
      if (roundedMinutes === 60) {
        const hours = parseInt(h, 10) + 1;
        value = `${String(hours).padStart(2,'0')}:00`;
      } else {
        value = `${h}:${String(roundedMinutes).padStart(2, '0')}`;
      }
    }
    
    record[field] = value;
    
    // 自動計算
    // O. 勤務時間, Q. 作業時間 は表示専用なので、直接は更新しない
    
    updatedRecords[dayIndex] = record;
    onWorkRecordsChange(updatedRecords);
  };
  
  // 合計作業時間を計算
  const totalWorkTimeMinutes = workRecords.reduce((total, record) => {
      const workMinutes = calculateDuration(record.start_time, record.end_time);
      const breakMinutes = timeToMinutes(record.break_time);
      const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
      return total + actualWorkMinutes;
  }, 0);


  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-400 text-center">
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

            const rowClass = 
              selectedRow === i ? 'bg-selected-yellow' :
              isSunday || isHoliday ? 'bg-holiday-red' :
              isSaturday ? 'bg-saturday-blue' :
              '';

            return (
              <tr key={day} className={rowClass} onClick={() => setSelectedRow(i)} onDoubleClick={() => onRowClick(record)}>
                <td className="border border-gray-300 p-1">{day}</td>
                <td className="border border-gray-300 p-1">{weekdays[dayOfWeek]}</td>
                <td className="border border-gray-300 p-1 bg-gray-100">{minutesToTime(actualWorkMinutes)}</td>
                <td className="border border-gray-300 p-1 text-left">
                  <textarea
                    value={record.work_content || ''}
                    onChange={(e) => handleInputChange(i, 'work_content', e.target.value)}
                    className="w-full h-full p-1 border-none bg-transparent resize-none min-h-[40px]"
                    rows="2"
                  />
                </td>
                <td className="border border-gray-300 p-1">
                  <input
                    type="time"
                    step="900" // 15分刻み
                    value={record.start_time || ''}
                    onChange={(e) => handleInputChange(i, 'start_time', e.target.value)}
                    className="w-full p-1 border-none bg-transparent"
                  />
                </td>
                <td className="border border-gray-300 p-1">
                  <input
                    type="time"
                    step="900"
                    value={record.end_time || ''}
                    onChange={(e) => handleInputChange(i, 'end_time', e.target.value)}
                    className="w-full p-1 border-none bg-transparent"
                  />
                </td>
                <td className="border border-gray-300 p-1 bg-gray-100">{minutesToTime(workMinutes)}</td>
                <td className="border border-gray-300 p-1">
                   <input
                    type="time"
                    step="900"
                    value={record.break_time || '00:00'}
                    onChange={(e) => handleInputChange(i, 'break_time', e.target.value)}
                    className="w-full p-1 border-none bg-transparent"
                  />
                </td>
                <td className="border border-gray-300 p-1 bg-gray-100">{minutesToTime(actualWorkMinutes)}</td>
              </tr>
            );
          })}
        </tbody>
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

