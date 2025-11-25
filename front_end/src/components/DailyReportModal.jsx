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

  // --- 明細関連の状態管理 ---
  const [details, setDetails] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [totalDetailTime, setTotalDetailTime] = useState(0);

  useEffect(() => {
    const fetchMasters = async () => {
      try {
        const [clientsRes, projectsRes] = await Promise.all([
          axios.get(`${API_URL}/clients`),
          axios.get(`${API_URL}/projects`)
        ]);
        setClients(clientsRes.data);
        setProjects(projectsRes.data);
      } catch (error) {
        console.error("マスタ取得エラー:", error);
      }
    };
    if (isOpen) fetchMasters();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && workRecord) {
      // 既存の明細があればセットする (workRecordにdetailsが含まれている前提)
      if (workRecord.details && workRecord.details.length > 0) {
        setDetails(workRecord.details.map(d => ({
          client_id: d.client_id,
          project_id: d.project_id,
          work_time: d.work_time
        })));
      } else {
        // 新規または明細なし
        setDetails([]);
      }
    }
  }, [isOpen, workRecord]);

  // 明細合計時間の計算
  useEffect(() => {
    const total = details.reduce((sum, d) => sum + (d.work_time || 0), 0);
    setTotalDetailTime(total);
  }, [details]);


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
      
      const fetchReport = async () => {
        try {
          const response = await axios.get(`${API_URL}/daily_report/${employeeId}/${date}`);
          const initialData = {
              work_summary: workRecord?.work_content || '',
              problems: '・', challenges: '・', tomorrow_tasks: '・', thoughts: '・'
          };
          if (response.data) {
            setReportData({ ...initialData, ...response.data });
          } else {
            setReportData(initialData);
          }
        } catch (error) {
          console.error("日報データの取得に失敗しました:", error);
        }
      };
      fetchReport();
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

  // --- 明細操作ハンドラ ---
  const handleAddDetail = () => {
    setDetails([...details, { client_id: '', project_id: '', work_time: 0 }]);
  };

  const handleRemoveDetail = (index) => {
    const newDetails = [...details];
    newDetails.splice(index, 1);
    setDetails(newDetails);
  };

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...details];
    // 取引先変更時は案件をリセット
    if (field === 'client_id') {
        newDetails[index].project_id = '';
    }
    newDetails[index][field] = value;
    setDetails(newDetails);
  };

  // 勤務時間計算（分）
  const calculateWorkDuration = () => {
    const [sh, sm] = times.startTime.split(':').map(Number);
    const [eh, em] = times.endTime.split(':').map(Number);
    const [bh, bm] = times.breakTime.split(':').map(Number);

    let duration = (eh * 60 + em) - (sh * 60 + sm) - (bh * 60 + bm);
    return Math.max(0, duration);
  };

  /**
   * 「適用して閉じる」ボタンのハンドラ。
   * 日報データをDBに保存し、親コンポーネントに変更を通知してからモーダルを閉じます。
   */
  const handleApplyAndClose = async () => {
    // 時間チェック
    const workDuration = calculateWorkDuration();
    if (Math.abs(workDuration - totalDetailTime) > 0 && details.length > 0) {
        if (!window.confirm(`作業明細の合計(${totalDetailTime}分)と実働時間(${workDuration}分)が一致していません。保存しますか？`)) {
            return;
        }
    }

    try {
      await axios.post(`${API_URL}/daily_report`, {
        employee_id: employeeId,
        date: date,
        ...reportData,
        start_time: times.startTime,
        end_time: times.endTime,
        break_time: times.breakTime,
        details: details // 明細も送信
      });

      // 親への通知: work_contentはサーバー側で生成されるが、即時反映のために
      // クライアント側でも簡易生成して渡すか、リロードを促すフラグを立てる
      // ここでは簡易生成はせず、リロードを促すためコールバックには主要データのみ渡す
      // (App.jsx側で再取得処理が走るように onReportUpdate(true) を呼んでいるのでOK)

      onSave({
          day: new Date(date).getDate(),
          start_time: times.startTime,
          end_time: times.endTime,
          break_time: times.breakTime,
          work_content: reportData.work_summary, // テキストエリアの値を優先表示、またはサーバー生成値を待つなら空でも
          details: details // クライアント反映用
      });

      onReportUpdate(true);
      onRequestClose();
    } catch (error) {
      console.error("日報データの保存に失敗しました:", error);
      alert("日報データの保存に失敗しました。");
    }
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
          <div className="space-y-2 p-4 border rounded w-full bg-gray-50">
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
              <div className="text-right font-bold mt-2">
                  実働時間: {Math.floor(calculateWorkDuration() / 60)}時間 {calculateWorkDuration() % 60}分 ({calculateWorkDuration()}分)
              </div>
          </div>

          {/* 作業明細入力 */}
          <div className="p-4 border rounded w-full mt-4 bg-blue-50">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold">作業内訳 (ディテール)</h3>
                <button onClick={handleAddDetail} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">+ 行追加</button>
            </div>
            <table className="w-full bg-white border">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="p-2 border w-40">取引先</th>
                        <th className="p-2 border">案件</th>
                        <th className="p-2 border w-32">時間(分)</th>
                        <th className="p-2 border w-16"></th>
                    </tr>
                </thead>
                <tbody>
                    {details.map((detail, index) => (
                        <tr key={index}>
                            <td className="p-2 border">
                                <select className="w-full p-1 border rounded" value={detail.client_id} onChange={(e) => handleDetailChange(index, 'client_id', parseInt(e.target.value))}>
                                    <option value="">選択...</option>
                                    {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
                                </select>
                            </td>
                            <td className="p-2 border">
                                <select className="w-full p-1 border rounded" value={detail.project_id} onChange={(e) => handleDetailChange(index, 'project_id', parseInt(e.target.value))} disabled={!detail.client_id}>
                                    <option value="">選択...</option>
                                    {projects.filter(p => p.client_id === detail.client_id).map(p => (
                                        <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="p-2 border">
                                <input type="number" className="w-full p-1 border rounded text-right" value={detail.work_time} onChange={(e) => handleDetailChange(index, 'work_time', parseInt(e.target.value) || 0)} step="15" />
                            </td>
                            <td className="p-2 border text-center">
                                <button onClick={() => handleRemoveDetail(index)} className="text-red-500 hover:text-red-700">×</button>
                            </td>
                        </tr>
                    ))}
                    {details.length === 0 && <tr><td colSpan="4" className="p-2 text-center text-gray-500">明細なし</td></tr>}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-100 font-bold">
                        <td colSpan="2" className="p-2 text-right border">合計</td>
                        <td className="p-2 text-right border">{Math.floor(totalDetailTime / 60)}h {totalDetailTime % 60}m</td>
                        <td className="border"></td>
                    </tr>
                </tfoot>
            </table>
            {Math.abs(calculateWorkDuration() - totalDetailTime) > 0 && details.length > 0 && (
                <div className="text-red-600 text-sm mt-1 text-right">
                    実働時間との差分: {calculateWorkDuration() - totalDetailTime}分
                </div>
            )}
          </div>

          {/* テキストエリア */}
          <div className="space-y-4 p-4 border rounded mt-4 w-full">
            <TextAreaField label="作業内容" value={reportData.work_summary} onChange={(e) => handleDataChange('work_summary', e.target.value)} rows={4} />
            <TextAreaField label="問題点" value={reportData.problems} onChange={(e) => handleDataChange('problems', e.target.value)} rows={2} />
            <TextAreaField label="課題" value={reportData.challenges} onChange={(e) => handleDataChange('challenges', e.target.value)} rows={2} />
            <TextAreaField label="明日する内容" value={reportData.tomorrow_tasks} onChange={(e) => handleDataChange('tomorrow_tasks', e.target.value)} rows={2} />
            <TextAreaField label="所感" value={reportData.thoughts} onChange={(e) => handleDataChange('thoughts', e.target.value)} rows={2} />
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
