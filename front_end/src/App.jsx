import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, getDaysInMonth } from 'date-fns';
import ReportScreen from './components/ReportScreen';
import DailyReportModal from './components/DailyReportModal';
import MasterModal from './components/MasterModal';
import DailyReportListModal from './components/DailyReportListModal';
import PrintLayout from './components/PrintLayout';
import LoginScreen from './components/LoginScreen';
import { useReactToPrint } from 'react-to-print';

const API_URL = '/api';

function App() {
  const [user, setUser] = useState(null); // ログインユーザー情報

  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);

  // 初期値はログイン後に設定されるべきだが、初期レンダリングのためにとりあえず1にしておく
  // 実際にはログインユーザーのIDで上書きされる
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(1);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [workRecords, setWorkRecords] = useState([]);
  const [holidays, setHolidays] = useState({});
  const [specialNotes, setSpecialNotes] = useState("");
  // 古いapprovalDate互換だが、新しいステータスも管理する
  const [approvalDate, setApprovalDate] = useState(null);
  const [status, setStatus] = useState('draft');
  const [submittedDate, setSubmittedDate] = useState(null);
  const [managerApprovalDate, setManagerApprovalDate] = useState(null);
  const [accountingApprovalDate, setAccountingApprovalDate] = useState(null);
  const [remandReason, setRemandReason] = useState(null);

  const [monthlySummary, setMonthlySummary] = useState(null);
  const [projectSummary, setProjectSummary] = useState([]);

  const [initialWorkRecords, setInitialWorkRecords] = useState([]);
  const [initialSpecialNotes, setInitialSpecialNotes] = useState("");
  const [initialMonthlySummary, setInitialMonthlySummary] = useState(null);
  // ステータス関連の初期値
  const [initialStatus, setInitialStatus] = useState('draft');

  const [isReportScreenDirty, setIsReportScreenDirty] = useState(false);
  const [hasDailyReportBeenUpdated, setHasDailyReportBeenUpdated] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isDailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  const [isMasterModalOpen, setMasterModalOpen] = useState(false);
  const [isDailyReportListModalOpen, setDailyReportListModalOpen] = useState(false);

  // マスタ認証状態 (既存のMasterModal用だが、ログインユーザーのRoleチェックに移行していく)
  const [masterAuthState, setMasterAuthState] = useState({
    isAuthenticated: false,
    isOwner: false,
    userId: null,
    password: '',
    timestamp: null,
  });

  const [selectedDateForDailyReport, setSelectedDateForDailyReport] = useState(null);
  const printComponentRef = useRef();

  useEffect(() => {
    console.log("App mounted");
  }, []);

  // ログイン状態確認
  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await axios.get('/api/me');
        if (res.data) {
          // ログイン済み
          setUser({
            employee_id: res.data.employee_id,
            employee_name: res.data.employee_name,
            role: res.data.role
          });
          setSelectedEmployeeId(res.data.employee_id); // ログインユーザーを選択状態に
        }
      } catch (e) {
        // 未ログイン
        console.log("Not logged in");
      }
    };
    checkLogin();
  }, []);

  // ログイン後のデータフェッチ
  useEffect(() => {
    if (!user) return; // ログインしていない場合はロードしない

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [empRes, compRes] = await Promise.all([
          axios.get(`${API_URL}/employees`), // 自分または全員（権限による）
          axios.get(`${API_URL}/companies`),
        ]);
        setEmployees(empRes.data);
        setCompanies(compRes.data);
      } catch (error) {
        console.error("初期データの取得に失敗しました:", error);
        setMessage("サーバーとの通信に失敗しました。");
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [user]);

  // 初期日付決定 (ログイン後、かつデータロード後)
  useEffect(() => {
    if (!user) return;
    const determineInitialDate = async () => {
      const today = new Date();
      // const today = new Date('2025-11-25');
      const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevYear = prevMonthDate.getFullYear();
      const prevMonth = prevMonthDate.getMonth() + 1;

      try {
        // 前月の承認状況を確認 (ログインユーザーのデータを見る)
        const res = await axios.get(`${API_URL}/work_records/${user.employee_id}/${prevYear}/${prevMonth}`);
        const isApproved = res.data.approval_date || res.data.status === 'finalized';

        if (!isApproved) {
          setCurrentDate(prevMonthDate);
        }
      } catch (error) {
        console.log(`前月(${prevYear}/${prevMonth})のデータが見つからないため、初期表示を前月にします。`, error);
        setCurrentDate(prevMonthDate);
      }
    };
    determineInitialDate();
  }, [user]);

  // selectedEmployeeId変更時のデータ取得
  useEffect(() => {
    if (!user || !selectedEmployeeId) return;

    const fetchWorkData = async () => {
      setIsLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      try {
        const [recordsRes, holidaysRes] = await Promise.all([
           axios.get(`${API_URL}/work_records/${selectedEmployeeId}/${year}/${month}`),
           axios.get(`${API_URL}/holidays/${year}`)
        ]);
        
        const recordsMap = new Map(recordsRes.data.records.map(r => [r.day, r]));
        const daysInMonth = getDaysInMonth(currentDate);
        const newRecords = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          return recordsMap.get(day) || { day, work_content: '', start_time: '', end_time: '', break_time: '00:00' };
        });

        const newSpecialNotes = recordsRes.data.special_notes || "";
        const newApprovalDate = recordsRes.data.approval_date || null;
        const newMonthlySummary = recordsRes.data.monthly_summary || {};
        const newProjectSummary = recordsRes.data.project_summary || [];

        // 新しいステータス情報
        const newStatus = recordsRes.data.status || 'draft';
        const newSubmittedDate = recordsRes.data.submitted_date || null;
        const newManagerApprovalDate = recordsRes.data.manager_approval_date || null;
        const newAccountingApprovalDate = recordsRes.data.accounting_approval_date || null;
        const newRemandReason = recordsRes.data.remand_reason || null;

        if (newMonthlySummary.substitute_holidays === undefined) {
          newMonthlySummary.substitute_holidays = 0;
        }

        setWorkRecords(newRecords);
        setInitialWorkRecords(newRecords);
        setSpecialNotes(newSpecialNotes);
        setInitialSpecialNotes(newSpecialNotes);
        setApprovalDate(newApprovalDate);
        setMonthlySummary(newMonthlySummary);
        setInitialMonthlySummary(newMonthlySummary);
        setProjectSummary(newProjectSummary);
        setHolidays(holidaysRes.data);

        setStatus(newStatus);
        setInitialStatus(newStatus);
        setSubmittedDate(newSubmittedDate);
        setManagerApprovalDate(newManagerApprovalDate);
        setAccountingApprovalDate(newAccountingApprovalDate);
        setRemandReason(newRemandReason);

        setIsReportScreenDirty(false);
        setHasDailyReportBeenUpdated(false);
        
      } catch (error) {
        console.error("作業記録の取得に失敗しました:", error);
        setMessage("作業記録の取得に失敗しました（権限がない可能性があります）。");
        // 権限エラー等の場合、空データをセットする前にリセットする
        const daysInMonth = getDaysInMonth(currentDate);
        const emptyRecords = Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1, work_content: '', start_time: '', end_time: '', break_time: '00:00'
        }));
        setWorkRecords(emptyRecords);
        setInitialWorkRecords(emptyRecords);
        setSpecialNotes("");
        setInitialSpecialNotes("");
        setStatus('draft');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkData();
  }, [selectedEmployeeId, currentDate, user]);

  useEffect(() => {
    const isDirty =
      JSON.stringify(workRecords) !== JSON.stringify(initialWorkRecords) ||
      specialNotes !== initialSpecialNotes ||
      status !== initialStatus || // ステータス変更は即時APIコールなのであまり関係ないが念のため
      JSON.stringify(monthlySummary) !== JSON.stringify(initialMonthlySummary) ||
      hasDailyReportBeenUpdated;
    setIsReportScreenDirty(isDirty);
  }, [workRecords, specialNotes, status, monthlySummary, initialWorkRecords, initialSpecialNotes, initialStatus, initialMonthlySummary, hasDailyReportBeenUpdated]);
  
  // --- Actions ---

  const handleLogin = (userData) => {
    setUser(userData);
    setSelectedEmployeeId(userData.employee_id);
  };

  const handleLogout = async () => {
    await axios.post('/api/logout');
    setUser(null);
    setEmployees([]);
  };

  const handleEmployeeChange = (e) => {
    setSelectedEmployeeId(parseInt(e.target.value, 10));
  };

  const handleSave = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const payload = {
        employee_id: selectedEmployeeId,
        year,
        month,
        records: workRecords,
        special_notes: specialNotes,
        monthly_summary: monthlySummary,
      };
      const response = await axios.post(`${API_URL}/work_records`, payload);
      setMessage(response.data.message);

      setInitialWorkRecords(workRecords);
      setInitialSpecialNotes(specialNotes);
      setInitialMonthlySummary(monthlySummary);
      setIsReportScreenDirty(false);
      setHasDailyReportBeenUpdated(false);

      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("保存に失敗しました:", error);
      setMessage(error.response?.data?.error || "保存に失敗しました。");
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printComponentRef.current,
  });

  // ステータス変更系のアクション
  const updateStatus = async (action, additionalData = {}) => {
    if (isReportScreenDirty) {
      alert('変更が保存されていません。先に保存してください。');
      return;
    }
    if (!window.confirm('ステータスを変更しますか？')) return;

    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const payload = {
        employee_id: selectedEmployeeId,
        year,
        month,
        ...additionalData
      };

      let url = '';
      if (action === 'submit') url = '/monthly_reports/submit';
      if (action === 'approve') url = '/monthly_reports/approve';
      if (action === 'remand') url = '/monthly_reports/remand';
      if (action === 'finalize') url = '/monthly_reports/finalize';
      if (action === 'cancel') url = '/monthly_reports/cancel_approval';

      const response = await axios.post(`${API_URL}${url}`, payload);

      setMessage(response.data.message);
      setStatus(response.data.status);
      setInitialStatus(response.data.status);

      // 更新された日付などをセット
      if (response.data.submitted_date !== undefined) setSubmittedDate(response.data.submitted_date);
      if (response.data.manager_approval_date !== undefined) setManagerApprovalDate(response.data.manager_approval_date);
      if (response.data.accounting_approval_date !== undefined) setAccountingApprovalDate(response.data.accounting_approval_date);
      if (response.data.remand_reason !== undefined) setRemandReason(response.data.remand_reason);
      if (response.data.approval_date !== undefined) setApprovalDate(response.data.approval_date); // 互換用

      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("ステータス更新失敗:", error);
      setMessage(error.response?.data?.error || "ステータス更新に失敗しました。");
    }
  };

  const handleChangeDate = (newDate) => {
    if (isReportScreenDirty) {
      if (window.confirm('変更が保存されていません。移動してもよろしいですか？')) {
        setCurrentDate(newDate);
      }
    } else {
      setCurrentDate(newDate);
    }
  };

  const handleMonthlySummaryChange = (field, value) => {
    setMonthlySummary(prev => ({ ...prev, [field]: value }));
  };

  const handleOpenDailyReport = (date) => {
    setSelectedDateForDailyReport(date);
    setDailyReportModalOpen(true);
  };
  
  const handleMasterUpdate = (updatedEmployees) => {
    // 自分がManager/Accountingなら更新されたリストをセット
    // サーバーから再取得したほうが確実かも
    setEmployees(updatedEmployees);
  };

  const handleEmployeeSelectInMaster = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setMasterModalOpen(false);
  };

  const handleOpenMaster = () => {
    // マスター権限チェック
    if (user.role !== 'manager' && user.role !== 'accounting') {
       alert("権限がありません");
       return;
    }
    // 既存の認証モーダルを使うならここで認証情報セット（スキップ可能なら自動セット）
    setMasterAuthState({ isAuthenticated: true, isOwner: true, timestamp: new Date().getTime() });
    setMasterModalOpen(true);
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const selectedEmployee = employees.find(e => e.employee_id === selectedEmployeeId);
  const company = companies.find(c => c.company_id === selectedEmployee?.company_id);
  
  // 社員リスト取得中の表示制御
  if (!employees.length && !isLoading && user) {
     // 初回ロードで空っぽの場合あり得るので
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 font-sans text-10pt">
      {/* ログイン情報表示とログアウト */}
      <div className="flex justify-between items-center mb-2 px-4">
        <div>ログイン中: {user.employee_name} ({user.role === 'employee' ? '社員' : user.role === 'manager' ? '部長' : '経理'})</div>
        <button onClick={handleLogout} className="text-sm text-blue-600 hover:underline">ログアウト</button>
      </div>

      <ReportScreen
        employees={employees}
        selectedEmployee={selectedEmployee}
        onEmployeeChange={handleEmployeeChange}
        company={company}
        currentDate={currentDate}
        workRecords={workRecords}
        holidays={holidays}
        specialNotes={specialNotes}
        monthlySummary={monthlySummary}
        projectSummary={projectSummary}
        approvalDate={approvalDate} // 互換用表示

        status={status}
        submittedDate={submittedDate}
        managerApprovalDate={managerApprovalDate}
        accountingApprovalDate={accountingApprovalDate}
        remandReason={remandReason}
        user={user}

        isLoading={isLoading}
        message={message}
        isReportScreenDirty={isReportScreenDirty}
        onDateChange={handleChangeDate}
        onWorkRecordsChange={setWorkRecords}
        onSpecialNotesChange={setSpecialNotes}
        onMonthlySummaryChange={handleMonthlySummaryChange}
        onSave={handleSave}
        onPrint={handlePrint}

        // 新しいアクション
        onSubmitReport={() => updateStatus('submit')}
        onApproveReport={() => updateStatus('approve')}
        onRemandReport={(reason) => updateStatus('remand', { reason })}
        onFinalizeReport={() => updateStatus('finalize')}
        onCancelStatus={() => updateStatus('cancel')}

        // 互換用（未使用になるかも）
        onApprove={() => {}}
        onCancelApproval={() => {}}

        onOpenDailyReportList={() => setDailyReportListModalOpen(true)}
        onOpenMaster={handleOpenMaster}
        onRowClick={(record) => {
          const dateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), record.day), 'yyyy-MM-dd');
          handleOpenDailyReport(dateStr);
        }}
      />

      <DailyReportModal
        isOpen={isDailyReportModalOpen}
        onRequestClose={() => setDailyReportModalOpen(false)}
        employeeId={selectedEmployeeId}
        employeeName={selectedEmployee?.employee_name}
        date={selectedDateForDailyReport}
        workRecord={workRecords.find(r => selectedDateForDailyReport && r.day === new Date(selectedDateForDailyReport).getDate())}
        onSave={(updatedWorkRecord) => {
            const updatedRecords = workRecords.map(r => 
                r.day === updatedWorkRecord.day ? {...r, ...updatedWorkRecord} : r
            );
            setWorkRecords(updatedRecords);
        }}
        onReportUpdate={setHasDailyReportBeenUpdated}
        isReadOnly={status !== 'draft' && status !== 'remanded'} // 日報もロック
      />
      
      <MasterModal
        isOpen={isMasterModalOpen}
        onRequestClose={() => {
          setMasterModalOpen(false);
        }}
        onMasterUpdate={handleMasterUpdate}
        onSelectEmployee={handleEmployeeSelectInMaster}
        selectedEmployeeId={selectedEmployeeId}
        companies={companies}
        auth={masterAuthState}
        setAuth={setMasterAuthState}
        employees={employees}
      />

      <DailyReportListModal
        isOpen={isDailyReportListModalOpen}
        onRequestClose={() => setDailyReportListModalOpen(false)}
        employeeId={selectedEmployeeId}
        year={currentDate.getFullYear()}
        month={currentDate.getMonth() + 1}
      />
      
      <div style={{ visibility: 'hidden', height: 0, overflow: 'hidden' }}>
        <PrintLayout
          ref={printComponentRef}
          employee={selectedEmployee}
          company={company}
          currentDate={currentDate}
          workRecords={workRecords}
          holidays={holidays}
          specialNotes={specialNotes}
          monthlySummary={monthlySummary}
          projectSummary={projectSummary}
          approvalDate={approvalDate}
        />
      </div>
    </div>
  );
}

export default App;
