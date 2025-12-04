import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import axios from 'axios';

const modalStyles = {
  content: {
    top: '50%', left: '50%', right: 'auto', bottom: 'auto',
    marginRight: '-50%', transform: 'translate(-50%, -50%)',
    width: '90%', maxWidth: '1000px', height: '80vh', padding: '2rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
};

const ApprovalStatusModal = ({ isOpen, onRequestClose, initialDate }) => {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deptFilter, setDeptFilter] = useState('');
  const [hideFinalized, setHideFinalized] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 開いたときに日付が古くなっている可能性があるので更新はしないが、
      // propsで渡されたinitialDateがあればそれを使うなどの処理
      // ここでは内部state管理で月変更可能にする
      fetchData(currentDate);
    }
  }, [isOpen, currentDate]);

  const fetchData = async (date) => {
    setIsLoading(true);
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const res = await axios.get(`/api/monthly_reports/overview/${year}/${month}`);
      setData(res.data);
    } catch (error) {
      console.error("承認状況の取得に失敗しました", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let filtered = data;

    if (deptFilter) {
      filtered = filtered.filter(item =>
        item.department_name && item.department_name.includes(deptFilter)
      );
    }

    if (hideFinalized) {
      filtered = filtered.filter(item => item.status !== 'finalized');
    }

    setFilteredData(filtered);
  }, [data, deptFilter, hideFinalized]);

  const handleMonthChange = (offset) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'draft': return '下書き';
      case 'submitted': return '提出済み';
      case 'approved': return '承認済み';
      case 'finalized': return '完了';
      case 'remanded': return '差戻し';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-700';
      case 'submitted': return 'bg-blue-200 text-blue-800';
      case 'approved': return 'bg-green-200 text-green-800';
      case 'finalized': return 'bg-purple-200 text-purple-800';
      case 'remanded': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-100';
    }
  };

  const renderProgressBar = (status) => {
     // 進捗バーの定義
     // draft: 25%, submitted: 50%, approved: 75%, finalized: 100%
     // remanded: submittedと同等の位置だが赤色で表示など

     let progress = 0;
     let colorClass = 'bg-gray-300';
     let label = '';

     if (status === 'draft') {
         progress = 25;
         label = '下書き';
     } else if (status === 'submitted') {
         progress = 50;
         colorClass = 'bg-blue-500';
         label = '提出済';
     } else if (status === 'approved') {
         progress = 75;
         colorClass = 'bg-green-500';
         label = '承認済';
     } else if (status === 'finalized') {
         progress = 100;
         colorClass = 'bg-purple-500';
         label = '完了';
     } else if (status === 'remanded') {
         progress = 50; // 提出段階まで戻るイメージ
         colorClass = 'bg-red-500';
         label = '差戻し';
     }

     return (
         <div className="w-full bg-gray-200 rounded-full h-4 dark:bg-gray-700 relative">
             <div className={`${colorClass} h-4 rounded-full`} style={{ width: `${progress}%` }}></div>
             <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white drop-shadow-md">
                 {label}
             </span>
         </div>
     );
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="承認状況表">
      <div className="flex flex-col h-full font-sans text-sm">
        <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold">承認状況表</h2>
                <div className="flex items-center bg-gray-100 rounded p-1">
                    <button onClick={() => handleMonthChange(-1)} className="px-3 py-1 hover:bg-gray-200 rounded">&lt;</button>
                    <span className="mx-3 font-semibold text-lg">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</span>
                    <button onClick={() => handleMonthChange(1)} className="px-3 py-1 hover:bg-gray-200 rounded">&gt;</button>
                </div>
            </div>
            <button onClick={onRequestClose} className="text-gray-500 hover:text-gray-700">✕ 閉じる</button>
        </div>

        <div className="flex gap-4 mb-4 items-center bg-gray-50 p-3 rounded">
            <div className="flex items-center">
                <span className="mr-2 font-bold">部名検索:</span>
                <input
                    type="text"
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                    placeholder="部署名を入力..."
                    className="border p-1 rounded w-48"
                />
            </div>
            <label className="flex items-center cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={hideFinalized}
                    onChange={(e) => setHideFinalized(e.target.checked)}
                    className="mr-2 h-4 w-4"
                />
                <span className="text-gray-700">「完了」分を非表示</span>
            </label>
        </div>

        <div className="flex-grow overflow-auto border rounded">
            {isLoading ? (
                <div className="p-4 text-center">読み込み中...</div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="p-3 border-b font-bold w-20">ID</th>
                            <th className="p-3 border-b font-bold w-1/4">氏名 (部署)</th>
                            <th className="p-3 border-b font-bold w-1/2">進捗状況 (下書き → 提出 → 承認 → 完了)</th>
                            <th className="p-3 border-b font-bold w-1/4">最終更新日 / 備考</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.length === 0 ? (
                             <tr><td colSpan="4" className="p-4 text-center text-gray-500">該当するデータがありません</td></tr>
                        ) : (
                            filteredData.map(item => (
                                <tr key={item.employee_id} className="hover:bg-gray-50">
                                    <td className="p-3 border-b font-bold text-gray-600 text-center">
                                        {item.employee_id}
                                    </td>
                                    <td className="p-3 border-b">
                                        <div className="font-bold text-gray-800">{item.employee_name}</div>
                                        <div className="text-xs text-gray-500">{item.department_name || '-'}</div>
                                    </td>
                                    <td className="p-3 border-b align-middle">
                                        {renderProgressBar(item.status)}
                                    </td>
                                    <td className="p-3 border-b text-xs text-gray-600">
                                        {item.status === 'finalized' && <div>完了日: {item.accounting_approval_date}</div>}
                                        {item.status === 'approved' && <div>承認日: {item.manager_approval_date}</div>}
                                        {item.status === 'submitted' && <div>提出日: {item.submitted_date}</div>}
                                        {item.status === 'remanded' && <div className="text-red-600">理由: {item.remand_reason}</div>}
                                        {item.status === 'draft' && <div className="text-gray-400">未提出</div>}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            )}
        </div>
      </div>
    </Modal>
  );
};

export default ApprovalStatusModal;
