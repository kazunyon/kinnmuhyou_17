import { useState, useEffect } from 'react';
import Modal from 'react-modal';
import axios from 'axios';

const API_URL = '/api';

const modalStyles = {
  content: {
    top: '50%', left: '50%', right: 'auto', bottom: 'auto',
    marginRight: '-50%', transform: 'translate(-50%, -50%)',
    width: '1200px',
    maxHeight: '90vh', padding: '2rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
};

Modal.setAppElement('#root');

const MasterModal = ({ isOpen, onRequestClose, onMasterUpdate, onSelectEmployee, selectedEmployeeId, companies, auth, setAuth, ownerId, ownerName }) => {
  const [activeTab, setActiveTab] = useState('employees');

  const [employees, setEmployees] = useState([]);
  const [newEmployee, setNewEmployee] = useState({
      company_id: companies.length > 0 ? companies[0].company_id : '',
      employee_name: '', department_name: '', employee_type: '正社員'
  });

  const [clients, setClients] = useState([]);
  const [newClientName, setNewClientName] = useState('');

  const [projects, setProjects] = useState([]);
  const [newProject, setNewProject] = useState({ client_id: '', project_name: '' });

  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    const fetchAllMasterData = async () => {
      try {
        const [employeesRes, clientsRes, projectsRes] = await Promise.all([
          axios.get(`${API_URL}/employees/all`),
          axios.get(`${API_URL}/clients`),
          axios.get(`${API_URL}/projects`)
        ]);
        setEmployees(employeesRes.data);
        setClients(clientsRes.data);
        if (clientsRes.data.length > 0) {
          setNewProject(prev => ({ ...prev, client_id: clientsRes.data[0].client_id }));
        }
        setProjects(projectsRes.data);
      } catch (error) {
        console.error("マスターデータの取得に失敗しました:", error);
        alert('マスターデータの取得に失敗しました。');
      }
    };

    if (isOpen) {
      fetchAllMasterData();
    } else {
      setPasswordInput('');
      setActiveTab('employees');
    }
  }, [isOpen]);

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
      console.error("認証エラー:", error);
      alert(error.response?.data?.message || '認証中にサーバーエラーが発生しました。');
      setAuth({ isAuthenticated: false, isOwner: false, password: '', timestamp: null });
    }
  };

  const handleEmployeeInputChange = (id, field, value) => {
    const val = field === 'retirement_flag' ? !!value : value;
    setEmployees(employees.map(emp => emp.employee_id === id ? { ...emp, [field]: val } : emp));
  };

  const handleNewEmployeeChange = (field, value) => {
      setNewEmployee(prev => ({...prev, [field]: value}));
  };

  const handleUpdateEmployee = async (employee) => {
    if (!auth.isOwner) {
      alert('オーナー権限がないため更新できません。');
      return;
    }
    const dataToSend = { ...employee, owner_id: ownerId, owner_password: auth.password };
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

  const handleAddEmployee = async () => {
    if (!auth.isOwner) {
      alert('オーナー権限がないため追加できません。');
      return;
    }
    if(!newEmployee.employee_name || !newEmployee.department_name) {
        alert("氏名と部署名は必須です。");
        return;
    }
    const dataToSend = { ...newEmployee, owner_id: ownerId, owner_password: auth.password };
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

  const handleClientInputChange = (id, value) => {
    setClients(clients.map(c => c.client_id === id ? { ...c, client_name: value } : c));
  };

  const handleAddClient = async () => {
    if (!auth.isOwner) return alert('オーナー権限が必要です。');
    if (!newClientName.trim()) return alert('取引先名を入力してください。');
    try {
      await axios.post(`${API_URL}/clients`, { client_name: newClientName, owner_id: ownerId, owner_password: auth.password });
      setNewClientName('');
      const res = await axios.get(`${API_URL}/clients`);
      setClients(res.data);
    } catch (error) {
      alert(error.response?.data?.error || '取引先の追加に失敗しました。');
    }
  };

  const handleUpdateClient = async (client) => {
    if (!auth.isOwner) return alert('オーナー権限が必要です。');
    try {
      await axios.put(`${API_URL}/clients/${client.client_id}`, { client_name: client.client_name, owner_id: ownerId, owner_password: auth.password });
      alert('取引先を更新しました。');
    } catch (error) {
      alert(error.response?.data?.error || '取引先の更新に失敗しました。');
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!auth.isOwner) return alert('オーナー権限が必要です。');
    if (!window.confirm('この取引先を削除しますか？関連する案件が存在しない場合のみ削除できます。')) return;
    try {
      await axios.delete(`${API_URL}/clients/${clientId}`, { data: { owner_id: ownerId, owner_password: auth.password } });
      setClients(clients.filter(c => c.client_id !== clientId));
    } catch (error) {
      alert(error.response?.data?.error || '取引先の削除に失敗しました。');
    }
  };

  const handleProjectInputChange = (id, field, value) => {
    setProjects(projects.map(p => p.project_id === id ? { ...p, [field]: value } : p));
  };

  const handleNewProjectChange = (field, value) => {
    setNewProject(prev => ({ ...prev, [field]: value }));
  };

  const handleAddProject = async () => {
    if (!auth.isOwner) return alert('オーナー権限が必要です。');
    if (!newProject.project_name.trim()) return alert('案件名を入力してください。');
    try {
      await axios.post(`${API_URL}/projects`, { ...newProject, owner_id: ownerId, owner_password: auth.password });
      setNewProject({ client_id: clients[0]?.client_id || '', project_name: '' });
      const res = await axios.get(`${API_URL}/projects`);
      setProjects(res.data);
    } catch (error) {
      alert(error.response?.data?.error || '案件の追加に失敗しました。');
    }
  };

  const handleUpdateProject = async (project) => {
    if (!auth.isOwner) return alert('オーナー権限が必要です。');
    try {
      await axios.put(`${API_URL}/projects/${project.project_id}`, { ...project, owner_id: ownerId, owner_password: auth.password });
      alert('案件を更新しました。');
      const res = await axios.get(`${API_URL}/projects`);
      setProjects(res.data);
    } catch (error) {
      alert(error.response?.data?.error || '案件の更新に失敗しました。');
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!auth.isOwner) return alert('オーナー権限が必要です。');
    if (!window.confirm('この案件を削除しますか？')) return;
    try {
      await axios.delete(`${API_URL}/projects/${projectId}`, { data: { owner_id: ownerId, owner_password: auth.password } });
      setProjects(projects.filter(p => p.project_id !== projectId));
    } catch (error) {
      alert(error.response?.data?.error || '案件の削除に失敗しました。');
    }
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="マスターメンテナンス" id="master-modal" bodyOpenClassName="modal-open">
      <h2 className="text-xl font-bold text-center mb-6">マスターメンテナンス</h2>

      <div className="bg-gray-100 p-4 rounded-lg mb-6 border">
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

      <div className={!auth.isAuthenticated ? 'opacity-50 pointer-events-none' : ''}>
        <div className="flex border-b mb-4">
          <button className={`py-2 px-4 ${activeTab === 'employees' ? 'border-b-2 border-blue-500 font-semibold' : ''}`} onClick={() => setActiveTab('employees')}>社員</button>
          <button className={`py-2 px-4 ${activeTab === 'clients' ? 'border-b-2 border-blue-500 font-semibold' : ''}`} onClick={() => setActiveTab('clients')}>取引先</button>
          <button className={`py-2 px-4 ${activeTab === 'projects' ? 'border-b-2 border-blue-500 font-semibold' : ''}`} onClick={() => setActiveTab('projects')}>案件</button>
        </div>

        <div className="overflow-y-auto" style={{maxHeight: '60vh'}}>
          {activeTab === 'employees' && (
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
                  const canUpdate = auth.isOwner; // Simplified for now
                  return (
                    <tr key={emp.employee_id}
                        className={`hover:bg-gray-50 ${selectedEmployeeId === emp.employee_id ? 'bg-blue-100' : ''}`}
                        onClick={() => onSelectEmployee(emp.employee_id)}>
                      <td className="p-2 border">{emp.employee_id}</td>
                      <td className="p-2 border">{companyName}</td>
                      <td className="p-2 border"><input type="text" value={emp.department_name || ''} onChange={(e) => handleEmployeeInputChange(emp.employee_id, 'department_name', e.target.value)} className="w-full p-1 border rounded" disabled={!canUpdate} /></td>
                      <td className="p-2 border"><input type="text" value={emp.employee_name} onChange={(e) => handleEmployeeInputChange(emp.employee_id, 'employee_name', e.target.value)} className="w-full p-1 border rounded" disabled={!canUpdate} /></td>
                      <td className="p-2 border">
                         <select value={emp.employee_type} onChange={(e) => handleEmployeeInputChange(emp.employee_id, 'employee_type', e.target.value)} className="w-full p-1 border rounded" disabled={!canUpdate}>
                              <option value="正社員">正社員</option><option value="アルバイト">アルバイト</option><option value="契約社員">契約社員</option>
                         </select>
                      </td>
                      <td className="p-2 border text-center"><input type="checkbox" checked={!!emp.retirement_flag} onChange={(e) => handleEmployeeInputChange(emp.employee_id, 'retirement_flag', e.target.checked)} className="h-5 w-5" disabled={!canUpdate} /></td>
                      <td className="p-2 border text-center font-semibold text-teal-600">
                        {selectedEmployeeId === emp.employee_id ? '参照' : ''}
                      </td>
                      <td className="p-2 border text-center"><button onClick={(e) => { e.stopPropagation(); handleUpdateEmployee(emp); }} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:bg-gray-400" disabled={!canUpdate}>更新</button></td>
                    </tr>
                  )
                })}
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
                    <td className="p-2 border text-center"><button onClick={handleAddEmployee} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600" disabled={!auth.isOwner}>追加</button></td>
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === 'clients' && (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-200 sticky top-0"><tr><th className="p-2 border w-24">ID</th><th className="p-2 border">取引先名</th><th className="p-2 border w-48">操作</th></tr></thead>
              <tbody>
                {clients.map(client => (
                  <tr key={client.client_id}>
                    <td className="p-2 border">{client.client_id}</td>
                    <td className="p-2 border"><input type="text" value={client.client_name} onChange={(e) => handleClientInputChange(client.client_id, e.target.value)} className="w-full p-1 border rounded" disabled={!auth.isOwner} /></td>
                    <td className="p-2 border text-center space-x-2">
                      <button onClick={() => handleUpdateClient(client)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600" disabled={!auth.isOwner}>更新</button>
                      <button onClick={() => handleDeleteClient(client.client_id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600" disabled={!auth.isOwner}>削除</button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-green-50">
                  <td className="p-2 border">新規</td>
                  <td className="p-2 border"><input type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full p-1 border rounded" placeholder="新しい取引先名" disabled={!auth.isOwner} /></td>
                  <td className="p-2 border text-center"><button onClick={handleAddClient} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600" disabled={!auth.isOwner}>追加</button></td>
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === 'projects' && (
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-200 sticky top-0"><tr><th className="p-2 border w-24">ID</th><th className="p-2 border">取引先</th><th className="p-2 border">案件名</th><th className="p-2 border w-48">操作</th></tr></thead>
              <tbody>
                {projects.map(proj => (
                  <tr key={proj.project_id}>
                    <td className="p-2 border">{proj.project_id}</td>
                    <td className="p-2 border">
                      <select value={proj.client_id} onChange={(e) => handleProjectInputChange(proj.project_id, 'client_id', parseInt(e.target.value))} className="w-full p-1 border rounded" disabled={!auth.isOwner}>
                        {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border"><input type="text" value={proj.project_name} onChange={(e) => handleProjectInputChange(proj.project_id, 'project_name', e.target.value)} className="w-full p-1 border rounded" disabled={!auth.isOwner} /></td>
                    <td className="p-2 border text-center space-x-2">
                      <button onClick={() => handleUpdateProject(proj)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600" disabled={!auth.isOwner}>更新</button>
                      <button onClick={() => handleDeleteProject(proj.project_id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600" disabled={!auth.isOwner}>削除</button>
                    </td>
                  </tr>
                ))}
                <tr className="bg-green-50">
                  <td className="p-2 border">新規</td>
                  <td className="p-2 border">
                    <select value={newProject.client_id} onChange={(e) => handleNewProjectChange('client_id', parseInt(e.target.value))} className="w-full p-1 border rounded" disabled={!auth.isOwner}>
                      {clients.map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}
                    </select>
                  </td>
                  <td className="p-2 border"><input type="text" value={newProject.project_name} onChange={(e) => handleNewProjectChange('project_name', e.target.value)} className="w-full p-1 border rounded" placeholder="新しい案件名" disabled={!auth.isOwner} /></td>
                  <td className="p-2 border text-center"><button onClick={handleAddProject} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600" disabled={!auth.isOwner}>追加</button></td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button onClick={onRequestClose} className="px-6 py-2 bg-gray-300 rounded hover:bg-gray-400">閉じる</button>
      </div>
    </Modal>
  );
};

export default MasterModal;
