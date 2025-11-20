import { useState, useEffect } from 'react';
import Modal from 'react-modal';
import axios from 'axios';

const API_URL = '/api';

const modalStyles = {
  content: {
    top: '50%', left: '50%', right: 'auto', bottom: 'auto',
    marginRight: '-50%', transform: 'translate(-50%, -50%)',
    width: '900px',
    maxHeight: '90vh', padding: '2rem'
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)'
  },
};

Modal.setAppElement('#root');

const ProjectMasterModal = ({ isOpen, onRequestClose, auth }) => {
  const [projects, setProjects] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [newProject, setNewProject] = useState({ project_name: '', customer_id: '' });

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API_URL}/projects`);
      setProjects(res.data);
    } catch (error) {
      console.error("案件データの取得に失敗しました:", error);
      alert('案件データの取得に失敗しました。');
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await axios.get(`${API_URL}/customers`);
      setCustomers(res.data);
      if (res.data.length > 0) {
        setNewProject(prev => ({ ...prev, customer_id: res.data[0].customer_id }));
      }
    } catch (error) {
      console.error("取引先データの取得に失敗しました:", error);
      alert('取引先データの取得に失敗しました。');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      fetchCustomers();
    }
  }, [isOpen]);

  const handleInputChange = (id, field, value) => {
    const updatedProjects = projects.map(p =>
      p.project_id === id ? { ...p, [field]: value } : p
    );
    setProjects(updatedProjects);
  };

  const handleNewProjectChange = (field, value) => {
    setNewProject(prev => ({ ...prev, [field]: value }));
  };

  const handleUpdate = async (project) => {
    if (!project.project_name || !project.customer_id) {
      alert('案件名と取引先は必須です。');
      return;
    }
    try {
      await axios.put(`${API_URL}/projects/${project.project_id}`, {
        project_name: project.project_name,
        customer_id: project.customer_id
      });
      alert('案件情報を更新しました。');
      fetchProjects();
    } catch (error) {
      console.error("更新に失敗しました:", error);
      alert(error.response?.data?.error || '更新に失敗しました。');
    }
  };

  const handleAdd = async () => {
    if (!newProject.project_name || !newProject.customer_id) {
      alert('案件名と取引先は必須です。');
      return;
    }
    try {
      await axios.post(`${API_URL}/projects`, newProject);
      alert('新しい案件を追加しました。');
      setNewProject({ project_name: '', customer_id: customers.length > 0 ? customers[0].customer_id : '' });
      fetchProjects();
    } catch (error) {
      console.error("追加に失敗しました:", error);
      alert(error.response?.data?.error || '追加に失敗しました。');
    }
  };

  const handleDelete = async (projectId) => {
    if (window.confirm('この案件を削除してもよろしいですか？')) {
      try {
        await axios.delete(`${API_URL}/projects/${projectId}`);
        alert('案件を削除しました。');
        fetchProjects();
      } catch (error) {
        console.error("削除に失敗しました:", error);
        alert(error.response?.data?.error || '削除に失敗しました。');
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onRequestClose={onRequestClose} style={modalStyles} contentLabel="案件マスターメンテナンス">
      <h2 className="text-xl font-bold text-center mb-6">案件マスターメンテナンス</h2>

      <div className={!auth.isOwner ? 'opacity-50 pointer-events-none' : ''}>
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="p-2 border w-20">ID</th>
                <th className="p-2 border">案件名</th>
                <th className="p-2 border w-48">取引先</th>
                <th className="p-2 border w-48">操作</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.project_id} className="hover:bg-gray-50">
                  <td className="p-2 border">{p.project_id}</td>
                  <td className="p-2 border">
                    <input type="text" value={p.project_name} onChange={(e) => handleInputChange(p.project_id, 'project_name', e.target.value)} className="w-full p-1 border rounded" />
                  </td>
                  <td className="p-2 border">
                    <select value={p.customer_id} onChange={(e) => handleInputChange(p.project_id, 'customer_id', parseInt(e.target.value, 10))} className="w-full p-1 border rounded">
                      {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}
                    </select>
                  </td>
                  <td className="p-2 border text-center space-x-2">
                    <button onClick={() => handleUpdate(p)} className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">更新</button>
                    <button onClick={() => handleDelete(p.project_id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">削除</button>
                  </td>
                </tr>
              ))}
              <tr className="bg-green-50">
                <td className="p-2 border">新規</td>
                <td className="p-2 border">
                  <input type="text" value={newProject.project_name} onChange={(e) => handleNewProjectChange('project_name', e.target.value)} className="w-full p-1 border rounded" placeholder="新しい案件名" />
                </td>
                <td className="p-2 border">
                  <select value={newProject.customer_id} onChange={(e) => handleNewProjectChange('customer_id', parseInt(e.target.value, 10))} className="w-full p-1 border rounded">
                    {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}
                  </select>
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

export default ProjectMasterModal;
