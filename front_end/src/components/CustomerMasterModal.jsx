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

const CustomerMasterModal = ({ isOpen, onRequestClose, auth }) => {
  const [customers, setCustomers] = useState([]);
  const [newCustomerName, setNewCustomerName] = useState('');

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_URL}/customers`);
      setCustomers(res.data);
    } catch (error) {
      console.error("取引先データの取得に失敗しました:", error);
      alert('取引先データの取得に失敗しました。');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
    }
  }, [isOpen]);

  const handleInputChange = (id, value) => {
    const updatedCustomers = customers.map(c =>
      c.customer_id === id ? { ...c, customer_name: value } : c
    );
    setCustomers(updatedCustomers);
  };

  const handleUpdate = async (customer) => {
    if (!customer.customer_name) {
      alert('取引先名は必須です。');
      return;
    }
    try {
      await axios.put(`${API_URL}/customers/${customer.customer_id}`, { customer_name: customer.customer_name });
      alert('取引先情報を更新しました。');
      fetchCustomers();
    } catch (error) {
      console.error("更新に失敗しました:", error);
      alert(error.response?.data?.error || '更新に失敗しました。');
    }
  };

  const handleAdd = async () => {
    if (!newCustomerName) {
      alert('取引先名は必須です。');
      return;
    }
    try {
      await axios.post(`${API_URL}/customers`, { customer_name: newCustomerName });
      alert('新しい取引先を追加しました。');
      setNewCustomerName('');
      fetchCustomers();
    } catch (error) {
      console.error("追加に失敗しました:", error);
      alert(error.response?.data?.error || '追加に失敗しました。');
    }
  };

  const handleDelete = async (customerId) => {
    if (window.confirm('この取引先を削除してもよろしいですか？関連する案件も削除されます。')) {
      try {
        await axios.delete(`${API_URL}/customers/${customerId}`);
        alert('取引先を削除しました。');
        fetchCustomers();
      } catch (error) {
        console.error("削除に失敗しました:", error);
        alert(error.response?.data?.error || '削除に失敗しました。');
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="取引先マスターメンテナンス">
      <h2 className="text-xl font-bold text-center mb-6">取引先マスターメンテナンス</h2>

      <div className={!auth.isOwner ? 'opacity-50 pointer-events-none' : ''}>
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="p-2 border w-24">ID</th>
                <th className="p-2 border">取引先名</th>
                <th className="p-2 border w-48">操作</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.customer_id} className="hover:bg-gray-50">
                  <td className="p-2 border">{c.customer_id}</td>
                  <td className="p-2 border">
                    <input
                      type="text"
                      value={c.customer_name}
                      onChange={(e) => handleInputChange(c.customer_id, e.target.value)}
                      className="w-full p-1 border rounded"
                    />
                  </td>
                  <td className="p-2 border text-center space-x-2">
                    <button onClick={() => handleUpdate(c)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">更新</button>
                    <button onClick={() => handleDelete(c.customer_id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">削除</button>
                  </td>
                </tr>
              ))}
              <tr className="bg-green-50">
                <td className="p-2 border">新規</td>
                <td className="p-2 border">
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    className="w-full p-1 border rounded"
                    placeholder="新しい取引先名"
                  />
                </td>
                <td className="p-2 border text-center">
                  <button onClick={handleAdd} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">追加</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button onClick={onRequestClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
      </div>
    </Modal>
  );
};

export default CustomerMasterModal;
