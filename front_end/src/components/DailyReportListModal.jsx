import { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import axios from 'axios';
import { getDaysInMonth, getDay, format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import DailyReportListPrint from './DailyReportListPrint';

const API_URL = '/api';

const modalStyles = {
  content: {
    top: '50%', left: '50%', right: 'auto', bottom: 'auto',
    marginRight: '-50%', transform: 'translate(-50%, -50%)',
    width: '95%', maxWidth: '1200px', height: '90vh', padding: '1rem 2rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
};

const DailyReportListModal = ({ isOpen, onRequestClose, employeeId, year, month }) => {
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const printComponentRef = useRef();
  const handlePrint = useReactToPrint({
    content: () => printComponentRef.current,
  });

  useEffect(() => {
    if (isOpen) {
      const fetchReports = async () => {
        setIsLoading(true);
        try {
          // 1ヶ月分の日付リストを作成
          const daysInMonth = getDaysInMonth(new Date(year, month - 1));
          const dateList = Array.from({ length: daysInMonth }, (_, i) => 
            format(new Date(year, month - 1, i + 1), 'yyyy-MM-dd')
          );
          
          // 全ての日付の日報データを並行して取得
          const reportPromises = dateList.map(date => 
            axios.get(`${API_URL}/daily_report/${employeeId}/${date}`)
          );
          const workRecordPromise = axios.get(`${API_URL}/work_records/${employeeId}/${year}/${month}`);
          
          const [reportResponses, workRecordResponse] = await Promise.all([
              Promise.all(reportPromises),
              workRecordPromise
          ]);

          const workRecordsMap = new Map(workRecordResponse.data.records.map(r => [r.day, r]));

          const combinedData = dateList.map((dateStr, i) => {
            const report = reportResponses[i].data;
            const day = i + 1;
            const workRecord = workRecordsMap.get(day);
            const dateObj = new Date(dateStr);
            const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
            
            const workMinutes = calculateWorkMinutes(workRecord?.start_time, workRecord?.end_time, workRecord?.break_time);

            return {
              date: day,
              dayOfWeek: weekdays[getDay(dateObj)],
              workTime: minutesToTime(workMinutes),
              work_summary: workRecord?.work_content || report?.work_summary || '',
              problems: report?.problems || '',
              challenges: report?.challenges || '',
              tomorrow_tasks: report?.tomorrow_tasks || '',
              thoughts: report?.thoughts || '',
            };
          });
          
          setReports(combinedData);
        } catch (error) {
          console.error("日報一覧の取得に失敗しました:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchReports();
    }
  }, [isOpen, employeeId, year, month]);

  return (
    <>
      <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="日報一覧">
        <div className="flex flex-col h-full">
          <h2 className="text-xl font-bold text-center mb-4">日報一覧 ({year}年{month}月)</h2>
          <div className="flex-grow overflow-auto">
            {isLoading ? (
              <p>読み込み中...</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-2 border w-[4%]">日付</th>
                    <th className="p-2 border w-[4%]">曜日</th>
                    <th className="p-2 border w-[7%]">作業時間</th>
                    <th className="p-2 border w-[30.6%]">作業内容</th>
                    <th className="p-2 border w-[13.6%]">問題点</th>
                    <th className="p-2 border w-[13.6%]">課題</th>
                    <th className="p-2 border w-[13.6%]">明日する内容</th>
                    <th className="p-2 border w-[13.6%]">所感</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.date} className="hover:bg-gray-50 align-top">
                      <td className="p-2 border text-center">{report.date}</td>
                      <td className="p-2 border text-center">{report.dayOfWeek}</td>
                      <td className="p-2 border text-center">{report.workTime}</td>
                      <td className="p-2 border whitespace-pre-wrap">{report.work_summary}</td>
                      <td className="p-2 border whitespace-pre-wrap">{report.problems}</td>
                      <td className="p-2 border whitespace-pre-wrap">{report.challenges}</td>
                      <td className="p-2 border whitespace-pre-wrap">{report.tomorrow_tasks}</td>
                      <td className="p-2 border whitespace-pre-wrap">{report.thoughts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handlePrint} className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mr-2">印刷</button>
            <button onClick={onRequestClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
          </div>
        </div>
      </Modal>
      <div style={{ visibility: 'hidden', height: 0, overflow: 'hidden' }}>
        <DailyReportListPrint ref={printComponentRef} reports={reports} year={year} month={month} />
      </div>
    </>
  );
};

// ヘルパー関数
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

const calculateWorkMinutes = (start, end, breakTime) => {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (endMinutes < startMinutes) return 0;
    const workMinutes = endMinutes - startMinutes;
    const breakMinutes = timeToMinutes(breakTime);
    return Math.max(0, workMinutes - breakMinutes);
};

export default DailyReportListModal;
