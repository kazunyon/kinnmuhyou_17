import React from 'react';
import { getDaysInMonth, getDay, format } from 'date-fns';

const PrintLayout = React.forwardRef((props, ref) => {
  const { employee, company, currentDate, workRecords, holidays } = props;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentDate);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

  const timeToMinutes = (timeStr) => {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  };
  
  const calculateDuration = (start, end) => {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (endMinutes < startMinutes) return 0;
    return endMinutes - startMinutes;
  };
  
  const totalWorkTimeMinutes = workRecords.reduce((total, record) => {
      const workMinutes = calculateDuration(record.start_time, record.end_time);
      const breakMinutes = timeToMinutes(record.break_time);
      const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
      return total + actualWorkMinutes;
  }, 0);

  return (
    <div ref={ref} className="p-8 bg-white text-black print-container">
      <div className="text-center mb-4">
        <h2 className="text-sm font-bold">{format(currentDate, 'yyyy年 M月')}</h2>
        <h1 className="text-lg font-bold" style={{ letterSpacing: '0.5em' }}>作業報告書</h1>
      </div>
      <div className="flex justify-start mb-4 text-sm">
        <div>
          <p>会社名：{company?.company_name}</p>
          <p>部署  ：{employee?.department_name}</p>
          <p>氏名  ：{employee?.employee_name}</p>
        </div>
      </div>

      <table className="w-full border-collapse border border-black text-xs">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-1 w-[4%]">日付</th>
            <th className="border border-black p-1 w-[4%]">曜日</th>
            <th className="border border-black p-1 w-[8%]">作業時間</th>
            <th className="border border-black p-1">作業内容</th>
            <th className="border border-black p-1 w-[8%]">出社</th>
            <th className="border border-black p-1 w-[8%]">退社</th>
            <th className="border border-black p-1 w-[8%]">休憩</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 31 }, (_, i) => { // 常に31行表示
            const day = i + 1;
            if (day > daysInMonth) {
                return (
                    <tr key={day}><td className="border border-black p-1 h-8" colSpan="7"></td></tr>
                );
            }
            const date = new Date(year, month, day);
            const dayOfWeek = getDay(date);
            const dateStr = format(date, 'yyyy-MM-dd');
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const isHoliday = !!holidays[dateStr];

            const record = workRecords.find(r => r.day === day) || {};
            const workMinutes = calculateDuration(record.start_time, record.end_time);
            const breakMinutes = timeToMinutes(record.break_time);
            const actualWorkMinutes = Math.max(0, workMinutes - breakMinutes);
            
            const rowClass = 
              isSunday || isHoliday ? 'bg-holiday-red' :
              isSaturday ? 'bg-saturday-blue' : '';

            return (
              <tr key={day} className={rowClass}>
                <td className="border border-black p-1 text-center">{day}</td>
                <td className="border border-black p-1 text-center">{weekdays[dayOfWeek]}</td>
                <td className="border border-black p-1 text-center">{minutesToTime(actualWorkMinutes)}</td>
                <td className="border border-black p-1 text-left h-8 whitespace-pre-wrap">{record.work_content}</td>
                <td className="border border-black p-1 text-center">{record.start_time}</td>
                <td className="border border-black p-1 text-center">{record.end_time}</td>
                <td className="border border-black p-1 text-center">{record.break_time === '00:00' ? '' : record.break_time}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
            <tr>
                <td className="border border-black p-1 text-center font-bold" colSpan="2">合計</td>
                <td className="border border-black p-1 text-center font-bold">{minutesToTime(totalWorkTimeMinutes)}</td>
                <td className="border border-black p-1" colSpan="4"></td>
            </tr>
            <tr>
                <td className="border border-black p-1 align-top" rowSpan="2">特記事項</td>
                <td className="border border-black p-1 h-24 align-top" colSpan="6">
                  {/* 特記事項はここでは表示しない想定 */}
                </td>
            </tr>
             <tr><td className="border border-black p-1 h-24" colSpan="6"></td></tr>
        </tfoot>
      </table>
    </div>
  );
});

PrintLayout.displayName = 'PrintLayout';

export default PrintLayout;

