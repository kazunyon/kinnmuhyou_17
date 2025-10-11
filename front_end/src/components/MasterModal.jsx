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
  const [newEmployee, setNewEmployee] = useState({
      company_id: companies.length > 0 ? companies[0].company_id : '',
      employee_name: '',
      department_name: '',
      employee_type: '正社員'
  });

  // 認証とUIの状態管理
  const [isLocked, setIsLocked] = useState(true);
  const [isOwner, setIsOwner] = useState(false); // オーナー権限を持つか
  const [ownerInfo, setOwnerInfo] = useState({ owner_id: '', owner_name: '' });
  const [password, setPassword] = useState('');
  const [authToken, setAuthToken] = useState(null); // 認証トークンを保持するstate
  // 各社員のパスワード変更用の一時的なstate
  const [passwordInputs, setPasswordInputs] = useState({});

  // モーダルが開かれた時にデータを取得する
  useEffect(() => {
    const fetchData = async () => {
      try {
        // オーナー情報を取得
        const ownerRes = await axios.get(`${API_URL}/owner_info`);
        setOwnerInfo(ownerRes.data);

        // 全社員のリストを取得
        const employeesRes = await axios.get(`${API_URL}/employees/all`);
        setEmployees(employeesRes.data);

      } catch (error) {
        console.error("データの取得に失敗しました:", error);
        alert('マスターデータの取得に失敗しました。');
      }
    };

    if (isOpen) {
      fetchData();
    } else {
      // モーダルが閉じる時に状態をリセット
      setIsLocked(true);
      setIsOwner(false);
      setPassword('');
      setAuthToken(null);
      setOwnerInfo({ owner_id: '', owner_name: '' });
      setEmployees([]);
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
    if (!ownerInfo.owner_id || !password) {
      alert('オーナー情報が読み込まれていないか、パスワードが入力されていません。');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/master/authenticate`, {
        employee_id: ownerInfo.owner_id,
        password: password
      });

      if (res.data.success === false) {
        alert(res.data.message || 'IDまたはパスワードが正しくありません。');
        return;
      }

      // master_flagがないユーザーは弾く
      if (res.data.is_master === false) {
        alert('マスターメンテナンスを行う権限がありません。');
        // モーダルを閉じるか、UIをロックしたままにする
        // ここでは何もしない（ユーザーがID/PWを再入力できるようにする）
        return;
      }

      if (res.data.is_owner) {
        alert('オーナーとして認証しました。編集が可能です。');
        setIsOwner(true);
      } else {
        alert('参照権限で認証しました。編集はできません。');
        setIsOwner(false);
      }
      setAuthToken(res.data.token); // トークンをstateに保存
      setIsLocked(false); // 認証後はUIをロック解除（ただしオーナーでないと編集不可）
    } catch (error) {
      console.error("認証処理中にエラーが発生しました:", error);
      const errorMessage = error.response?.data?.message || '認証中にサーバーエラーが発生しました。';
      alert(errorMessage);
    }
  };

  const handleUpdate = async (employee) => {
    if (!authToken) {
      alert('認証トークンがありません。再度認証してください。');
      return;
    }
    const passwordToUpdate = passwordInputs[employee.employee_id] || '';
    const dataToSend = {
      ...employee,
      password: passwordToUpdate,
    };

    try {
      await axios.put(`${API_URL}/employee/${employee.employee_id}`, dataToSend, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      alert('社員情報を更新しました。');
      const res = await axios.get(`${API_URL}/employees`);
      onMasterUpdate(res.data);
      setPasswordInputs(prev => ({...prev, [employee.employee_id]: ''}));
    } catch (error) {
      console.error("更新に失敗しました:", error);
      const errorMessage = error.response?.data?.error || '更新に失敗しました。';
      alert(errorMessage);
    }
  };

  const handleAdd = async () => {
    if (!authToken) {
      alert('認証トークンがありません。再度認証してください。');
      return;
    }
    if(!newEmployee.employee_name || !newEmployee.department_name) {
        alert("氏名と部署名は必須です。");
        return;
    }
    const dataToSend = {
        ...newEmployee,
    };
    try {
        await axios.post(`${API_URL}/employee`, dataToSend, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        alert('新しい社員を追加しました。');
        const res = await axios.get(`${API_URL}/employees/all`);
        setEmployees(res.data);
        const resForParent = await axios.get(`${API_URL}/employees`);
        onMasterUpdate(resForParent.data);
        setNewEmployee({ ...newEmployee, employee_name: '', department_name: '' });
    } catch (error) {
        console.error("追加に失敗しました:", error);
        const errorMessage = error.response?.data?.error || '追加に失敗しました。';
        alert(errorMessage);
    }
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="マスターメンテナンス">
      <h2 className="text-xl font-bold text-center mb-6">マスターメンテナンス</h2>

      {/* --- オーナー情報 & 認証エリア --- */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6 border">
          <h3 className="text-lg font-semibold mb-3">オーナー情報</h3>
          <fieldset disabled={!isLocked} className="flex items-center space-x-4">
              <span className="font-semibold">ID :</span>
              <input
                  type="text"
                  value={ownerInfo.owner_id}
                  disabled
                  className="p-2 border rounded w-20 bg-gray-200"
              />
              <span className="font-semibold">オーナー氏名:</span>
              {/* ドロップダウンに見えるが、実際は選択不可のテキストフィールド */}
              <div className="relative">
                  <input
                      type="text"
                      value={ownerInfo.owner_name}
                      disabled
                      className="p-2 border rounded w-48 bg-gray-200 appearance-none"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
              </div>
              <span className="font-semibold">パスワード:</span>
              <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="p-2 border rounded"
                  placeholder="XXXXXX"
              />
              <button onClick={handleAuthenticate} className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400">
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