import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import axios from 'axios';

const API_URL = 'http://127.0.0.1:5000/api';

const modalStyles = {
  content: {
    top: '50%', left: '50%', right: 'auto', bottom: 'auto',
    marginRight: '-50%', transform: 'translate(-50%, -50%)',
    width: '900px', maxHeight: '90vh', padding: '2rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
};

const MasterModal = ({ isOpen, onRequestClose, employees: initialEmployees, onMasterUpdate }) => {
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({
      employee_name: '', department_name: '', employee_type: '正社員'
  });

  useEffect(() => {
    // モーダルが開かれた時に、propsから受け取った社員リストをステートに設定
    if (isOpen) {
      setEmployees(initialEmployees);
    }
  }, [isOpen, initialEmployees]);

  const handleInputChange = (id, field, value) => {
    const updatedEmployees = employees.map(emp =>
      emp.employee_id === id ? { ...emp, [field]: value } : emp
    );
    setEmployees(updatedEmployees);
  };
  
  const handleNewEmployeeChange = (field, value) => {
      setNewEmployee(prev => ({...prev, [field]: value}));
  };

  const handleUpdate = async (employee) => {
    try {
      await axios.put(`${API_URL}/employee/${employee.employee_id}`, employee);
      alert('社員情報を更新しました。');
      // 親コンポーネントのデータを更新
      const res = await axios.get(`${API_URL}/employees`);
      onMasterUpdate(res.data);
    } catch (error) {
      console.error("更新に失敗しました:", error);
      alert('更新に失敗しました。');
    }
  };

  const handleAdd = async () => {
    if(!newEmployee.employee_name || !newEmployee.department_name) {
        alert("氏名と部署名は必須です。");
        return;
    }
    try {
        await axios.post(`${API_URL}/employee`, newEmployee);
        alert('新しい社員を追加しました。');
        setNewEmployee({ employee_name: '', department_name: '', employee_type: '正社員' });
        // 親コンポーネントのデータを更新
        const res = await axios.get(`${API_URL}/employees`);
        onMasterUpdate(res.data);
        setEmployees(res.data); // このモーダル内のリストも更新
    } catch (error) {
        console.error("追加に失敗しました:", error);
        alert('追加に失敗しました。');
    }
  };


  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="マスターメンテナンス">
      <h2 className="text-xl font-bold text-center mb-6">マスターメンテナンス</h2>
      <div className="overflow-y-auto" style={{maxHeight: '70vh'}}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="p-2 border">社員ID</th>
              <th className="p-2 border">企業名</th>
              <th className="p-2 border">部署名</th>
              <th className="p-2 border">氏名</th>
              <th className="p-2 border">社員区分</th>
              <th className="p-2 border">退職フラグ</th>
              <th className="p-2 border">操作</th>
            </tr>
          </thead>
          <tbody>
            {/* 既存社員の編集フォーム */}
            {employees.map(emp => (
              <tr key={emp.employee_id} className="hover:bg-gray-50">
                <td className="p-2 border">{emp.employee_id}</td>
                <td className="p-2 border">ソフトベンチャー</td>
                <td className="p-2 border">
                  <input type="text" value={emp.department_name} onChange={(e) => handleInputChange(emp.employee_id, 'department_name', e.target.value)} className="w-full p-1 border rounded" />
                </td>
                <td className="p-2 border">
                  <input type="text" value={emp.employee_name} onChange={(e) => handleInputChange(emp.employee_id, 'employee_name', e.target.value)} className="w-full p-1 border rounded" />
                </td>
                <td className="p-2 border">
                   <select value={emp.employee_type} onChange={(e) => handleInputChange(emp.employee_id, 'employee_type', e.target.value)} className="w-full p-1 border rounded">
                        <option value="正社員">正社員</option>
                        <option value="アルバイト">アルバイト</option>
                        <option value="契約社員">契約社員</option>
                   </select>
                </td>
                <td className="p-2 border text-center">
                  <input type="checkbox" checked={!!emp.retirement_flag} onChange={(e) => handleInputChange(emp.employee_id, 'retirement_flag', e.target.checked)} className="h-5 w-5" />
                </td>
                <td className="p-2 border text-center">
                  <button onClick={() => handleUpdate(emp)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">更新</button>
                </td>
              </tr>
            ))}
            {/* 新規社員の追加フォーム */}
            <tr className="bg-green-50">
                <td className="p-2 border">新規</td>
                <td className="p-2 border">ソフトベンチャー</td>
                <td className="p-2 border">
                    <input type="text" value={newEmployee.department_name} onChange={(e) => handleNewEmployeeChange('department_name', e.target.value)} className="w-full p-1 border rounded" placeholder="例：開発部" />
                </td>
                <td className="p-2 border">
                    <input type="text" value={newEmployee.employee_name} onChange={(e) => handleNewEmployeeChange('employee_name', e.target.value)} className="w-full p-1 border rounded" placeholder="例：鈴木　一郎" />
                </td>
                <td className="p-2 border">
                   <select value={newEmployee.employee_type} onChange={(e) => handleNewEmployeeChange('employee_type', e.target.value)} className="w-full p-1 border rounded">
                        <option value="正社員">正社員</option>
                        <option value="アルバイト">アルバイト</option>
                        <option value="契約社員">契約社員</option>
                   </select>
                </td>
                <td className="p-2 border"></td>
                <td className="p-2 border text-center">
                    <button onClick={handleAdd} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">追加</button>
                </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex justify-end mt-6">
        <button onClick={onRequestClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
      </div>
    </Modal>
  );
};

export default MasterModal;
