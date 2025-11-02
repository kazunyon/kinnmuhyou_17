import { useState, useEffect } from 'react';
import Modal from 'react-modal';
import axios from 'axios';

const API_URL = '/api';

/** @type {object} モーダルのためのカスタムスタイル */
const modalStyles = {
  content: { top: '50%', left: '50%', right: 'auto', bottom: 'auto', marginRight: '-50%', transform: 'translate(-50%, -50%)', width: '1200px', maxHeight: '90vh', padding: '2rem' },
  overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)' },
};

/**
 * 日報を入力・編集するためのモーダルコンポーネント。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているか。
 * @param {Function} props.onRequestClose - モーダルを閉じる関数。
 * @param {number} props.employeeId - 対象の社員ID。
 * @param {string} props.employeeName - 対象の社員名。
 * @param {string} props.date - 対象の日付 ('YYYY-MM-DD')。
 * @param {object} props.workRecord - 対象日の作業記録。
 * @param {Function} props.onSave - 時間・作業内容の変更を親に通知する関数。
 * @param {Function} props.onReportUpdate - 日報の更新を親に通知する関数。
 * @returns {JSX.Element} レンダリングされたモーダル。
 */
const DailyReportModal = ({ isOpen, onRequestClose, employeeId, employeeName, date, workRecord, onSave, onReportUpdate }) => {
  /** @type {[object, Function]} 日報のテキストデータ */
  const [reportData, setReportData] = useState({ work_summary: '', problems: '', challenges: '', tomorrow_tasks: '', thoughts: '' });
  /** @type {[object, Function]} 勤務時間 */
  const [times, setTimes] = useState({ startTime: '09:00', endTime: '18:00', breakTime: '01:00' });

  /**
   * 副作用フック: モーダルが開いた際、または主要なpropが変更された際に日報データを取得・初期化します。
   */
  useEffect(() => {
    if (isOpen && employeeId && date) {
      setTimes({ startTime: workRecord?.start_time || '09:00', endTime: workRecord?.end_time || '18:00', breakTime: workRecord?.break_time || '01:00' });
      const fetchReport = async () => {
        try {
          const res = await axios.get(`${API_URL}/daily_report/${employeeId}/${date}`);
          const initialData = { work_summary: workRecord?.work_content || '', problems: '・', challenges: '・', tomorrow_tasks: '・', thoughts: '・' };
          setReportData(res.data ? { ...initialData, ...res.data } : initialData);
        } catch (error) {
          console.error("日報データの取得に失敗:", error);
        }
      };
      fetchReport();
    }
  }, [isOpen, employeeId, date, workRecord]);

  /**
   * 時間入力フィールドの変更ハンドラ。
   * @param {'startTime'|'endTime'|'breakTime'} field - 変更対象のフィールド。
   * @param {string} value - 新しい値。
   */
  const handleTimeChange = (field, value) => {
    setTimes(prev => ({ ...prev, [field]: value }));
  };
  
  /**
   * テキストエリアの変更ハンドラ。
   * @param {string} field - 変更対象のフィールド名。
   * @param {string} value - 新しい値。
   */
  const handleDataChange = (field, value) => {
    setReportData(prev => ({ ...prev, [field]: value }));
    if (field === 'work_summary' && value.trim() === '休み') {
      setTimes({ startTime: '00:00', endTime: '00:00', breakTime: '00:00' });
    }
  };

  /**
   * 「適用して閉じる」ボタンのハンドラ。日報データを保存し、親コンポーネントに通知します。
   */
  const handleApplyAndClose = async () => {
    try {
      await axios.post(`${API_URL}/daily_report`, { employee_id: employeeId, date, ...reportData });
      onSave({ day: new Date(date).getDate(), start_time: times.startTime, end_time: times.endTime, break_time: times.breakTime, work_content: reportData.work_summary });
      onReportUpdate(true);
      onRequestClose();
    } catch (error) {
      alert("日報データの保存に失敗しました。");
    }
  };

  /**
   * 「日報ポスト」ボタンのハンドラ。整形した日報をクリップボードにコピーします。
   */
  const handlePostReport = () => {
    const postBody = `日報入力 (${date})\n氏名：${employeeName || ''}\n[作業内容]\n${reportData.work_summary}\n[問題点]\n${reportData.problems}\n[課題]\n${reportData.challenges}\n[明日する内容]\n${reportData.tomorrow_tasks}\n[所感]\n${reportData.thoughts}`;
    navigator.clipboard.writeText(postBody).then(() => alert('日報がクリップボードにコピーされました。'), () => alert('クリップボードへのコピーに失敗しました。'));
  };

  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minuteOptions = ['00', '15', '30', '45'];
  const breakMinuteOptions = Array.from({ length: 21 }, (_, i) => i * 15);

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="日報入力">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-center flex-grow">日報入力 ({date})</h2>
          <ActionButtons onClose={onRequestClose} onPost={handlePostReport} onApply={handleApplyAndClose} />
        </div>
        <div className="mx-auto">
          <div className="space-y-2 p-4 border rounded w-full">
            <TimePicker label="開始時間" time={times.startTime} onTimeChange={v => handleTimeChange('startTime', v)} hourOpts={hourOptions} minOpts={minuteOptions} />
            <div className="flex items-center">
              <TimePicker label="終了時間" time={times.endTime} onTimeChange={v => handleTimeChange('endTime', v)} hourOpts={hourOptions} minOpts={minuteOptions} />
              <BreakTimePicker label="休憩時間" time={times.breakTime} onTimeChange={v => handleTimeChange('breakTime', v)} minOpts={breakMinuteOptions} />
            </div>
          </div>
          <div className="space-y-4 p-4 border rounded mt-10 w-full">
            <TextAreaField label="作業内容" value={reportData.work_summary} onChange={e => handleDataChange('work_summary', e.target.value)} rows={4} />
            <TextAreaField label="問題点" value={reportData.problems} onChange={e => handleDataChange('problems', e.target.value)} rows={2} />
            <TextAreaField label="課題" value={reportData.challenges} onChange={e => handleDataChange('challenges', e.target.value)} rows={2} />
            <TextAreaField label="明日する内容" value={reportData.tomorrow_tasks} onChange={e => handleDataChange('tomorrow_tasks', e.target.value)} rows={2} />
            <TextAreaField label="所感" value={reportData.thoughts} onChange={e => handleDataChange('thoughts', e.target.value)} rows={2} />
          </div>
        </div>
        <div className="flex justify-end space-x-4 pt-4">
          <ActionButtons onClose={onRequestClose} onPost={handlePostReport} onApply={handleApplyAndClose} />
        </div>
      </div>
    </Modal>
  );
};

/**
 * モーダルのアクションボタン群。
 * @param {{onClose: Function, onPost: Function, onApply: Function}} props
 */
const ActionButtons = ({ onClose, onPost, onApply }) => (
  <div className="flex justify-end space-x-4">
    <button onClick={onClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
    <button onClick={onPost} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">日報ポスト</button>
    <button onClick={onApply} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">適用して閉じる</button>
  </div>
);

/**
 * 時刻ピッカーコンポーネント。
 * @param {{label: string, time: string, onTimeChange: Function, hourOpts: string[], minOpts: string[]}} props
 */
const TimePicker = ({ label, time, onTimeChange, hourOpts, minOpts }) => {
  const [h, m] = (time || "00:00").split(":");
  return (
    <div className="flex items-center space-x-2">
      <span className="w-20">{label}</span>
      <select value={h} onChange={e => onTimeChange(`${e.target.value}:${m}`)} className="border rounded p-1">{hourOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
      <span>時</span>
      <select value={m} onChange={e => onTimeChange(`${h}:${e.target.value}`)} className="border rounded p-1">{minOpts.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
      <span>分</span>
    </div>
  );
};

/**
 * 休憩時間ピッカーコンポーネント。
 * @param {{label: string, time: string, onTimeChange: Function, minOpts: number[]}} props
 */
const BreakTimePicker = ({ label, time, onTimeChange, minOpts }) => {
  const totalMinutes = parseInt((time || "00:00").split(':')[0]) * 60 + parseInt((time || "00:00").split(':')[1]);
  return (
    <div className="flex items-center space-x-2 ml-8">
      <span>{label}</span>
      <select value={totalMinutes} onChange={e => {
        const mins = parseInt(e.target.value);
        onTimeChange(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`);
      }} className="border rounded p-1">{minOpts.map(opt => <option key={opt} value={opt}>{opt} 分</option>)}</select>
    </div>
  );
};

/**
 * ラベル付きテキストエリアコンポーネント。
 * @param {{label: string, value: string, onChange: Function, rows: number}} props
 */
const TextAreaField = ({ label, value, onChange, rows }) => (
  <div>
    <label className="block font-semibold mb-1">{label}</label>
    <textarea value={value} onChange={onChange} rows={rows} className="w-full p-2 border rounded" />
  </div>
);

export default DailyReportModal;
