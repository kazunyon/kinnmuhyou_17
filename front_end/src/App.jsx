import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, getDaysInMonth } from 'date-fns';
import ReportScreen from './components/ReportScreen';
import DailyReportModal from './components/DailyReportModal';
import MasterModal from './components/MasterModal';
import DailyReportListModal from './components/DailyReportListModal';
import PrintLayout from './components/PrintLayout';
import { useReactToPrint } from 'react-to-print';

const API_URL = '/api';

function App() {
  // --- State定義 ---
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(1);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [workRecords, setWorkRecords] = useState([]);
  const [holidays, setHolidays] = useState({});
  const [specialNotes, setSpecialNotes] = useState("");
  const [approvalDate, setApprovalDate] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [billingSummary, setBillingSummary] = useState([]); // ★ 追加

  const [initialWorkRecords, setInitialWorkRecords] = useState([]);
  const [initialSpecialNotes, setInitialSpecialNotes] = useState("");
  const [initialApprovalDate, setInitialApprovalDate] = useState(null);
  const [initialMonthlySummary, setInitialMonthlySummary] = useState(null);
  const [isReportScreenDirty, setIsReportScreenDirty] = useState(false);
  const [hasDailyReportBeenUpdated, setHasDailyReportBeenUpdated] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [ownerId, setOwnerId] = useState(null);
  const [ownerName, setOwnerName] = useState(null);
  const [isViewingOwnerReport, setIsViewingOwnerReport] = useState(false);
  
  const [isDailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  const [isMasterModalOpen, setMasterModalOpen] = useState(false);
  const [isDailyReportListModalOpen, setDailyReportListModalOpen] = useState(false);

  const [masterAuthState, setMasterAuthState] = useState({
    isAuthenticated: false, isOwner: false, password: '', timestamp: null,
  });

  const [selectedDateForDailyReport, setSelectedDateForDailyReport] = useState(null);
  const printComponentRef = useRef();

  // --- データ取得関連 (副作用フック) ---

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [empRes, compRes, ownerRes, clientsRes, projectsRes] = await Promise.all([
          axios.get(`${API_URL}/employees`),
          axios.get(`${API_URL}/companies`),
          axios.get(`${API_URL}/owner_info`),
          axios.get(`${API_URL}/clients`),
          axios.get(`${API_URL}/projects`),
        ]);
        setOwnerId(parseInt(ownerRes.data.owner_id, 10));
        setOwnerName(ownerRes.data.owner_name);
        setEmployees(empRes.data);
        setCompanies(compRes.data);
        setClients(clientsRes.data);
        setProjects(projectsRes.data);
      } catch (error) {
        console.error("初期データの取得に失敗しました:", error);
        setMessage("サーバーとの通信に失敗しました。");
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (ownerId !== null) {
      setIsViewingOwnerReport(selectedEmployeeId === ownerId);
    }
  }, [selectedEmployeeId, ownerId]);

  useEffect(() => {
    // projectsがまだロードされていない場合は何もしない
    if (!selectedEmployeeId || projects.length === 0) return;

    const fetchWorkData = async () => {
      setIsLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      try {
        const [recordsRes, holidaysRes] = await Promise.all([
           axios.get(`${API_URL}/work_records/${selectedEmployeeId}/${year}/${month}`),
           axios.get(`${API_URL}/holidays/${year}`)
        ]);
        
        // project_idからclient_idを引くためのマップを作成
        const projectToClientMap = new Map(projects.map(p => [p.project_id, p.client_id]));

        // レコードの各詳細にclient_idを追加する
        recordsRes.data.records.forEach(rec => {
          if (rec.details) {
            rec.details.forEach(detail => {
              detail.client_id = projectToClientMap.get(detail.project_id);
            });
          }
        });

        const recordsMap = new Map(recordsRes.data.records.map(r => [r.day, r]));
        const daysInMonth = getDaysInMonth(currentDate);
        const newRecords = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          return recordsMap.get(day) || { day, start_time: '', end_time: '', break_time: '00:00', details: [] };
        });

        const newSpecialNotes = recordsRes.data.special_notes || "";
        const newApprovalDate = recordsRes.data.approval_date || null;
        const newMonthlySummary = recordsRes.data.monthly_summary || {};
        if (newMonthlySummary.substitute_holidays === undefined) {
          newMonthlySummary.substitute_holidays = 0;
        }

        setBillingSummary(recordsRes.data.billing_summary || []); // ★ 追加

        setWorkRecords(newRecords);
        setInitialWorkRecords(newRecords);
        setSpecialNotes(newSpecialNotes);
        setInitialSpecialNotes(newSpecialNotes);
        setApprovalDate(newApprovalDate);
        setInitialApprovalDate(newApprovalDate);
        setMonthlySummary(newMonthlySummary);
        setInitialMonthlySummary(newMonthlySummary);
        setHolidays(holidaysRes.data);
        setIsReportScreenDirty(false);
        setHasDailyReportBeenUpdated(false);
        
      } catch (error) {
        console.error("作業記録の取得に失敗しました:", error);
        setMessage("作業記録の取得に失敗しました。");
        const daysInMonth = getDaysInMonth(currentDate);
        const emptyRecords = Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1, start_time: '', end_time: '', break_time: '00:00', details: []
        }));
        setWorkRecords(emptyRecords);
        setInitialWorkRecords(emptyRecords);
        setSpecialNotes("");
        setInitialSpecialNotes("");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkData();
  }, [selectedEmployeeId, currentDate, projects]); // projectsを依存配列に追加

  useEffect(() => {
    const isDirty =
      JSON.stringify(workRecords) !== JSON.stringify(initialWorkRecords) ||
      specialNotes !== initialSpecialNotes ||
      approvalDate !== initialApprovalDate ||
      JSON.stringify(monthlySummary) !== JSON.stringify(initialMonthlySummary) ||
      hasDailyReportBeenUpdated;
    setIsReportScreenDirty(isDirty);
  }, [workRecords, specialNotes, approvalDate, monthlySummary, initialWorkRecords, initialSpecialNotes, initialApprovalDate, initialMonthlySummary, hasDailyReportBeenUpdated]);
  
  // --- イベントハンドラ ---
  const handleSave = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      // バックエンドに送る前に、フロントエンド専用の `client_id` を削除する
      const recordsToSave = JSON.parse(JSON.stringify(workRecords));
      recordsToSave.forEach(rec => {
        if(rec.details){
          rec.details.forEach(detail => {
            delete detail.client_id;
            delete detail.client_name;
            delete detail.project_name;
          });
        }
      });

      const payload = {
        employee_id: selectedEmployeeId, year, month,
        records: recordsToSave,
        special_notes: specialNotes,
        monthly_summary: monthlySummary,
      };
      const response = await axios.post(`${API_URL}/work_records`, payload);
      setMessage(response.data.message);

      setInitialWorkRecords(workRecords);
      setInitialSpecialNotes(specialNotes);
      setInitialApprovalDate(approvalDate);
      setInitialMonthlySummary(monthlySummary);
      setIsReportScreenDirty(false);
      setHasDailyReportBeenUpdated(false);

      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error("保存に失敗しました:", error);
      setMessage("保存に失敗しました。");
    }
  };

  const handlePrint = useReactToPrint({ content: () => printComponentRef.current });
  const handleApprove = async () => { /* ... */ };
  const handleCancelApproval = async () => { /* ... */ };
  const handleChangeDate = (newDate) => { /* ... */ };
  const handleMonthlySummaryChange = (field, value) => { /* ... */ };
  const handleOpenDailyReport = (date) => { /* ... */ };
  const handleMasterUpdate = (updatedEmployees) => { /* ... */ };
  const handleEmployeeSelectInMaster = (employeeId) => { /* ... */ };
  const handleOpenMaster = () => { /* ... */ };
  const refreshOwnerAndAuth = async () => { /* ... */ };
  
  // --- レンダリングのための表示用データ準備 ---
  const selectedEmployee = employees.find(e => e.employee_id === selectedEmployeeId);
  const company = companies.find(c => c.company_id === selectedEmployee?.company_id);
  
  if (!employees.length || !companies.length || !clients.length || !projects.length) {
    return <div className="p-4">初期データを読み込み中です...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 font-sans text-10pt">
      <ReportScreen
        selectedEmployee={selectedEmployee}
        company={company}
        currentDate={currentDate}
        workRecords={workRecords}
        holidays={holidays}
        specialNotes={specialNotes}
        monthlySummary={monthlySummary}
        approvalDate={approvalDate}
        isLoading={isLoading}
        message={message}
        isReadOnly={!isViewingOwnerReport}
        isReportScreenDirty={isReportScreenDirty}
        billingSummary={billingSummary}
        onDateChange={handleChangeDate}
        onWorkRecordsChange={setWorkRecords}
        onSpecialNotesChange={setSpecialNotes}
        onMonthlySummaryChange={handleMonthlySummaryChange}
        onSave={handleSave}
        onPrint={handlePrint}
        onApprove={handleApprove}
        onCancelApproval={handleCancelApproval}
        onOpenDailyReportList={() => setDailyReportListModalOpen(true)}
        onOpenMaster={handleOpenMaster}
        onRowClick={(record) => {
          const dateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), record.day), 'yyyy-MM-dd');
          handleOpenDailyReport(dateStr);
        }}
        clients={clients}
        projects={projects}
      />

      {/* ... Modals and PrintLayout ... */}
    </div>
  );
}

export default App;
