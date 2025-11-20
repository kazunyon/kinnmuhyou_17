import { useState, useEffect } from 'react';
import Modal from 'react-modal';
import axios from 'axios';

const API_URL = '/api';

const modalStyles = {
  content: {
    top: '50%', left: '50%', right: 'auto', bottom: 'auto',
    marginRight: '-50%', transform: 'translate(-50%, -50%)',
    width: '800px',
    maxHeight: '90vh', padding: '2rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
};

Modal.setAppElement('#root');

const MonthlySummaryModal = ({ isOpen, onRequestClose, employeeId, year, month }) => {
  const [summaryData, setSummaryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!isOpen || !employeeId) return;
      setIsLoading(true);
      try {
        const res = await axios.get(`${API_URL}/monthly_summary/${employeeId}/${year}/${month}`);

        // データを取引先でグループ化
        const groupedData = res.data.reduce((acc, current) => {
          const { customer_id, customer_name, ...projectData } = current;
          if (!acc[customer_id]) {
            acc[customer_id] = {
              customer_id,
              customer_name,
              projects: [],
              customer_total_time: 0
            };
          }
          acc[customer_id].projects.push(projectData);
          acc[customer_id].customer_total_time += projectData.total_work_time;
          return acc;
        }, {});

        setSummaryData(Object.values(groupedData));
      } catch (error) {
        console.error("月次集計データの取得に失敗しました:", error);
        alert('月次集計データの取得に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummary();
  }, [isOpen, employeeId, year, month]);

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="月次集計">
      <h2 className="text-xl font-bold text-center mb-6">{year}年{month}月 月次集計</h2>

      <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
        {isLoading ? (
          <p>読み込み中...</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="p-2 border">取引先 / 案件</th>
                <th className="p-2 border w-32 text-right">合計時間 (h)</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.length === 0 ? (
                <tr>
                  <td colSpan="2" className="p-4 text-center text-gray-500">この月の作業実績はありません。</td>
                </tr>
              ) : (
                summaryData.map(customer => (
                  <>
                    <tr key={customer.customer_id} className="bg-gray-100 font-bold">
                      <td className="p-2 border">{customer.customer_name}</td>
                      <td className="p-2 border text-right">{customer.customer_total_time.toFixed(2)}</td>
                    </tr>
                    {customer.projects.map(project => (
                      <tr key={project.project_id}>
                        <td className="p-2 border pl-8">{project.project_name}</td>
                        <td className="p-2 border text-right">{project.total_work_time.toFixed(2)}</td>
                      </tr>
                    ))}
                  </>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex justify-end mt-6">
        <button onClick={onRequestClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
      </div>
    </Modal>
  );
};

export default MonthlySummaryModal;
