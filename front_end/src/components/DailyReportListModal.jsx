import { useState, useEffect, useRef } from 'react';
import Modal from 'react-modal';
import axios from 'axios';
import { getDaysInMonth, getDay, format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import DailyReportListPrint from './DailyReportListPrint';

const API_URL = '/api';

/**
 * モーダルのためのカスタムスタイル。
 * @type {object}
 */
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

/**
 * 指定された年月の全日報を一覧表示するモーダルコンポーネント。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているかどうか。
 * @param {Function} props.onRequestClose - モーダルを閉じるための関数。
 * @param {number} props.employeeId - 対象の社員ID。
 * @param {number} props.year - 対象の年。
 * @param {number} props.month - 対象の月。
 * @returns {JSX.Element} レンダリングされたコンポーネント。
 */
const DailyReportListModal = ({ isOpen, onRequestClose, employeeId, year, month }) => {
  /** @type {[Array<object>, Function]} 日報データのリストの状態管理 */
  const [reports, setReports] = useState([]);
  /** @type {[boolean, Function]} データ読み込み中のフラグの状態管理 */
  const [isLoading, setIsLoading] = useState(false);
  /** @type {[object, Function]} 祝日データの状態管理 */
  const [holidays, setHolidays] = useState({});

  /** @type {React.MutableRefObject<undefined>} 印刷用コンポーネントへの参照 */
  const printComponentRef = useRef();

  /**
   * 印刷ダイアログをトリガーする関数。
   */
  const handlePrint = useReactToPrint({
    content: () => printComponentRef.current,
  });

  /**
   * モーダルが開かれたときに、対象年月の全ての日報データをフェッチします。
   * 日報データと作業記録を並行して取得し、表示用に結合します。
   */
  useEffect(() => {
    if (isOpen) {
      const fetchReports = async () => {
        setIsLoading(true);
        try {
          const daysInMonth = getDaysInMonth(new Date(year, month - 1));
          const dateList = Array.from({ length: daysInMonth }, (_, i) => 
            format(new Date(year, month - 1, i + 1), 'yyyy-MM-dd')
          );
          
          const reportPromises = dateList.map(date => 
            axios.get(`${API_URL}/daily_report/${employeeId}/${date}`)
          );
          const workRecordPromise = axios.get(`${API_URL}/work_records/${employeeId}/${year}/${month}`);
          const holidayPromise = axios.get(`${API_URL}/holidays/${year}`);
          
          const [reportResponses, workRecordResponse, holidayResponse] = await Promise.all([
              Promise.all(reportPromises),
              workRecordPromise,
              holidayPromise
          ]);

          const holidaysData = holidayResponse.data;
          setHolidays(holidaysData);
          const workRecordsMap = new Map(workRecordResponse.data.records.map(r => [r.day, r]));

          const combinedData = dateList.map((dateStr, i) => {
            const report = reportResponses[i].data;
            const day = i + 1;
            const workRecord = workRecordsMap.get(day);
            const dateObj = new Date(dateStr);
            const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
            
            const workMinutes = calculateWorkMinutes(workRecord?.start_time, workRecord?.end_time, workRecord?.break_time);

            const isHoliday = !!holidaysData[dateStr];

            return {
              date: day,
              dayOfWeek: weekdays[getDay(dateObj)],
              isHoliday,
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

  /**
   * レポートデータに基づいてテーブル行のCSSクラス名を返します。
   * @param {object} report - 表示するレポートオブジェクト。
   * @returns {string} Tailwind CSSのクラス名。
   */
  const getRowClassName = (report) => {
    if (report.isHoliday || report.dayOfWeek === '日') {
      return 'bg-red-100 hover:bg-red-200 align-top';
    }
    if (report.dayOfWeek === '土') {
      return 'bg-blue-100 hover:bg-blue-200 align-top';
    }
    return 'hover:bg-gray-50 align-top';
  };

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
      {/* 印刷用のコンポーネント（画面外に配置） */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <DailyReportListPrint ref={printComponentRef} reports={reports} year={year} month={month} />
      </div>
    </>
  );
};

// --- ヘルパー関数 ---

/**
 * 'HH:MM'形式の時間文字列を分単位の数値に変換します。
 * @param {string} timeStr - 時間文字列。
 * @returns {number} 合計分数。不正な形式の場合は0を返します。
 */
const timeToMinutes = (timeStr) => {
    if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * 分単位の数値を'H:MM'形式の時間文字列に変換します。
 * @param {number} totalMinutes - 合計分数。
 * @returns {string} フォーマットされた時間文字列。0以下の場合は空文字列を返します。
 */
const minutesToTime = (totalMinutes) => {
    if (isNaN(totalMinutes) || totalMinutes <= 0) return '';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
};

/**
 * 開始時刻、終了時刻、休憩時間から実働時間（分）を計算します。
 * @param {string} start - 開始時刻 ('HH:MM')。
 * @param {string} end - 終了時刻 ('HH:MM')。
 * @param {string} breakTime - 休憩時間 ('HH:MM')。
 * @returns {number} 実働分数。
 */
const calculateWorkMinutes = (start, end, breakTime) => {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (endMinutes < startMinutes) return 0; // 日またぎは考慮しない
    const workMinutes = endMinutes - startMinutes;
    const breakMinutes = timeToMinutes(breakTime);
    return Math.max(0, workMinutes - breakMinutes);
};

export default DailyReportListModal;
