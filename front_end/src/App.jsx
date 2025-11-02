import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, getDaysInMonth } from 'date-fns';
import ReportScreen from './components/ReportScreen';
import DailyReportModal from './components/DailyReportModal';
import MasterModal from './components/MasterModal';
import DailyReportListModal from './components/DailyReportListModal';
import PrintLayout from './components/PrintLayout';
import { useReactToPrint } from 'react-to-print';

/**
 * APIサーバーへのリクエストに使用するベースURL。
 * @type {string}
 */
const API_URL = '/api';

/**
 * @typedef {object} Employee
 * @property {number} employee_id - 社員ID
 * @property {string} employee_name - 社員名
 * @property {number} company_id - 会社ID
 */

/**
 * @typedef {object} Company
 * @property {number} company_id - 会社ID
 * @property {string} company_name - 会社名
 */

/**
 * @typedef {object} WorkRecord
 * @property {number} day - 日
 * @property {string} start_time - 開始時刻
 * @property {string} end_time - 終了時刻
 * @property {string} break_time - 休憩時間
 * @property {string} work_content - 作業内容
 */

/**
 * アプリケーションの最上位コンポーネント。
 * 全体の状態管理、API通信、主要コンポーネントのレンダリングを担当します。
 * @returns {JSX.Element} レンダリングされたAppコンポーネント。
 */
function App() {
  // --- State定義 ---

  /** @type {[Employee[], React.Dispatch<React.SetStateAction<Employee[]>>]} 社員リスト */
  const [employees, setEmployees] = useState([]);
  /** @type {[Company[], React.Dispatch<React.SetStateAction<Company[]>>]} 会社リスト */
  const [companies, setCompanies] = useState([]);
  /** @type {[number, React.Dispatch<React.SetStateAction<number>>]} 選択中の社員ID */
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(1);
  /** @type {[Date, React.Dispatch<React.SetStateAction<Date>>]} 表示対象の年月 */
  const [currentDate, setCurrentDate] = useState(new Date(2025, 9, 1));
  /** @type {[WorkRecord[], React.Dispatch<React.SetStateAction<WorkRecord[]>>]} 月間作業記録 */
  const [workRecords, setWorkRecords] = useState([]);
  /** @type {[Object<string, string>, React.Dispatch<React.SetStateAction<Object<string, string>>>]} 祝日データ */
  const [holidays, setHolidays] = useState({});
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} 月次特記事項 */
  const [specialNotes, setSpecialNotes] = useState("");
  /** @type {[string|null, React.Dispatch<React.SetStateAction<string|null>>]} 承認日 */
  const [approvalDate, setApprovalDate] = useState(null);
  /** @type {[WorkRecord[], React.Dispatch<React.SetStateAction<WorkRecord[]>>]} 作業記録の初期状態（変更検知用） */
  const [initialWorkRecords, setInitialWorkRecords] = useState([]);
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} 特記事項の初期状態（変更検知用） */
  const [initialSpecialNotes, setInitialSpecialNotes] = useState("");
  /** @type {[string|null, React.Dispatch<React.SetStateAction<string|null>>]} 承認日の初期状態（変更検知用） */
  const [initialApprovalDate, setInitialApprovalDate] = useState(null);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} 作業報告書の変更フラグ */
  const [isReportScreenDirty, setIsReportScreenDirty] = useState(false);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} 日報の更新フラグ */
  const [hasDailyReportBeenUpdated, setHasDailyReportBeenUpdated] = useState(false);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} データ読み込み中フラグ */
  const [isLoading, setIsLoading] = useState(true);
  /** @type {[string, React.Dispatch<React.SetStateAction<string>>]} 通知メッセージ */
  const [message, setMessage] = useState('');
  /** @type {[number|null, React.Dispatch<React.SetStateAction<number|null>>]} オーナー社員ID */
  const [ownerId, setOwnerId] = useState(null);
  /** @type {[string|null, React.Dispatch<React.SetStateAction<string|null>>]} オーナー社員名 */
  const [ownerName, setOwnerName] = useState(null);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} オーナーのレポート表示中フラグ */
  const [isViewingOwnerReport, setIsViewingOwnerReport] = useState(false);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} 日報モーダル表示状態 */
  const [isDailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} マスターモーダル表示状態 */
  const [isMasterModalOpen, setMasterModalOpen] = useState(false);
  /** @type {[boolean, React.Dispatch<React.SetStateAction<boolean>>]} 日報一覧モーダル表示状態 */
  const [isDailyReportListModalOpen, setDailyReportListModalOpen] = useState(false);
  /** @type {[object, React.Dispatch<React.SetStateAction<object>>]} マスター認証状態 */
  const [masterAuthState, setMasterAuthState] = useState({ isAuthenticated: false, isOwner: false, password: '', timestamp: null });
  /** @type {[string|null, React.Dispatch<React.SetStateAction<string|null>>]} 日報モーダルで選択された日付 */
  const [selectedDateForDailyReport, setSelectedDateForDailyReport] = useState(null);
  /** @type {React.MutableRefObject<undefined>} 印刷用コンポーネントへの参照 */
  const printComponentRef = useRef();

  /**
   * 副作用フック: マウント時に社員、会社、オーナー情報を取得します。
   */
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [empRes, compRes, ownerRes] = await Promise.all([
          axios.get(`${API_URL}/employees`),
          axios.get(`${API_URL}/companies`),
          axios.get(`${API_URL}/owner_info`),
        ]);
        setOwnerId(parseInt(ownerRes.data.owner_id, 10));
        setOwnerName(ownerRes.data.owner_name);
        setEmployees(empRes.data);
        setCompanies(compRes.data);
      } catch (error) {
        console.error("初期データの取得に失敗しました:", error);
        setMessage("サーバーとの通信に失敗しました。");
      }
    };
    fetchInitialData();
  }, []);

  /**
   * 副作用フック: 表示中のレポートがオーナーのものかを判定します。
   */
  useEffect(() => {
    if (ownerId !== null) {
      setIsViewingOwnerReport(selectedEmployeeId === ownerId);
    }
  }, [selectedEmployeeId, ownerId]);

  /**
   * 副作用フック: 選択中の社員IDまたは年月に変更があった場合に作業記録を再取得します。
   */
  useEffect(() => {
    if (!selectedEmployeeId) return;
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
        setWorkRecords(newRecords);
        setInitialWorkRecords(newRecords);
        setSpecialNotes(recordsRes.data.special_notes || "");
        setInitialSpecialNotes(recordsRes.data.special_notes || "");
        setApprovalDate(recordsRes.data.approval_date || null);
        setInitialApprovalDate(recordsRes.data.approval_date || null);
        setHolidays(holidaysRes.data);
        setIsReportScreenDirty(false);
        setHasDailyReportBeenUpdated(false);
      } catch (error) {
        console.error("作業記録の取得に失敗しました:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWorkData();
  }, [selectedEmployeeId, currentDate]);

  /**
   * 副作用フック: 作業記録や特記事項の変更を検知し、isReportScreenDirtyフラグを更新します。
   */
  useEffect(() => {
    const isDirty = JSON.stringify(workRecords) !== JSON.stringify(initialWorkRecords) ||
                    specialNotes !== initialSpecialNotes ||
                    approvalDate !== initialApprovalDate ||
                    hasDailyReportBeenUpdated;
    setIsReportScreenDirty(isDirty);
  }, [workRecords, specialNotes, approvalDate, initialWorkRecords, initialSpecialNotes, initialApprovalDate, hasDailyReportBeenUpdated]);
  
  // --- イベントハンドラ ---

  /**
   * オーナー情報とマスター認証状態をリフレッシュします。
   */
  const refreshOwnerAndAuth = async () => {
    try {
      const ownerRes = await axios.get(`${API_URL}/owner_info`);
      setOwnerId(parseInt(ownerRes.data.owner_id, 10));
      setOwnerName(ownerRes.data.owner_name);
      setMasterAuthState({ isAuthenticated: false, isOwner: false, password: '', timestamp: null });
    } catch (error) {
      console.error("オーナー情報の再取得に失敗しました:", error);
    }
  };

  /**
   * 月次レポートの承認を取り消します。
   */
  const handleCancelApproval = async () => {
    if (window.confirm('承認を取り消しますか？')) {
      try {
        const { year, month } = { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 };
        const response = await axios.post(`${API_URL}/monthly_reports/cancel_approval`, { employee_id: selectedEmployeeId, year, month });
        setApprovalDate(response.data.approval_date);
        setMessage(response.data.message);
      } catch (error) {
        setMessage(error.response?.data?.error || "承認の取り消しに失敗しました。");
      }
    }
  };

  /**
   * 作業記録と特記事項をサーバーに保存します。
   */
  const handleSave = async () => {
    try {
      const { year, month } = { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 };
      const response = await axios.post(`${API_URL}/work_records`, { employee_id: selectedEmployeeId, year, month, records: workRecords, special_notes: specialNotes });
      setMessage(response.data.message);
      setInitialWorkRecords(workRecords);
      setInitialSpecialNotes(specialNotes);
      setInitialApprovalDate(approvalDate);
      setIsReportScreenDirty(false);
      setHasDailyReportBeenUpdated(false);
    } catch (error) {
      setMessage("保存に失敗しました。");
    }
  };

  /**
   * 印刷ダイアログをトリガーします。
   */
  const handlePrint = useReactToPrint({ content: () => printComponentRef.current });

  /**
   * 月次レポートを承認します。
   */
  const handleApprove = async () => {
    if (isReportScreenDirty) {
      alert('変更が保存されていません。先に保存してください。');
      return;
    }
    if (window.confirm('この報告書を承認しますか？')) {
      try {
        const { year, month } = { year: currentDate.getFullYear(), month: currentDate.getMonth() + 1 };
        const response = await axios.post(`${API_URL}/monthly_reports/approve`, { employee_id: selectedEmployeeId, year, month });
        setApprovalDate(response.data.approval_date);
        setMessage(response.data.message);
      } catch (error) {
        setMessage(error.response?.data?.error || "承認に失敗しました。");
      }
    }
  };

  /**
   * 年月変更時のハンドラ。未保存の変更があれば確認します。
   * @param {Date} newDate - 新しい日付オブジェクト。
   */
  const handleChangeDate = (newDate) => {
    if (!isReportScreenDirty || window.confirm('変更が保存されていません。移動してもよろしいですか？')) {
      setCurrentDate(newDate);
    }
  };

  /**
   * 日報入力モーダルを開きます。
   * @param {string} date - 'yyyy-MM-dd'形式の日付文字列。
   */
  const handleOpenDailyReport = (date) => {
    setSelectedDateForDailyReport(date);
    setDailyReportModalOpen(true);
  };
  
  /**
   * マスターメンテナンスでのデータ更新をハンドリングします。
   * @param {Employee[]} updatedEmployees - 更新後の社員リスト。
   */
  const handleMasterUpdate = (updatedEmployees) => {
    setEmployees(updatedEmployees);
  };

  /**
   * マスターメンテナンス画面で社員が選択された際のハンドラ。
   * @param {number} employeeId - 選択された社員ID。
   */
  const handleEmployeeSelectInMaster = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setMasterModalOpen(false);
  };

  /**
   * マスターメンテナンスモーダルを開きます。認証タイムアウトをチェックします。
   */
  const handleOpenMaster = () => {
    const fiveMinutes = 0.1 * 60 * 1000;
    if (masterAuthState.timestamp && (new Date().getTime() - masterAuthState.timestamp > fiveMinutes)) {
      setMasterAuthState({ isAuthenticated: false, isOwner: false, password: '', timestamp: null });
    }
    setMasterModalOpen(true);
  };

  // --- 表示用データ準備 ---
  const selectedEmployee = employees.find(e => e.employee_id === selectedEmployeeId);
  const company = companies.find(c => c.company_id === selectedEmployee?.company_id);
  
  if (!employees.length || !companies.length) {
    return <div className="p-4">初期データを読み込み中です...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 font-sans">
      <ReportScreen
        selectedEmployee={selectedEmployee}
        company={company}
        currentDate={currentDate}
        workRecords={workRecords}
        holidays={holidays}
        specialNotes={specialNotes}
        approvalDate={approvalDate}
        ownerName={ownerName}
        isLoading={isLoading}
        message={message}
        isReadOnly={!isViewingOwnerReport}
        isReportScreenDirty={isReportScreenDirty}
        onDateChange={handleChangeDate}
        onWorkRecordsChange={setWorkRecords}
        onSpecialNotesChange={setSpecialNotes}
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
      />
      <DailyReportModal
        isOpen={isDailyReportModalOpen}
        onRequestClose={() => setDailyReportModalOpen(false)}
        employeeId={selectedEmployeeId}
        employeeName={selectedEmployee?.employee_name}
        date={selectedDateForDailyReport}
        workRecord={workRecords.find(r => selectedDateForDailyReport && r.day === new Date(selectedDateForDailyReport).getDate())}
        onSave={(updatedWorkRecord) => {
            const updatedRecords = workRecords.map(r => r.day === updatedWorkRecord.day ? {...r, ...updatedWorkRecord} : r);
            setWorkRecords(updatedRecords);
        }}
        onReportUpdate={() => setHasDailyReportBeenUpdated(true)}
      />
      <MasterModal
        isOpen={isMasterModalOpen}
        onRequestClose={() => {
          refreshOwnerAndAuth();
          setMasterModalOpen(false);
        }}
        onMasterUpdate={handleMasterUpdate}
        onSelectEmployee={handleEmployeeSelectInMaster}
        companies={companies}
        auth={masterAuthState}
        setAuth={setMasterAuthState}
        ownerId={ownerId}
      />
      <DailyReportListModal
        isOpen={isDailyReportListModalOpen}
        onRequestClose={() => setDailyReportListModalOpen(false)}
        employeeId={selectedEmployeeId}
        year={currentDate.getFullYear()}
        month={currentDate.getMonth() + 1}
      />
      <div className="hidden">
        <PrintLayout ref={printComponentRef} employee={selectedEmployee} company={company} currentDate={currentDate} workRecords={workRecords} holidays={holidays} specialNotes={specialNotes} />
      </div>
    </div>
  );
}

export default App;
