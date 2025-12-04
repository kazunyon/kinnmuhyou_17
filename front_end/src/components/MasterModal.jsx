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
    maxHeight: '90vh', padding: '2rem',
    display: 'flex', flexDirection: 'column'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
};

// アプリケーションのルート要素をモーダルライブラリに設定
if (typeof document !== 'undefined' && document.getElementById('root')) {
  Modal.setAppElement('#root');
}

/**
 * 社員情報、取引先、案件のマスターメンテナンスを行うモーダルコンポーネント。
 * 認証、各マスターデータの表示・更新、新規追加機能を提供します。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {boolean} props.isOpen - モーダルが開いているか。
 * @param {Function} props.onRequestClose - モーダルを閉じる関数。
 * @param {Function} props.onMasterUpdate - 社員情報が更新されたことを親に通知する関数。
 * @param {Function} props.onSelectEmployee - 社員が「参照」されたことを親に通知する関数。
 * @param {number} props.selectedEmployeeId - 現在選択中の社員ID。
 * @param {Array<object>} props.companies - 会社リスト。
 * @param {object} props.auth - 認証状態オブジェクト。
 * @param {Function} props.setAuth - 認証状態を更新する関数。
 * @param {Array<object>} props.employees - 全社員のリスト。
 * @returns {JSX.Element} レンダリングされたマスターメンテナンスモーダル。
 */
const MasterModal = ({ isOpen, onRequestClose, onMasterUpdate, onSelectEmployee, selectedEmployeeId, companies, auth, setAuth, employees: allEmployees }) => {
  // --- 状態管理 ---
  const [activeTab, setActiveTab] = useState('employees'); // 'employees', 'clients', 'projects'

  // 社員用
  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({
      company_id: companies.length > 0 ? companies[0].company_id : '',
      employee_name: '', department_name: '', employee_type: '正社員', role: 'employee'
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authUserId, setAuthUserId] = useState(selectedEmployeeId);

  // 取引先用
  const [clients, setClients] = useState([]);
  const [newClientName, setNewClientName] = useState('');

  // 案件用
  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState({ client_id: '', project_name: '' });
  const [selectedClientId, setSelectedClientId] = useState('all');

  const filteredProjects = selectedClientId === 'all'
    ? projects
    : projects.filter(p => p.client_id === parseInt(selectedClientId, 10));

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
      const res = await axios.get(`${API_URL}/clients?include_deleted=true`);
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
      const res = await axios.get(`${API_URL}/projects?include_deleted=true`);
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
        employee_name: '', department_name: '', employee_type: '正社員', role: 'employee'
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

  const handleAuthenticate = async () => {
    if (!authUserId || !passwordInput) {
      alert('認証する社員を選択し、パスワードを入力してください。');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/master/authenticate`, {
        employee_id: authUserId,
        password: passwordInput
      });

      if (!res.data.success) {
        alert(res.data.message || '認証に失敗しました。');
        return;
      }

      setAuth({
        isAuthenticated: true,
        isOwner: true, // Anyone authenticated can edit
        userId: authUserId,
        password: passwordInput,
        timestamp: new Date().getTime(),
      });

      alert('認証に成功しました。編集が可能です。');
      setPasswordInput('');
    } catch (error) {
      console.error("認証処理中にエラーが発生しました:", error);
      alert(error.response?.data?.message || '認証中にサーバーエラーが発生しました。');
      setAuth({ isAuthenticated: false, isOwner: false, userId: null, password: '', timestamp: null });
    }
  };

  /**
   * 社員情報の更新をサーバーに送信します。
   * @param {object} employee - 更新対象の社員オブジェクト。
   * @async
   */
  const handleUpdate = async (employee) => {
    if (!auth.isAuthenticated) {
      alert('認証が必要です。');
      return;
    }
    const dataToSend = {
      ...employee,
      auth_user_id: auth.userId,
      auth_password: auth.password,
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
   * 新規社員の情報をサーバーに送信します。
   * @async
   */
  const handleAdd = async () => {
    if (!auth.isAuthenticated) {
      alert('認証が必要です。');
      return;
    }
    if(!newEmployee.employee_name || !newEmployee.department_name) {
        alert("氏名と部署名は必須です。");
        return;
    }
    const dataToSend = {
        ...newEmployee,
        auth_user_id: auth.userId,
        auth_password: auth.password,
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
      await axios.put(`${API_URL}/clients/${client.client_id}`, {
        client_name: client.client_name,
        deleted_flag: client.deleted || 0,
      });
      alert("取引先を更新しました");
      fetchClients();
    } catch (error) {
      console.error("更新エラー:", error);
      alert("更新に失敗しました");
    }
  };

  const handleClientDelete = async (clientId) => {
    if (!window.confirm("対象のデータを削除状態にします。よろしいですか？")) return;
    const client = clients.find(c => c.client_id === clientId);
    if (!client) return;

    try {
      await axios.put(`${API_URL}/clients/${clientId}`, {
        client_name: client.client_name,
        deleted_flag: 1
      });
      alert("取引先を削除状態にしました");
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
        project_name: project.project_name,
        deleted_flag: project.deleted || 0,
      });
      alert("案件を更新しました");
      fetchProjects();
    } catch (error) {
      console.error("更新エラー:", error);
      alert("更新に失敗しました");
    }
  };

  const handleProjectDelete = async (projectId) => {
    if (!window.confirm("対象のデータを削除状態にします。よろしいですか？")) return;
    const project = projects.find(p => p.project_id === projectId);
    if (!project) return;

    try {
      await axios.put(`${API_URL}/projects/${projectId}`, {
        ...project,
        deleted_flag: 1
      });
      alert("案件を削除状態にしました");
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
      <h2 className="text-xl font-bold text-center mb-6 flex-shrink-0">マスターメンテナンス</h2>

      {/* --- タブ切り替え --- */}
      <div className="flex space-x-4 mb-6 border-b flex-shrink-0">
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
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* --- 認証エリア --- */}
        <div className="bg-gray-100 p-4 rounded-lg mb-6 border flex-shrink-0">
            <h3 className="text-lg font-semibold mb-3">編集認証</h3>
            <div className="flex items-center space-x-4">
                <fieldset disabled={auth.isAuthenticated} className="flex items-center space-x-4">
                    <span className="font-semibold">認証ユーザー:</span>
                    <select value={authUserId} onChange={(e) => setAuthUserId(parseInt(e.target.value, 10))} className="p-2 border rounded">
                        {allEmployees.map(e => <option key={e.employee_id} value={e.employee_id}>{e.employee_name}</option>)}
                    </select>
                </fieldset>
                <span className="font-semibold">パスワード:</span>
                <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="p-2 border rounded" placeholder="XXXXXX" disabled={auth.isAuthenticated} />
                <button onClick={handleAuthenticate} className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400" disabled={auth.isAuthenticated}>
                  {auth.isAuthenticated ? '認証済み' : '認証'}
                </button>
            </div>
        </div>

        {/* --- 社員情報エリア --- */}
        <div className={`${!auth.isAuthenticated ? 'opacity-50 pointer-events-none' : ''} flex-1 overflow-y-auto min-h-0`}>
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-200 sticky top-0 z-10">
                <tr>
                    <th className="p-2 border">社員ID</th><th className="p-2 border">企業名</th>
                    <th className="p-2 border">部署名</th><th className="p-2 border">氏名</th>
                    <th className="p-2 border">社員区分</th><th className="p-2 border">権限</th>
                    <th className="p-2 border">退職</th>
                    <th className="p-2 border">参照</th>
                    <th className="p-2 border">操作</th>
                </tr>
                </thead>
                <tbody>
                {/* 新規社員の追加フォーム */}
                <tr className="bg-green-50">
                    <td className="p-2 border">新規</td>
                    <td className="p-2 border">
                        <select value={newEmployee.company_id} onChange={(e) => handleNewEmployeeChange('company_id', parseInt(e.target.value, 10))} className="w-full p-1 border rounded">
                        {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.company_name}</option>)}
                        </select>
                    </td>
                    <td className="p-2 border"><input type="text" value={newEmployee.department_name} onChange={(e) => handleNewEmployeeChange('department_name', e.target.value)} className="w-full p-1 border rounded" placeholder="例：開発部" /></td>
                    <td className="p-2 border"><input type="text" value={newEmployee.employee_name} onChange={(e) => handleNewEmployeeChange('employee_name', e.target.value)} className="w-full p-1 border rounded" placeholder="例：鈴木　一郎" /></td>
                    <td className="p-2 border">
                        <select value={newEmployee.employee_type} onChange={(e) => handleNewEmployeeChange('employee_type', e.target.value)} className="w-full p-1 border rounded">
                            <option value="正社員">正社員</option><option value="アルバイト">アルバイト</option><option value="契約社員">契約社員</option>
                        </select>
                    </td>
                    <td className="p-2 border">
                        <select value={newEmployee.role} onChange={(e) => handleNewEmployeeChange('role', e.target.value)} className="w-full p-1 border rounded">
                            <option value="employee">一般</option>
                            <option value="manager">部長</option>
                            <option value="accounting">経理</option>
                        </select>
                    </td>
                    <td className="p-2 border" colSpan="2"></td>
                    <td className="p-2 border text-center"><button onClick={handleAdd} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">追加</button></td>
                </tr>
                {employees.map(emp => {
                    const companyName = companies.find(c => c.company_id === emp.company_id)?.company_name || 'N/A';

                    return (
                    <tr key={emp.employee_id}
                        className={`hover:bg-gray-50 cursor-pointer ${selectedEmployeeId === emp.employee_id ? 'bg-blue-100' : ''}`}
                        onClick={() => onSelectEmployee(emp.employee_id)}>
                        <td className="p-2 border">{emp.employee_id}</td>
                        <td className="p-2 border">{companyName}</td>
                        <td className="p-2 border" onClick={(e) => e.stopPropagation()}><input type="text" value={emp.department_name || ''} onChange={(e) => handleInputChange(emp.employee_id, 'department_name', e.target.value)} className="w-full p-1 border rounded" /></td>
                        <td className="p-2 border" onClick={(e) => e.stopPropagation()}><input type="text" value={emp.employee_name} onChange={(e) => handleInputChange(emp.employee_id, 'employee_name', e.target.value)} className="w-full p-1 border rounded" /></td>
                        <td className="p-2 border" onClick={(e) => e.stopPropagation()}>
                        <select value={emp.employee_type} onChange={(e) => handleInputChange(emp.employee_id, 'employee_type', e.target.value)} className="w-full p-1 border rounded">
                                <option value="正社員">正社員</option><option value="アルバイト">アルバイト</option><option value="契約社員">契約社員</option>
                        </select>
                        </td>
                        <td className="p-2 border" onClick={(e) => e.stopPropagation()}>
                        <select value={emp.role} onChange={(e) => handleInputChange(emp.employee_id, 'role', e.target.value)} className="w-full p-1 border rounded">
                            <option value="employee">一般</option>
                            <option value="manager">部長</option>
                            <option value="accounting">経理</option>
                        </select>
                        </td>
                        <td className="p-2 border text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={!!emp.retirement_flag} onChange={(e) => handleInputChange(emp.employee_id, 'retirement_flag', e.target.checked)} className="h-5 w-5" /></td>
                        <td className="p-2 border text-center font-semibold text-teal-600">
                        {selectedEmployeeId === emp.employee_id ? '参照' : ''}
                        </td>
                        <td className="p-2 border text-center"><button onClick={(e) => { e.stopPropagation(); handleUpdate(emp); }} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">更新</button></td>
                    </tr>
                    )
                })}
                </tbody>
            </table>
        </div>
        </div>
      )}

      {activeTab === 'clients' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="mb-4 p-2 bg-blue-50 border rounded flex items-center space-x-2 flex-shrink-0">
            <span className="font-bold">新規追加:</span>
            <input type="text" placeholder="取引先名" className="p-1 border rounded flex-grow" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
            <button onClick={handleClientAdd} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700">追加</button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0 z-10">
              <tr>
                <th className="p-2 border w-20">ID</th>
                <th className="p-2 border">取引先名</th>
                <th className="p-2 border w-32">削除フラグ</th>
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
                  <td className="p-2 border">
                    <select className="w-full p-1 border rounded" value={client.deleted || 0}
                      onChange={(e) => {
                        const updated = clients.map(c => c.client_id === client.client_id ? { ...c, deleted: parseInt(e.target.value, 10) } : c);
                        setClients(updated);
                      }}>
                      <option value={0}>なし</option>
                      <option value={1}>あり</option>
                    </select>
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
        </div>
      )}

      {activeTab === 'projects' && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="mb-4 p-2 bg-blue-50 border rounded flex items-center space-x-2 flex-shrink-0">
            <span className="font-bold">新規追加:</span>
            <select className="p-1 border rounded" value={newProject.client_id} onChange={(e) => setNewProject(prev => ({ ...prev, client_id: parseInt(e.target.value, 10) }))}>
              {clients.filter(c => c.deleted !== 1).map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
            </select>
            <input type="text" placeholder="案件名" className="p-1 border rounded flex-grow" value={newProject.project_name} onChange={(e) => setNewProject(prev => ({ ...prev, project_name: e.target.value }))} />
            <button onClick={handleProjectAdd} className="bg-green-600 text-white px-4 py-1 rounded hover:bg-green-700">追加</button>
          </div>
          <div className="mb-4 flex items-center space-x-2 flex-shrink-0">
            <span className="font-bold">取引先で絞り込み:</span>
            <select className="p-1 border rounded" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
              <option value="all">すべて</option>
              {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
            </select>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0 z-10">
              <tr>
                <th className="p-2 border w-20">ID</th>
                <th className="p-2 border w-48">取引先</th>
                <th className="p-2 border">案件名</th>
                <th className="p-2 border w-32">削除フラグ</th>
                <th className="p-2 border w-32">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(project => (
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
                  <td className="p-2 border">
                    <select className="w-full p-1 border rounded" value={project.deleted || 0}
                      onChange={(e) => {
                        const updated = projects.map(p => p.project_id === project.project_id ? { ...p, deleted: parseInt(e.target.value, 10) } : p);
                        setProjects(updated);
                      }}>
                      <option value={0}>なし</option>
                      <option value={1}>あり</option>
                    </select>
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
        </div>
      )}

      <div className="flex justify-end mt-6 flex-shrink-0">
        <button onClick={onRequestClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
      </div>
    </Modal>
  );
};

export default MasterModal;
