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
    width: '1000px',
    maxHeight: '90vh', padding: '2rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
};

// アプリケーションのルート要素をモーダルライブラリに設定
Modal.setAppElement('#root');

/**
 * 社員情報のマスターメンテナンスを行うモーダルコンポーネント。
 * オーナー認証、全社員リストの表示・更新、新規社員の追加機能を提供します。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているか。
 * @param {Function} props.onRequestClose - モーダルを閉じる関数。
 * @param {Function} props.onMasterUpdate - 社員情報が更新されたことを親に通知する関数。
 * @param {Function} props.onSelectEmployee - 社員が「参照」されたことを親に通知する関数。
 * @param {Array<object>} props.companies - 会社リスト。
 * @param {object} props.auth - 親コンポーネントで管理される認証状態。
 * @param {Function} props.setAuth - 親の認証状態を更新する関数。
 * @returns {JSX.Element} レンダリングされたマスターメンテナンスモーダル。
 */
const MasterModal = ({ isOpen, onRequestClose, onMasterUpdate, onSelectEmployee, selectedEmployeeId, companies, auth, setAuth, ownerId, ownerName }) => {
  // --- 状態管理 ---
  const [activeTab, setActiveTab] = useState('employees'); // 'employees', 'clients', 'projects'

  // 社員用
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({
      company_id: companies.length > 0 ? companies[0].company_id : '',
      employee_name: '', department_name: '', employee_type: '正社員'
  });
  const [passwordInput, setPasswordInput] = useState('');

  // 取引先用
  const [clients, setClients] = useState([]);
  const [newClientName, setNewClientName] = useState('');

  // 案件用
  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState({ client_id: '', project_name: '' });

  // --- データフェッチング ---
  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/employees/all`);
      setEmployees(res.data);
    } catch (error) {
      console.error("社員データの取得に失敗しました:", error);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API_URL}/clients`);
      setClients(res.data);
      // 新規案件のデフォルトクライアントID設定
      if (res.data.length > 0 && !newProject.client_id) {
        setNewProject(prev => ({ ...prev, client_id: res.data[0].client_id }));
      }
    } catch (error) {
      console.error("取引先データの取得に失敗しました:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API_URL}/projects`);
      setProjects(res.data);
    } catch (error) {
      console.error("案件データの取得に失敗しました:", error);
    }
  };

  /**
   * モーダルが開いたときにデータをフェッチし、閉じたときに状態をクリーンアップします。
   */
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'employees') fetchEmployees();
      if (activeTab === 'clients') fetchClients();
      if (activeTab === 'projects') { fetchClients(); fetchProjects(); }
    } else {
      // リセット
      setPasswordInput('');
      setEmployees([]);
      setClients([]);
      setProjects([]);
      setNewClientName('');
      setNewEmployee({
        company_id: companies.length > 0 ? companies[0].company_id : '',
        employee_name: '', department_name: '', employee_type: '正社員'
      });
    }
  }, [isOpen, activeTab, companies]);


  // --- イベントハンドラ: 社員 ---
  /**
   * 社員リストの入力フィールドの変更をハンドリングします。
   * @param {number} id - 対象の社員ID。
   * @param {string} field - 変更されたフィールド名。
   * @param {string|boolean} value - 新しい値。
   */
  const handleInputChange = (id, field, value) => {
    const val = field === 'retirement_flag' ? !!value : value;
    const updatedEmployees = employees.map(emp =>
      emp.employee_id === id ? { ...emp, [field]: val } : emp
    );
    setEmployees(updatedEmployees);
  };
  
  /**
   * 新規社員フォームの入力変更をハンドリングします。
   * @param {string} field - 変更されたフィールド名。
   * @param {string} value - 新しい値。
   */
  const handleNewEmployeeChange = (field, value) => {
      setNewEmployee(prev => ({...prev, [field]: value}));
  };

  /**
   * オーナー認証を実行します。
   * @async
   */
  const handleAuthenticate = async () => {
    if (!ownerId || !passwordInput) {
      alert('オーナー情報が読み込まれていないか、パスワードが入力されていません。');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/master/authenticate`, {
        employee_id: ownerId,
        password: passwordInput
      });

      if (!res.data.success) {
        alert(res.data.message || '認証に失敗しました。');
        return;
      }

      setAuth({
        isAuthenticated: true,
        isOwner: res.data.is_owner,
        password: passwordInput,
        timestamp: new Date().getTime(),
      });

      alert(res.data.is_owner ? 'オーナーとして認証しました。編集が可能です。' : '認証しました。参照のみ可能です。');
      setPasswordInput('');
    } catch (error) {
      console.error("認証処理中にエラーが発生しました:", error);
      alert(error.response?.data?.message || '認証中にサーバーエラーが発生しました。');
      setAuth({ isAuthenticated: false, isOwner: false, password: '', timestamp: null });
    }
  };

  /**
   * 社員情報の更新をサーバーに送信します。オーナー権限が必要です。
   * @param {object} employee - 更新対象の社員オブジェクト。
   * @async
   */
  const handleUpdate = async (employee) => {
    if (!auth.isOwner) {
      alert('オーナー権限がないため更新できません。');
      return;
    }
    const dataToSend = {
      ...employee,
      owner_id: ownerId,
      owner_password: auth.password,
    };
    delete dataToSend.password;
    delete dataToSend.master_flag;

    try {
      await axios.put(`${API_URL}/employee/${employee.employee_id}`, dataToSend);
      alert('社員情報を更新しました。');
      const res = await axios.get(`${API_URL}/employees`);
      onMasterUpdate(res.data);
    } catch (error) {
      console.error("更新に失敗しました:", error);
      alert(error.response?.data?.error || '更新に失敗しました。');
    }
  };

  /**
   * 新規社員の情報をサーバーに送信します。オーナー権限が必要です。
   * @async
   */
  const handleAdd = async () => {
    if (!auth.isOwner) {
      alert('オーナー権限がないため追加できません。');
      return;
    }
    if(!newEmployee.employee_name || !newEmployee.department_name) {
        alert("氏名と部署名は必須です。");
        return;
    }
    const dataToSend = {
        ...newEmployee,
        owner_id: ownerId,
        owner_password: auth.password,
    };
    try {
        await axios.post(`${API_URL}/employee`, dataToSend);
        alert('新しい社員を追加しました。');
        const res = await axios.get(`${API_URL}/employees/all`);
        setEmployees(res.data);
        const resForParent = await axios.get(`${API_URL}/employees`);
        onMasterUpdate(resForParent.data);
        setNewEmployee({ ...newEmployee, employee_name: '', department_name: '' });
    } catch (error) {
        console.error("追加に失敗しました:", error);
        alert(error.response?.data?.error || '追加に失敗しました。');
    }
  };

  // --- イベントハンドラ: 取引先 ---
  const handleClientUpdate = async (client) => {
    if (!client.client_name) return alert("取引先名は必須です");
    try {
      await axios.put(`${API_URL}/clients/${client.client_id}`, { client_name: client.client_name });
      alert("取引先を更新しました");
      fetchClients();
    } catch (error) {
      console.error("更新エラー:", error);
      alert("更新に失敗しました");
    }
  };

  const handleClientDelete = async (clientId) => {
    if (!window.confirm("本当に削除しますか？")) return;
    try {
      await axios.delete(`${API_URL}/clients/${clientId}`);
      alert("取引先を削除しました");
      fetchClients();
    } catch (error) {
      console.error("削除エラー:", error);
      alert(error.response?.data?.error || "削除に失敗しました");
    }
  };

  const handleClientAdd = async () => {
    if (!newClientName) return alert("取引先名は必須です");
    try {
      await axios.post(`${API_URL}/clients`, { client_name: newClientName });
      alert("取引先を追加しました");
      setNewClientName("");
      fetchClients();
    } catch (error) {
      console.error("追加エラー:", error);
      alert("追加に失敗しました");
    }
  };

  // --- イベントハンドラ: 案件 ---
  const handleProjectUpdate = async (project) => {
    if (!project.project_name || !project.client_id) return alert("必須項目が不足しています");
    try {
      await axios.put(`${API_URL}/projects/${project.project_id}`, {
        client_id: project.client_id,
        project_name: project.project_name
      });
      alert("案件を更新しました");
      fetchProjects();
    } catch (error) {
      console.error("更新エラー:", error);
      alert("更新に失敗しました");
    }
  };

  const handleProjectDelete = async (projectId) => {
    if (!window.confirm("本当に削除しますか？")) return;
    try {
      await axios.delete(`${API_URL}/projects/${projectId}`);
      alert("案件を削除しました");
      fetchProjects();
    } catch (error) {
      console.error("削除エラー:", error);
      alert(error.response?.data?.error || "削除に失敗しました");
    }
  };

  const handleProjectAdd = async () => {
    if (!newProject.project_name || !newProject.client_id) return alert("必須項目が不足しています");
    try {
      await axios.post(`${API_URL}/projects`, newProject);
      alert("案件を追加しました");
      setNewProject(prev => ({ ...prev, project_name: "" })); // client_idはそのまま
      fetchProjects();
    } catch (error) {
      console.error("追加エラー:", error);
      alert("追加に失敗しました");
    }
  };


  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="マスターメンテナンス">
      <h2 className="text-xl font-bold text-center mb-6">マスターメンテナンス</h2>

      {/* --- タブ切り替え --- */}
      <div className="flex space-x-4 mb-6 border-b">
        <button
          className={`py-2 px-4 ${activeTab === 'employees' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('employees')}>
          社員マスタ
        </button>
        <button
          className={`py-2 px-4 ${activeTab === 'clients' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('clients')}>
          取引先マスタ
        </button>
        <button
          className={`py-2 px-4 ${activeTab === 'projects' ? 'border-b-2 border-blue-500 font-bold' : ''}`}
          onClick={() => setActiveTab('projects')}>
          案件マスタ
        </button>
      </div>

      {activeTab === 'employees' && (
        <>
        {/* --- オーナー情報 & 認証エリア (社員タブのみ) --- */}
        <div className="bg-gray-100 p-4 rounded-lg mb-6 border">
            <h3 className="text-lg font-semibold mb-3">オーナー情報</h3>
            <div className="flex items-center space-x-4">
                <fieldset disabled={auth.isAuthenticated} className="flex items-center space-x-4">
                    <span className="font-semibold">ID :</span>
                    <input type="text" value={ownerId || ''} disabled className="p-2 border rounded w-20 bg-gray-200" />
                    <span className="font-semibold">オーナー氏名:</span>
                    <input type="text" value={ownerName || ''} disabled className="p-2 border rounded w-48 bg-gray-200" />
                </fieldset>
                <span className="font-semibold">パスワード:</span>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="p-2 border rounded" placeholder="XXXXXX" />
                <button onClick={handleAuthenticate} className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600">認証</button>
            </div>
        </div>

        {/* --- 社員情報エリア --- */}
        <div className={!auth.isAuthenticated ? 'opacity-50 pointer-events-none' : ''}>
            <div className="overflow-y-auto" style={{maxHeight: '50vh'}}>
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-200 sticky top-0">
                <tr>
                    <th className="p-2 border">社員ID</th><th className="p-2 border">企業名</th>
                    <th className="p-2 border">部署名</th><th className="p-2 border">氏名</th>
                    <th className="p-2 border">社員区分</th><th className="p-2 border">退職</th>
                    <th className="p-2 border">参照</th>
                    <th className="p-2 border">操作</th>
                </tr>
                </thead>
                <tbody>
                {employees.map(emp => {
                    const companyName = companies.find(c => c.company_id === emp.company_id)?.company_name || 'N/A';

                    // 更新権限のロジック
                    const canUpdate = auth.isOwner && emp.employee_id === ownerId;

                    return (
                    <tr key={emp.employee_id}
                        className={`hover:bg-gray-50 cursor-pointer ${!canUpdate ? 'bg-gray-100' : ''} ${selectedEmployeeId === emp.employee_id ? 'bg-blue-100' : ''}`}
                        onClick={() => onSelectEmployee(emp.employee_id)}>
                        <td className="p-2 border">{emp.employee_id}</td>
                        <td className="p-2 border">{companyName}</td>
                        <td className="p-2 border" onClick={(e) => e.stopPropagation()}><input type="text" value={emp.department_name || ''} onChange={(e) => handleInputChange(emp.employee_id, 'department_name', e.target.value)} className="w-full p-1 border rounded" disabled={!canUpdate} /></td>
                        <td className="p-2 border" onClick={(e) => e.stopPropagation()}><input type="text" value={emp.employee_name} onChange={(e) => handleInputChange(emp.employee_id, 'employee_name', e.target.value)} className="w-full p-1 border rounded" disabled={!canUpdate} /></td>
                        <td className="p-2 border" onClick={(e) => e.stopPropagation()}>
                        <select value={emp.employee_type} onChange={(e) => handleInputChange(emp.employee_id, 'employee_type', e.target.value)} className="w-full p-1 border rounded" disabled={!canUpdate}>
                                <option value="正社員">正社員</option><option value="アルバイト">アルバイト</option><option value="契約社員">契約社員</option>
                        </select>
                        </td>
                        <td className="p-2 border text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={!!emp.retirement_flag} onChange={(e) => handleInputChange(emp.employee_id, 'retirement_flag', e.target.checked)} className="h-5 w-5" disabled={!canUpdate} /></td>
                        <td className="p-2 border text-center font-semibold text-teal-600">
                        {selectedEmployeeId === emp.employee_id ? '参照' : ''}
                        </td>
                        <td className="p-2 border text-center"><button onClick={(e) => { e.stopPropagation(); handleUpdate(emp); }} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:bg-gray-400" disabled={!canUpdate}>更新</button></td>
                    </tr>
                    )
                })}
                {/* 新規社員の追加フォーム */}
                <tr className="bg-green-50">
                    <td className="p-2 border">新規</td>
                    <td className="p-2 border">
                        <select value={newEmployee.company_id} onChange={(e) => handleNewEmployeeChange('company_id', parseInt(e.target.value, 10))} className="w-full p-1 border rounded" disabled={!auth.isOwner}>
                        {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                        </select>
                    </td>
                    <td className="p-2 border"><input type="text" value={newEmployee.department_name} onChange={(e) => handleNewEmployeeChange('department_name', e.target.value)} className="w-full p-1 border rounded" placeholder="例：開発部" disabled={!auth.isOwner} /></td>
                    <td className="p-2 border"><input type="text" value={newEmployee.employee_name} onChange={(e) => handleNewEmployeeChange('employee_name', e.target.value)} className="w-full p-1 border rounded" placeholder="例：鈴木　一郎" disabled={!auth.isOwner} /></td>
                    <td className="p-2 border">
                        <select value={newEmployee.employee_type} onChange={(e) => handleNewEmployeeChange('employee_type', e.target.value)} className="w-full p-1 border rounded" disabled={!auth.isOwner}>
                            <option value="正社員">正社員</option><option value="アルバイト">アルバイト</option><option value="契約社員">契約社員</option>
                        </select>
                    </td>
                    <td className="p-2 border" colSpan="2"></td>
                    <td className="p-2 border text-center"><button onClick={handleAdd} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600" disabled={!auth.isOwner}>追加</button></td>
                </tr>
                </tbody>
            </table>
            </div>
        </div>
        </>
      )}

      {activeTab === 'clients' && (
        <div className="overflow-y-auto" style={{maxHeight: '60vh'}}>
          <div className="mb-4 p-2 bg-blue-50 border rounded flex items-center space-x-2">
            <span className="font-bold">新規追加:</span>
            <input type="text" placeholder="取引先名" className="p-1 border rounded flex-grow" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
            <button onClick={handleClientAdd} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700">追加</button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="p-2 border w-20">ID</th>
                <th className="p-2 border">取引先名</th>
                <th className="p-2 border w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.client_id} className="hover:bg-gray-50">
                  <td className="p-2 border text-center">{client.client_id}</td>
                  <td className="p-2 border">
                    <input type="text" className="w-full p-1 border rounded" value={client.client_name}
                      onChange={(e) => {
                        const updated = clients.map(c => c.client_id === client.client_id ? { ...c, client_name: e.target.value } : c);
                        setClients(updated);
                      }}
                    />
                  </td>
                  <td className="p-2 border text-center space-x-2">
                    <button onClick={() => handleClientUpdate(client)} className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600">更新</button>
                    <button onClick={() => handleClientDelete(client.client_id)} className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600">削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="overflow-y-auto" style={{maxHeight: '60vh'}}>
          <div className="mb-4 p-2 bg-blue-50 border rounded flex items-center space-x-2">
            <span className="font-bold">新規追加:</span>
            <select className="p-1 border rounded" value={newProject.client_id} onChange={(e) => setNewProject(prev => ({ ...prev, client_id: parseInt(e.target.value) }))}>
              {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
            </select>
            <input type="text" placeholder="案件名" className="p-1 border rounded flex-grow" value={newProject.project_name} onChange={(e) => setNewProject(prev => ({ ...prev, project_name: e.target.value }))} />
            <button onClick={handleProjectAdd} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700">追加</button>
          </div>
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="p-2 border w-20">ID</th>
                <th className="p-2 border w-48">取引先</th>
                <th className="p-2 border">案件名</th>
                <th className="p-2 border w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr key={project.project_id} className="hover:bg-gray-50">
                  <td className="p-2 border text-center">{project.project_id}</td>
                  <td className="p-2 border">
                    <select className="w-full p-1 border rounded" value={project.client_id}
                       onChange={(e) => {
                         const updated = projects.map(p => p.project_id === project.project_id ? { ...p, client_id: parseInt(e.target.value) } : p);
                         setProjects(updated);
                       }}>
                      {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
                    </select>
                  </td>
                  <td className="p-2 border">
                    <input type="text" className="w-full p-1 border rounded" value={project.project_name}
                       onChange={(e) => {
                         const updated = projects.map(p => p.project_id === project.project_id ? { ...p, project_name: e.target.value } : p);
                         setProjects(updated);
                       }}
                    />
                  </td>
                  <td className="p-2 border text-center space-x-2">
                    <button onClick={() => handleProjectUpdate(project)} className="bg-blue-500 text-white px-2 py-1 rounded text-sm hover:bg-blue-600">更新</button>
                    <button onClick={() => handleProjectDelete(project.project_id)} className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600">削除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end mt-6">
        <button onClick={onRequestClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
      </div>
    </Modal>
  );
};

export default MasterModal;
