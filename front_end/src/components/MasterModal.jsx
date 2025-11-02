import { useState, useEffect } from 'react';
import Modal from 'react-modal';
import axios from 'axios';

const API_URL = '/api';

/** @type {object} モーダルのためのカスタムスタイル */
const modalStyles = {
  content: { top: '50%', left: '50%', right: 'auto', bottom: 'auto', marginRight: '-50%', transform: 'translate(-50%, -50%)', width: '1000px', maxHeight: '90vh', padding: '2rem' },
  overlay: { backgroundColor: 'rgba(0, 0, 0, 0.75)' },
};

Modal.setAppElement('#root');

/**
 * 社員情報のマスターメンテナンスを行うモーダルコンポーネント。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているか。
 * @param {Function} props.onRequestClose - モーダルを閉じる関数。
 * @param {Function} props.onMasterUpdate - 社員情報更新時に親に通知する関数。
 * @param {Function} props.onSelectEmployee - 社員参照時に親に通知する関数。
 * @param {number} props.selectedEmployeeId - 現在選択中の社員ID。
 * @param {object[]} props.companies - 会社リスト。
 * @param {object} props.auth - 親コンポーネントの認証状態。
 * @param {Function} props.setAuth - 親の認証状態を更新する関数。
 * @param {number} props.ownerId - オーナーのID。
 * @param {string} props.ownerName - オーナーの名前。
 * @returns {JSX.Element} レンダリングされたマスターメンテナンスモーダル。
 */
const MasterModal = ({ isOpen, onRequestClose, onMasterUpdate, onSelectEmployee, selectedEmployeeId, companies, auth, setAuth, ownerId, ownerName }) => {
  /** @type {[object[], Function]} 全社員リスト */
  const [employees, setEmployees] = useState([]);
  /** @type {[object, Function]} 新規追加社員の入力データ */
  const [newEmployee, setNewEmployee] = useState({ company_id: companies[0]?.company_id || '', employee_name: '', department_name: '', employee_type: '正社員' });
  /** @type {[string, Function]} パスワード入力フィールド */
  const [passwordInput, setPasswordInput] = useState('');

  /**
   * 副作用フック: モーダルの開閉に応じて社員データを取得・初期化します。
   */
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axios.get(`${API_URL}/employees/all`);
        setEmployees(res.data);
      } catch (error) {
        console.error("社員データの取得に失敗しました:", error);
      }
    };
    if (isOpen) {
      fetchEmployees();
    } else {
      setPasswordInput('');
      setEmployees([]);
      setNewEmployee({ company_id: companies[0]?.company_id || '', employee_name: '', department_name: '', employee_type: '正社員' });
    }
  }, [isOpen, companies]);

  /**
   * 社員リストの入力フィールド変更ハンドラ。
   * @param {number} id - 対象の社員ID。
   * @param {string} field - 変更されたフィールド名。
   * @param {string|boolean} value - 新しい値。
   */
  const handleInputChange = (id, field, value) => {
    const updated = employees.map(emp => emp.employee_id === id ? { ...emp, [field]: value } : emp);
    setEmployees(updated);
  };
  
  /**
   * 新規社員フォームの入力変更ハンドラ。
   * @param {string} field - 変更されたフィールド名。
   * @param {string} value - 新しい値。
   */
  const handleNewEmployeeChange = (field, value) => {
    setNewEmployee(prev => ({ ...prev, [field]: value }));
  };

  /**
   * オーナー認証を実行します。
   */
  const handleAuthenticate = async () => {
    try {
      const res = await axios.post(`${API_URL}/master/authenticate`, { employee_id: ownerId, password: passwordInput });
      if (res.data.success) {
        setAuth({ isAuthenticated: true, isOwner: res.data.is_owner, password: passwordInput, timestamp: Date.now() });
        alert(res.data.is_owner ? 'オーナーとして認証しました。' : '認証しました。');
        setPasswordInput('');
      } else {
        alert(res.data.message);
      }
    } catch (error) {
      alert(error.response?.data?.message || '認証エラー');
      setAuth({ isAuthenticated: false, isOwner: false, password: '', timestamp: null });
    }
  };

  /**
   * 社員情報を更新します。
   * @param {object} employee - 更新対象の社員オブジェクト。
   */
  const handleUpdate = async (employee) => {
    if (!auth.isOwner) return alert('オーナー権限が必要です。');
    try {
      await axios.put(`${API_URL}/employee/${employee.employee_id}`, { ...employee, owner_id: ownerId, owner_password: auth.password });
      alert('社員情報を更新しました。');
      const res = await axios.get(`${API_URL}/employees`);
      onMasterUpdate(res.data);
    } catch (error) {
      alert(error.response?.data?.error || '更新に失敗しました。');
    }
  };

  /**
   * 新規社員を追加します。
   */
  const handleAdd = async () => {
    if (!auth.isOwner) return alert('オーナー権限が必要です。');
    if(!newEmployee.employee_name || !newEmployee.department_name) return alert("氏名と部署名は必須です。");
    try {
      await axios.post(`${API_URL}/employee`, { ...newEmployee, owner_id: ownerId, owner_password: auth.password });
      alert('新しい社員を追加しました。');
      const [allEmpsRes, activeEmpsRes] = await Promise.all([axios.get(`${API_URL}/employees/all`), axios.get(`${API_URL}/employees`)]);
      setEmployees(allEmpsRes.data);
      onMasterUpdate(activeEmpsRes.data);
      setNewEmployee({ ...newEmployee, employee_name: '', department_name: '' });
    } catch (error) {
      alert(error.response?.data?.error || '追加に失敗しました。');
    }
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="マスターメンテナンス">
      <h2 className="text-xl font-bold text-center mb-6">マスターメンテナンス</h2>
      <div className="bg-gray-100 p-4 rounded-lg mb-6 border">
        <h3 className="text-lg font-semibold mb-3">オーナー情報</h3>
        <div className="flex items-center space-x-4">
          <fieldset disabled={auth.isAuthenticated} className="flex items-center space-x-4">
            <span className="font-semibold">ID:</span> <input type="text" value={ownerId || ''} disabled className="p-2 border rounded w-20 bg-gray-200" />
            <span className="font-semibold">オーナー氏名:</span> <input type="text" value={ownerName || ''} disabled className="p-2 border rounded w-48 bg-gray-200" />
          </fieldset>
          <span className="font-semibold">パスワード:</span>
          <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="p-2 border rounded" />
          <button onClick={handleAuthenticate} className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">認証</button>
        </div>
      </div>

      <div className={!auth.isAuthenticated ? 'opacity-50 pointer-events-none' : ''}>
        <div className="overflow-y-auto" style={{maxHeight: '60vh'}}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="p-2 border">社員ID</th><th className="p-2 border">企業名</th><th className="p-2 border">部署名</th>
                <th className="p-2 border">氏名</th><th className="p-2 border">社員区分</th><th className="p-2 border">退職</th>
                <th className="p-2 border">参照</th><th className="p-2 border">操作</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const companyName = companies.find(c => c.company_id === emp.company_id)?.company_name || 'N/A';
                const canUpdate = auth.isOwner && emp.employee_id === ownerId;
                return (
                  <tr key={emp.employee_id} className={`hover:bg-gray-50 ${!canUpdate ? 'bg-gray-100' : ''} ${selectedEmployeeId === emp.employee_id ? 'bg-blue-100' : ''}`} onClick={() => onSelectEmployee(emp.employee_id)}>
                    <td className="p-2 border">{emp.employee_id}</td>
                    <td className="p-2 border">{companyName}</td>
                    <td className="p-2 border" onClick={e => e.stopPropagation()}><input type="text" value={emp.department_name || ''} onChange={(e) => handleInputChange(emp.employee_id, 'department_name', e.target.value)} className="w-full p-1 border rounded" disabled={!canUpdate} /></td>
                    <td className="p-2 border" onClick={e => e.stopPropagation()}><input type="text" value={emp.employee_name} onChange={(e) => handleInputChange(emp.employee_id, 'employee_name', e.target.value)} className="w-full p-1 border rounded" disabled={!canUpdate} /></td>
                    <td className="p-2 border" onClick={e => e.stopPropagation()}><select value={emp.employee_type} onChange={(e) => handleInputChange(emp.employee_id, 'employee_type', e.target.value)} className="w-full p-1 border rounded" disabled={!canUpdate}><option value="正社員">正社員</option><option value="アルバイト">アルバイト</option><option value="契約社員">契約社員</option></select></td>
                    <td className="p-2 border text-center" onClick={e => e.stopPropagation()}><input type="checkbox" checked={!!emp.retirement_flag} onChange={(e) => handleInputChange(emp.employee_id, 'retirement_flag', e.target.checked)} className="h-5 w-5" disabled={!canUpdate} /></td>
                    <td className="p-2 border text-center font-semibold text-teal-600">{selectedEmployeeId === emp.employee_id ? '参照中' : ''}</td>
                    <td className="p-2 border text-center"><button onClick={(e) => { e.stopPropagation(); handleUpdate(emp); }} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:bg-gray-400" disabled={!canUpdate}>更新</button></td>
                  </tr>
                )
              })}
              <tr className="bg-green-50">
                <td className="p-2 border">新規</td>
                <td className="p-2 border"><select value={newEmployee.company_id} onChange={(e) => handleNewEmployeeChange('company_id', parseInt(e.target.value, 10))} className="w-full p-1 border rounded" disabled={!auth.isOwner}>{companies.map(c => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}</select></td>
                <td className="p-2 border"><input type="text" value={newEmployee.department_name} onChange={(e) => handleNewEmployeeChange('department_name', e.target.value)} className="w-full p-1 border rounded" placeholder="例：開発部" disabled={!auth.isOwner} /></td>
                <td className="p-2 border"><input type="text" value={newEmployee.employee_name} onChange={(e) => handleNewEmployeeChange('employee_name', e.target.value)} className="w-full p-1 border rounded" placeholder="例：鈴木　一郎" disabled={!auth.isOwner} /></td>
                <td className="p-2 border"><select value={newEmployee.employee_type} onChange={(e) => handleNewEmployeeChange('employee_type', e.target.value)} className="w-full p-1 border rounded" disabled={!auth.isOwner}><option value="正社員">正社員</option><option value="アルバイト">アルバイト</option><option value="契約社員">契約社員</option></select></td>
                <td className="p-2 border" colSpan="2"></td>
                <td className="p-2 border text-center"><button onClick={handleAdd} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600" disabled={!auth.isOwner}>追加</button></td>
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

export default MasterModal;
