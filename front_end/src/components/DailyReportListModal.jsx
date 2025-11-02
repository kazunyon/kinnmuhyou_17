import { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import axios from 'axios';
import { getDaysInMonth, getDay, format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import DailyReportListPrint from './DailyReportListPrint';

const API_URL = '/api';

/** @type {object} モーダルのためのカスタムスタイル */
const modalStyles = {
  content: { top: '50%', left: '50%', right: 'auto', bottom: 'auto', marginRight: '-50%', transform: 'translate(-50%, -50%)', width: '95%', maxWidth: '1200px', height: '90vh', padding: '1rem 2rem' },
  overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)' },
};

/**
 * 指定された年月の全日報を一覧表示するモーダル。
 * @param {object} props - プロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているか。
 * @param {Function} props.onRequestClose - モーダルを閉じる関数。
 * @param {number} props.employeeId - 対象の社員ID。
 * @param {number} props.year - 対象の年。
 * @param {number} props.month - 対象の月。
 * @returns {JSX.Element} レンダリングされたコンポーネント。
 */
const DailyReportListModal = ({ isOpen, onRequestClose, employeeId, year, month }) => {
  /** @type {[object[], Function]} 日報データリスト */
  const [reports, setReports] = useState([]);
  /** @type {[boolean, Function]} データ読み込み中フラグ */
  const [isLoading, setIsLoading] = useState(false);
  const printComponentRef = useRef();
  const handlePrint = useReactToPrint({ content: () => printComponentRef.current });

  /**
   * 副作用フック: モーダルが開いたときに対象年月の全日報データを取得します。
   */
  useEffect(() => {
    if (isOpen) {
      const fetchReports = async () => {
        setIsLoading(true);
        try {
          const daysInMonth = getDaysInMonth(new Date(year, month - 1));
          const dateList = Array.from({ length: daysInMonth }, (_, i) => format(new Date(year, month - 1, i + 1), 'yyyy-MM-dd'));
          
          const [reportRes, workRecRes, holidayRes] = await Promise.all([
              Promise.all(dateList.map(date => axios.get(`${API_URL}/daily_report/${employeeId}/${date}`))),
              axios.get(`${API_URL}/work_records/${employeeId}/${year}/${month}`),
              axios.get(`${API_URL}/holidays/${year}`)
          ]);

          const holidaysData = holidayRes.data;
          const workRecordsMap = new Map(workRecRes.data.records.map(r => [r.day, r]));
          const weekdays = ['日', '月', '火', '水', '木', '金', '土'];

          const combinedData = dateList.map((dateStr, i) => {
            const day = i + 1;
            const report = reportRes[i].data;
            const workRecord = workRecordsMap.get(day);
            const workMinutes = calculateWorkMinutes(workRecord?.start_time, workRecord?.end_time, workRecord?.break_time);
            return {
              date: day,
              dayOfWeek: weekdays[getDay(new Date(dateStr))],
              isHoliday: !!holidaysData[dateStr],
              workTime: minutesToTime(workMinutes),
              work_summary: workRecord?.work_content || report?.work_summary || '',
              ...report
            };
          });
          setReports(combinedData);
        } catch (error) {
          console.error("日報一覧の取得に失敗:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchReports();
    }
  }, [isOpen, employeeId, year, month]);

  /**
   * 曜日に基づいてテーブル行のCSSクラス名を返します。
   * @param {object} report - レポートオブジェクト。
   * @returns {string} Tailwind CSSのクラス名。
   */
  const getRowClassName = ({ isHoliday, dayOfWeek }) => {
    if (isHoliday || dayOfWeek === '日') return 'bg-red-100 hover:bg-red-200 align-top';
    if (dayOfWeek === '土') return 'bg-blue-100 hover:bg-blue-200 align-top';
    return 'hover:bg-gray-50 align-top';
  };

  return (
    <>
      <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="日報一覧">
        <div className="flex flex-col h-full">
          <h2 className="text-xl font-bold text-center mb-4">日報一覧 ({year}年{month}月)</h2>
          <div className="flex-grow overflow-auto">
            {isLoading ? <p>読み込み中...</p> : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-2 border w-[4%]">日付</th><th className="p-2 border w-[4%]">曜日</th>
                    <th className="p-2 border w-[7%]">作業時間</th><th className="p-2 border w-[30.6%]">作業内容</th>
                    <th className="p-2 border w-[13.6%]">問題点</th><th className="p-2 border w-[13.6%]">課題</th>
                    <th className="p-2 border w-[13.6%]">明日する内容</th><th className="p-2 border w-[13.6%]">所感</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.date} className={getRowClassName(report)}>
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
      <div className="hidden">
        <DailyReportListPrint ref={printComponentRef} reports={reports} year={year} month={month} />
      </div>
    </>
  );
};

// --- Helper Functions ---

/**
 * 'HH:MM'形式の時間文字列を分単位の数値に変換します。
 * @param {string} timeStr - 時間文字列。
 * @returns {number} 合計分数。
 */
const timeToMinutes = (timeStr) => {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

/**
 * 分単位の数値を'H:MM'形式の時間文字列に変換します。
 * @param {number} totalMinutes - 合計分数。
 * @returns {string} フォーマットされた時間文字列。
 */
const minutesToTime = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '';
    return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`;
};

/**
 * 実働時間（分）を計算します。
 * @param {string} start - 開始時刻 ('HH:MM')。
 * @param {string} end - 終了時刻 ('HH:MM')。
 * @param {string} breakTime - 休憩時間 ('HH:MM')。
 * @returns {number} 実働分数。
 */
const calculateWorkMinutes = (start, end, breakTime) => {
    const startMins = timeToMinutes(start);
    const endMins = timeToMinutes(end);
    if (endMins < startMins) return 0; // 日またぎは考慮外
    return Math.max(0, endMins - startMins - timeToMinutes(breakTime));
};

export default DailyReportListModal;
