import { useState, useEffect } from 'react';
import Modal from 'react-modal';
import axios from 'axios';

// APIのベースURLを相対パスに変更
const API_URL = '/api';

const modalStyles = {
  content: {
    top: '50%', left: '50%', right: 'auto', bottom: 'auto',
    marginRight: '-50%', transform: 'translate(-50%, -50%)',
    width: '1000px', // 横幅を少し広げる
    maxHeight: '90vh', padding: '2rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
};

// Modalのルート要素を設定
Modal.setAppElement('#root');

const MasterModal = ({ isOpen, onRequestClose, onMasterUpdate, companies }) => {
  const [employees, setEmployees] = useState([]);
  const [masterUsers, setMasterUsers] = useState([]);
  const [newEmployee, setNewEmployee] = useState({
      company_id: companies.length > 0 ? companies[0].company_id : '',
      employee_name: '',
      department_name: '',
      employee_type: '正社員'
  });

  // 認証とUIの状態管理
  const [isLocked, setIsLocked] = useState(true);
  const [isOwner, setIsOwner] = useState(false); // オーナー権限を持つか
  const [selectedMasterId, setSelectedMasterId] = useState('');
  const [password, setPassword] = useState('');
  // 各社員のパスワード変更用の一時的なstate
  const [passwordInputs, setPasswordInputs] = useState({});

  // モーダルが開かれた時にデータを取得する
  useEffect(() => {
    const fetchAllEmployees = async () => {
      try {
        const res = await axios.get(`${API_URL}/employees/all`);
        const allEmps = res.data;
        setEmployees(allEmps);

        // マスター権限を持つユーザーを抽出
        const masters = allEmps.filter(emp => emp.master_flag);
        setMasterUsers(masters);

        // マスターユーザーがいれば、選択肢のデフォルト値を設定
        if (masters.length > 0) {
          setSelectedMasterId(masters[0].employee_id);
        }
      } catch (error) {
        console.error("社員データの取得に失敗しました:", error);
        alert('社員データの取得に失敗しました。');
      }
    };

    if (isOpen) {
      fetchAllEmployees();
    } else {
      // モーダルが閉じる時に状態をリセット
      setIsLocked(true);
      setIsOwner(false);
      setPassword('');
      setSelectedMasterId('');
      setEmployees([]);
      setMasterUsers([]);
      setPasswordInputs({});
      setNewEmployee({
        company_id: companies.length > 0 ? companies[0].company_id : '',
        employee_name: '',
        department_name: '',
        employee_type: '正社員'
      });
    }
  }, [isOpen, companies]);

  const handleInputChange = (id, field, value) => {
    // チェックボックスの場合はboolean値に変換
    const val = field === 'retirement_flag' || field === 'master_flag' ? !!value : value;
    const updatedEmployees = employees.map(emp =>
      emp.employee_id === id ? { ...emp, [field]: val } : emp
    );
    setEmployees(updatedEmployees);
  };
  
  const handlePasswordInputChange = (id, value) => {
    setPasswordInputs(prev => ({...prev, [id]: value}));
  };

  const handleNewEmployeeChange = (field, value) => {
      setNewEmployee(prev => ({...prev, [field]: value}));
  };

  // 認証処理
  const handleAuthenticate = async () => {
    if (!selectedMasterId || !password) {
      alert('マスターユーザーを選択し、パスワードを入力してください。');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/master/authenticate`, {
        employee_id: selectedMasterId,
        password: password
      });

      if (res.data.is_owner) {
        alert('オーナーとして認証しました。編集が可能です。');
        setIsOwner(true);
      } else {
        alert('参照権限で認証しました。編集はできません。');
        setIsOwner(false);
      }
      setIsLocked(false); // 認証後は認証エリアをロック
    } catch (error) {
      console.error("認証に失敗しました:", error);
      alert('認証に失敗しました。パスワードが正しいか確認してください。');
    }
  };

  const handleUpdate = async (employee) => {
    const passwordToUpdate = passwordInputs[employee.employee_id] || '';
    const dataToSend = {
      ...employee,
      password: passwordToUpdate, // パスワードが空でもAPI側で処理される
      owner_id: parseInt(selectedMasterId, 10) // オーナーとして認証したIDを送る
    };

    try {
      await axios.put(`${API_URL}/employee/${employee.employee_id}`, dataToSend);
      alert('社員情報を更新しました。');
      // 親コンポーネントのドロップダウンリストを更新
      const res = await axios.get(`${API_URL}/employees`);
      onMasterUpdate(res.data);
      // パスワード入力フィールドをクリア
      setPasswordInputs(prev => ({...prev, [employee.employee_id]: ''}));
    } catch (error) {
      console.error("更新に失敗しました:", error);
      const errorMessage = error.response?.data?.error || '更新に失敗しました。';
      alert(errorMessage);
    }
  };

  const handleAdd = async () => {
    if(!newEmployee.employee_name || !newEmployee.department_name) {
        alert("氏名と部署名は必須です。");
        return;
    }
    const dataToSend = {
        ...newEmployee,
        owner_id: parseInt(selectedMasterId, 10) // オーナーとして認証したIDを送る
    };
    try {
        await axios.post(`${API_URL}/employee`, dataToSend);
        alert('新しい社員を追加しました。');
        // リストを再取得してモーダル内を更新
        const res = await axios.get(`${API_URL}/employees/all`);
        setEmployees(res.data);
        // 親コンポーネントのドロップダウンリストも更新
        const resForParent = await axios.get(`${API_URL}/employees`);
        onMasterUpdate(resForParent.data);
        // 新規入力フォームをリセット
        setNewEmployee({ employee_name: '', department_name: '', employee_type: '正社員' });
    } catch (error) {
        console.error("追加に失敗しました:", error);
        const errorMessage = error.response?.data?.error || '追加に失敗しました。';
        alert(errorMessage);
    }
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="マスターメンテナンス">
      <h2 className="text-xl font-bold text-center mb-6">マスターメンテナンス</h2>

      {/* --- 認証エリア --- */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6 border">
        <fieldset disabled={!isLocked} className="flex items-center space-x-4">
          <label className="font-semibold">ID :</label>
          <input
            type="text"
            value={selectedMasterId}
            disabled
            className="p-2 border rounded bg-gray-200 w-16 text-center"
          />
          <label htmlFor="master-user-select" className="font-semibold">オーナー:</label>
          <select
            id="master-user-select"
            value={selectedMasterId}
            onChange={(e) => setSelectedMasterId(e.target.value)}
            className="p-2 border rounded"
          >
            {masterUsers.map(user => (
              <option key={user.employee_id} value={user.employee_id}>{user.employee_name}</option>
            ))}
          </select>
          <label htmlFor="master-password-input" className="font-semibold">パスワード:</label>
          <input
            id="master-password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 border rounded"
            placeholder="XXXXXX"
          />
          <button onClick={handleAuthenticate} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400">
            認証
          </button>
        </fieldset>
      </div>

      {/* --- 社員情報エリア --- */}
      <fieldset disabled={isLocked || !isOwner} className="disabled:opacity-50">
        <div className="overflow-y-auto" style={{maxHeight: '60vh'}}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="p-2 border">社員ID</th>
                <th className="p-2 border">企業名</th>
                <th className="p-2 border">部署名</th>
                <th className="p-2 border">氏名</th>
                <th className="p-2 border">社員区分</th>
                <th className="p-2 border">退職フラグ</th>
                <th className="p-2 border">マスター</th>
                <th className="p-2 border">パスワード</th>
                <th className="p-2 border">操作</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const companyName = companies.find(c => c.company_id === emp.company_id)?.company_name || 'N/A';
                return (
                  <tr key={emp.employee_id} className="hover:bg-gray-50">
                    <td className="p-2 border">{emp.employee_id}</td>
                    <td className="p-2 border">{companyName}</td>
                    <td className="p-2 border">
                      <input type="text" value={emp.department_name || ''} onChange={(e) => handleInputChange(emp.employee_id, 'department_name', e.target.value)} className="w-full p-1 border rounded" />
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
                      <input type="checkbox" checked={!!emp.master_flag} onChange={(e) => handleInputChange(emp.employee_id, 'master_flag', e.target.checked)} className="h-5 w-5" />
                    </td>
                    <td className="p-2 border">
                       <input type="text" value={passwordInputs[emp.employee_id] || ''} onChange={(e) => handlePasswordInputChange(emp.employee_id, e.target.value)} className="w-full p-1 border rounded" placeholder="変更時のみ入力" />
                    </td>
                    <td className="p-2 border text-center">
                      <button onClick={() => handleUpdate(emp)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">更新</button>
                    </td>
                  </tr>
                )
              })}
              {/* 新規社員の追加フォーム */}
              <tr className="bg-green-50">
                  <td className="p-2 border">新規</td>
                  <td className="p-2 border">
                    <select value={newEmployee.company_id} onChange={(e) => handleNewEmployeeChange('company_id', parseInt(e.target.value, 10))} className="w-full p-1 border rounded">
                      {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                    </select>
                  </td>
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
                  <td className="p-2 border"></td>
                  <td className="p-2 border"></td>
                  <td className="p-2 border text-center">
                      <button onClick={handleAdd} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">追加</button>
                  </td>
              </tr>
            </tbody>
          </table>
        </div>
      </fieldset>

      <div className="flex justify-end mt-6">
        <button onClick={onRequestClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
      </div>
    </Modal>
  );
};

export default MasterModal;