import { useState, useEffect } from 'react';
import Modal from 'react-modal';
import axios from 'axios';

const API_URL = '/api';

/**
 * モーダルのためのカスタムスタイル。
 * @type {object}
 */
const modalStyles = {
  content: {
    top: '50%', left: '50%', right: 'auto', bottom: 'auto',
    marginRight: '-50%', transform: 'translate(-50%, -50%)',
    width: '1200px', maxHeight: '90vh', padding: '2rem',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
};

/**
 * 特定の日付の日報を入力・編集するためのモーダルコンポーネント。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているかどうか。
 * @param {Function} props.onRequestClose - モーダルを閉じるための関数。
 * @param {number} props.employeeId - 対象の社員ID。
 * @param {string} props.employeeName - 対象の社員名。
 * @param {string} props.date - 対象の日付 ('YYYY-MM-DD')。
 * @param {object} props.workRecord - 対象日の作業記録オブジェクト。
 * @param {Function} props.onSave - 時間や作業内容の変更を親コンポーネントに通知するコールバック関数。
 * @param {Function} props.onReportUpdate - 日報の更新を親コンポーネントに通知するコールバック関数。
 * @returns {JSX.Element} レンダリングされたモーダルコンポーネント。
 */
const DailyReportModal = ({ isOpen, onRequestClose, employeeId, employeeName, date, workRecord, onSave, onReportUpdate }) => {
  /** @type {[object, Function]} 日報のテキストデータの状態管理 */
  const [reportData, setReportData] = useState({
    work_summary: '', problems: '', challenges: '', tomorrow_tasks: '', thoughts: ''
  });
  
  /** @type {[object, Function]} 勤務時間の状態管理 */
  const [times, setTimes] = useState({
      startTime: '09:00', endTime: '18:00', breakTime: '01:00'
  });

  /** @type {[Array<object>, Function]} 作業明細の状態管理 */
  const [workDetails, setWorkDetails] = useState([]);
  /** @type {[Array<object>, Function]} 案件マスターの状態管理 */
  const [projects, setProjects] = useState([]);

  /**
   * モーダルが開いたとき、または主要なpropが変更されたときに日報データを取得します。
   * 親から渡された作業記録を基に時間と作業内容を初期設定し、
   * その他の日報項目はAPIからフェッチします。
   */
  useEffect(() => {
    if (isOpen && employeeId && date) {
      setTimes({
          startTime: workRecord?.start_time || '09:00',
          endTime: workRecord?.end_time || '18:00',
          breakTime: workRecord?.break_time || '01:00'
      });
      // 親から渡されたworkRecordに作業明細があればそれをセット、なければ空配列
      setWorkDetails(workRecord?.work_details || []);
      
      const fetchData = async () => {
        try {
          // 案件マスターと日報データを並行して取得
          const [projectsRes, reportRes] = await Promise.all([
            axios.get(`${API_URL}/projects`),
            axios.get(`${API_URL}/daily_report/${employeeId}/${date}`)
          ]);

          setProjects(projectsRes.data);

          const initialData = {
              work_summary: workRecord?.work_content || '',
              problems: '・', challenges: '・', tomorrow_tasks: '・', thoughts: '・'
          };
          if (reportRes.data) {
            setReportData({ ...initialData, ...reportRes.data });
          } else {
            setReportData(initialData);
          }
        } catch (error) {
          console.error("日報関連データの取得に失敗しました:", error);
        }
      };
      fetchData();
    }
  }, [isOpen, employeeId, date, workRecord]);

  /**
   * 時間選択の変更をハンドリングし、stateを更新します。
   * @param {'startTime'|'endTime'} field - 変更対象の時間フィールド。
   * @param {'h'|'m'} part - 変更対象が時間か分か。
   * @param {string} value - 新しい値。
   */
  const handleTimeChange = (field, part, value) => {
      const currentTime = times[field];
      let [h, m] = (currentTime || "00:00").split(':');
      if(part === 'h') h = value;
      if(part === 'm') m = value;
      setTimes(prev => ({...prev, [field]: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}));
  };
  
  /**
   * テキストエリアの変更をハンドリングし、stateを更新します。
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
   * 「適用して閉じる」ボタンのハンドラ。
   * 日報データをDBに保存し、親コンポーネントに変更を通知してからモーダルを閉じます。
   */
  const handleApplyAndClose = async () => {
    try {
      // 作業時間の合計を計算
      const totalWorkTime = workDetails.reduce((sum, d) => sum + (parseFloat(d.work_time) || 0), 0);

      // 拘束時間（分）
      const start = new Date(`1970-01-01T${times.startTime}:00`);
      const end = new Date(`1970-01-01T${times.endTime}:00`);
      const diffMinutes = (end - start) / (1000 * 60);

      // 休憩時間（分）
      const breakH = parseInt((times.breakTime || "00:00").split(':')[0], 10);
      const breakM = parseInt((times.breakTime || "00:00").split(':')[1], 10);
      const breakMinutes = breakH * 60 + breakM;

      // 実働時間（時間）
      const actualWorkHours = (diffMinutes - breakMinutes) / 60;

      // 差分が5分（0.083時間）以上ある場合は警告
      if (Math.abs(totalWorkTime - actualWorkHours) > 0.083) {
        if (!window.confirm(`作業内訳の合計時間 (${totalWorkTime.toFixed(2)}h) と、勤務時間から計算された実働時間 (${actualWorkHours.toFixed(2)}h) が一致しません。このまま保存しますか？`)) {
          return; // ユーザーがキャンセルしたら処理を中断
        }
      }

      await axios.post(`${API_URL}/daily_report`, {
        employee_id: employeeId,
        date: date,
        ...reportData,
        start_time: times.startTime,
        end_time: times.endTime,
        break_time: times.breakTime,
        work_details: workDetails, // 作業明細を追加
      });

      onSave({
          day: new Date(date).getDate(),
          start_time: times.startTime,
          end_time: times.endTime,
          break_time: times.breakTime,
          work_content: reportData.work_summary,
          work_details: workDetails, // 親コンポーネントにも渡す
      });

      onReportUpdate(true);
      onRequestClose();
    } catch (error) {
      console.error("日報データの保存に失敗しました:", error);
      alert("日報データの保存に失敗しました。");
    }
  };

  // --- 作業明細関連のハンドラ ---
  const handleDetailChange = (index, field, value) => {
    const newDetails = [...workDetails];
    if (field === 'project_id') {
      newDetails[index][field] = value ? parseInt(value, 10) : '';
    } else {
      newDetails[index][field] = value;
    }
    setWorkDetails(newDetails);
  };

  const handleAddDetail = () => {
    setWorkDetails([...workDetails, { project_id: '', work_time: 0, work_description: '' }]);
  };

  const handleRemoveDetail = (index) => {
    const newDetails = workDetails.filter((_, i) => i !== index);
    setWorkDetails(newDetails);
  };

  /**
   * 「日報ポスト」ボタンのハンドラ。
   * 現在の日報データを整形し、クリップボードにコピーします。
   */
  const handlePostReport = () => {
    const postBody = `日報入力 (${date})
氏名：${employeeName || ''}
[作業内容]
${reportData.work_summary}
[問題点]
${reportData.problems}
[課題]
${reportData.challenges}
[明日する内容]
${reportData.tomorrow_tasks}
[所感]
${reportData.thoughts}`;

    navigator.clipboard.writeText(postBody)
      .then(() => alert('日報がクリップボードにコピーされました。'))
      .catch(err => {
        console.error('クリップボードへのコピーに失敗しました:', err);
        alert('クリップボードへのコピーに失敗しました。');
      });
  };
  
  // 時間と分の選択肢を生成
  const hourOptions = Array.from({length: 24}, (_, i) => String(i).padStart(2, '0'));
  const minuteOptions = ['00', '15', '30', '45'];
  const breakMinuteOptions = Array.from({length: 21}, (_, i) => String(i * 15)); // 0分から300分(5時間)まで

  /**
   * 開始・終了時刻のピッカーをレンダリングするヘルパー関数。
   * @param {'startTime'|'endTime'} field - 対象フィールド。
   * @param {string} label - 表示ラベル。
   * @returns {JSX.Element}
   */
  const renderTimePicker = (field, label) => {
      const [h, m] = (times[field] || "00:00").split(":");
      return (
          <div className="flex items-center space-x-2">
              <span className="w-20">{label}</span>
              <select value={h} onChange={(e) => handleTimeChange(field, 'h', e.target.value)} className="border rounded p-1">
                  {hourOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <span>時</span>
              <select value={m} onChange={(e) => handleTimeChange(field, 'm', e.target.value)} className="border rounded p-1">
                  {minuteOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <span>分</span>
          </div>
      );
  };

  /**
   * アクションボタン群をレンダリングするための変数。
   * @type {JSX.Element}
   */
  const actionButtons = (
    <div className="flex justify-end space-x-4">
      <button onClick={onRequestClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
      <button onClick={handlePostReport} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">日報ポスト</button>
      <button onClick={handleApplyAndClose} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">適用して閉じる</button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="日報入力">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-center flex-grow">日報入力 ({date})</h2>
          {actionButtons}
        </div>

        <div className="mx-auto">
          {/* 時間入力 */}
          <div className="space-y-2 p-4 border rounded w-full">
              {renderTimePicker('startTime', '開始時間')}
              <div className="flex items-center">
                  {renderTimePicker('endTime', '終了時間')}
                  <div className="flex items-center space-x-2 ml-8">
                      <span>休憩時間</span>
                      <select
                          value={parseInt((times.breakTime || "00:00").split(':')[0]) * 60 + parseInt((times.breakTime || "00:00").split(':')[1])}
                          onChange={(e) => {
                              const totalMinutes = parseInt(e.target.value);
                              const h = Math.floor(totalMinutes / 60);
                              const m = totalMinutes % 60;
                              setTimes(prev => ({...prev, breakTime: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}))
                          }}
                          className="border rounded p-1">
                          {breakMinuteOptions.map(opt => <option key={opt} value={opt}>{opt} 分</option>)}
                      </select>
                  </div>
              </div>
          </div>

          {/* テキストエリア */}
          <div className="grid grid-cols-2 gap-6 p-4 border rounded mt-10 w-full">
            <div className="col-span-1 space-y-4">
              <TextAreaField label="作業内容" value={reportData.work_summary} onChange={(e) => handleDataChange('work_summary', e.target.value)} rows={4} />
              <TextAreaField label="問題点" value={reportData.problems} onChange={(e) => handleDataChange('problems', e.target.value)} rows={2} />
              <TextAreaField label="課題" value={reportData.challenges} onChange={(e) => handleDataChange('challenges', e.target.value)} rows={2} />
              <TextAreaField label="明日する内容" value={reportData.tomorrow_tasks} onChange={(e) => handleDataChange('tomorrow_tasks', e.target.value)} rows={2} />
              <TextAreaField label="所感" value={reportData.thoughts} onChange={(e) => handleDataChange('thoughts', e.target.value)} rows={2} />
            </div>

            <div className="col-span-1">
              <h3 className="font-semibold mb-1">作業内訳</h3>
              <div className="border rounded p-2 overflow-y-auto" style={{ maxHeight: '400px' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="p-1 border">案件</th>
                      <th className="p-1 border w-24">時間(h)</th>
                      <th className="p-1 border">説明</th>
                      <th className="p-1 border w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {workDetails.map((detail, index) => (
                      <tr key={index}>
                        <td className="p-1 border">
                          <select
                            value={detail.project_id}
                            onChange={(e) => handleDetailChange(index, 'project_id', e.target.value)}
                            className="w-full p-1 border rounded"
                          >
                            <option value="">案件を選択</option>
                            {projects.map(p => (
                              <option key={p.project_id} value={p.project_id}>
                                {p.customer_name} - {p.project_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-1 border">
                          <input
                            type="number"
                            step="0.25"
                            value={detail.work_time}
                            onChange={(e) => handleDetailChange(index, 'work_time', e.target.value)}
                            className="w-full p-1 border rounded"
                          />
                        </td>
                        <td className="p-1 border">
                          <input
                            type="text"
                            value={detail.work_description}
                            onChange={(e) => handleDetailChange(index, 'work_description', e.target.value)}
                            className="w-full p-1 border rounded"
                          />
                        </td>
                        <td className="p-1 border text-center">
                          <button onClick={() => handleRemoveDetail(index)} className="text-red-500 hover:text-red-700">削除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={handleAddDetail} className="mt-2 w-full bg-gray-200 text-gray-700 px-4 py-1 rounded hover:bg-gray-300">
                + 行を追加
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-4 pt-4">
          {actionButtons}
        </div>
      </div>
    </Modal>
  );
};

/**
 * ラベル付きのテキストエリアを表示する汎用コンポーネント。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {string} props.label - テキストエリアのラベル。
 * @param {string} props.value - テキストエリアの現在の値。
 * @param {Function} props.onChange - 値が変更されたときのコールバック関数。
 * @param {number} props.rows - テキストエリアの行数。
 * @returns {JSX.Element} レンダリングされたテキストエリアフィールド。
 */
const TextAreaField = ({ label, value, onChange, rows }) => (
    <div>
      <label className="block font-semibold mb-1">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full p-2 border rounded"
      />
    </div>
);

export default DailyReportModal;
