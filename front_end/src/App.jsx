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
 * 開発環境 (vite dev) では vite.config.js のプロキシ設定によってバックエンドに転送される。
 * 本番環境 (flask serve) ではフロントエンドとAPIが同じオリジンから配信されるため、
 * スムーズに動作する相対パスが最適。
 * @type {string}
 */
const API_URL = '/api';

/**
 * アプリケーションの最上位コンポーネント。
 * 全体の状態管理、APIとのデータ通信、主要コンポーネントのレンダリングを担当します。
 * @returns {JSX.Element} レンダリングされたAppコンポーネント。
 */
function App() {
  // --- State定義 ---

  /** @type {[Array<object>, Function]} 社員リストの状態管理 */
  const [employees, setEmployees] = useState([]);
  /** @type {[Array<object>, Function]} 会社リストの状態管理 */
  const [companies, setCompanies] = useState([]);

  /** @type {[number, Function]} 選択されている社員IDの状態管理 (初期値: 1) */
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(1);
  /** @type {[Date, Function]} 表示対象の年月の状態管理 (初期値: 2025年10月) */
  const [currentDate, setCurrentDate] = useState(new Date('2025-10-01'));

  /** @type {[Array<object>, Function]} 1ヶ月分の作業記録の状態管理 */
  const [workRecords, setWorkRecords] = useState([]);
  /** @type {[object, Function]} 祝日データの状態管理 (例: {'2025-01-01': '元日'}) */
  const [holidays, setHolidays] = useState({});
  /** @type {[string, Function]} 月次の特記事項の状態管理 */
  const [specialNotes, setSpecialNotes] = useState("");
  /** @type {[string|null, Function]} 承認日の状態管理 */
  const [approvalDate, setApprovalDate] = useState(null);
  /** @type {[object|null, Function]} 月次集計データの状態管理 */
  const [monthlySummary, setMonthlySummary] = useState(null);
  /** @type {[Array<object>, Function]} 請求先・案件別集計データの状態管理 */
  const [projectSummary, setProjectSummary] = useState([]);

  /** @type {[Array<object>, Function]} 作業記録の初期状態 */
  const [initialWorkRecords, setInitialWorkRecords] = useState([]);
  /** @type {[string, Function]} 特記事項の初期状態 */
  const [initialSpecialNotes, setInitialSpecialNotes] = useState("");
  /** @type {[string|null, Function]} 承認日の初期状態 */
  const [initialApprovalDate, setInitialApprovalDate] = useState(null);
  /** @type {[object|null, Function]} 月次集計データの初期状態 */
  const [initialMonthlySummary, setInitialMonthlySummary] = useState(null);
  /** @type {[boolean, Function]} 作業報告書画面が変更されたかどうかの状態管理 */
  const [isReportScreenDirty, setIsReportScreenDirty] = useState(false);
  /** @type {[boolean, Function]} 日報が更新されたかどうかの状態管理 */
  const [hasDailyReportBeenUpdated, setHasDailyReportBeenUpdated] = useState(false);

  /** @type {[boolean, Function]} データ読み込み中のフラグの状態管理 */
  const [isLoading, setIsLoading] = useState(true);
  /** @type {[string, Function]} ユーザーへの通知メッセージの状態管理 */
  const [message, setMessage] = useState('');
  /** @type {[number|null, Function]} オーナー社員IDの状態管理 */
  const [ownerId, setOwnerId] = useState(null);
  /** @type {[string|null, Function]} オーナー社員名の状態管理 */
  const [ownerName, setOwnerName] = useState(null);
  /** @type {[boolean, Function]} 表示中のレポートがオーナーのものかどうかの状態管理 */
  const [isViewingOwnerReport, setIsViewingOwnerReport] = useState(false);
  
  /** @type {[boolean, Function]} 日報入力モーダルの表示状態 */
  const [isDailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  /** @type {[boolean, Function]} マスターメンテナンスモーダルの表示状態 */
  const [isMasterModalOpen, setMasterModalOpen] = useState(false);
  /** @type {[boolean, Function]} 日報一覧モーダルの表示状態 */
  const [isDailyReportListModalOpen, setDailyReportListModalOpen] = useState(false);

  /** @type {[object, Function]} マスターメンテナンスの認証状態 */
  const [masterAuthState, setMasterAuthState] = useState({
    isAuthenticated: false,
    isOwner: false,
    password: '',
    timestamp: null,
  });

  /** @type {[string|null, Function]} 日報モーダルで選択された日付の状態管理 */
  const [selectedDateForDailyReport, setSelectedDateForDailyReport] = useState(null);

  /** @type {React.MutableRefObject<undefined>} 印刷用コンポーネントへの参照 */
  const printComponentRef = useRef();

  // --- データ取得関連 (副作用フック) ---

  /**
   * コンポーネントのマウント時に初期データをフェッチします。
   * 社員、会社、オーナー情報をサーバーから取得します。
   */
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  /**
   * selectedEmployeeIdまたはownerIdが変更されたときに、
   * 表示中のレポートがオーナーのものかどうかを判定します。
   */
  useEffect(() => {
    if (ownerId !== null) {
      setIsViewingOwnerReport(selectedEmployeeId === ownerId);
    }
  }, [selectedEmployeeId, ownerId]);

  /**
   * selectedEmployeeIdまたはcurrentDateが変更されたときに、
   * 対応する作業記録と祝日データをフェッチします。
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

        const newSpecialNotes = recordsRes.data.special_notes || "";
        const newApprovalDate = recordsRes.data.approval_date || null;
        const newMonthlySummary = recordsRes.data.monthly_summary || {};
        const newProjectSummary = recordsRes.data.project_summary || []; // 追加

        // APIから 'substitute_holidays' が返されない場合に備えてデフォルト値を設定
        if (newMonthlySummary.substitute_holidays === undefined) {
          newMonthlySummary.substitute_holidays = 0;
        }

        setWorkRecords(newRecords);
        setInitialWorkRecords(newRecords);
        setSpecialNotes(newSpecialNotes);
        setInitialSpecialNotes(newSpecialNotes);
        setApprovalDate(newApprovalDate);
        setInitialApprovalDate(newApprovalDate);
        setMonthlySummary(newMonthlySummary);
        setInitialMonthlySummary(newMonthlySummary);
        setProjectSummary(newProjectSummary); // 追加
        setHolidays(holidaysRes.data);
        setIsReportScreenDirty(false);
        setHasDailyReportBeenUpdated(false);
        
      } catch (error) {
        console.error("作業記録の取得に失敗しました:", error);
        setMessage("作業記録の取得に失敗しました。");
        const daysInMonth = getDaysInMonth(currentDate);
        const emptyRecords = Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1, work_content: '', start_time: '', end_time: '', break_time: '00:00'
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
  }, [selectedEmployeeId, currentDate]);

  /**
   * workRecordsまたはspecialNotesが変更されたときに、
   * isReportScreenDirtyフラグを更新します。
   */
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

  /**
   * オーナー情報とマスター認証の状態をリフレッシュします。
   * num.idが変更された後に、UIの状態を正しく同期させるために使います。
   * @async
   */
  const refreshOwnerAndAuth = async () => {
    try {
      const ownerRes = await axios.get(`${API_URL}/owner_info`);
      setOwnerId(parseInt(ownerRes.data.owner_id, 10));
      setOwnerName(ownerRes.data.owner_name);
      setMasterAuthState({
        isAuthenticated: false,
        isOwner: false,
        password: '',
        timestamp: null,
      });
    } catch (error) {
      console.error("オーナー情報の再取得に失敗しました:", error);
      setMessage("オーナー情報の更新に失敗しました。");
    }
  };

  /**
   * 月次レポートの承認を取り消します。
   * @async
   */
  const handleCancelApproval = async () => {
    if (window.confirm('承認を取り消しますか？')) {
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const payload = {
          employee_id: selectedEmployeeId,
          year,
          month,
        };
        const response = await axios.post(`${API_URL}/monthly_reports/cancel_approval`, payload);
        setApprovalDate(response.data.approval_date);
        setMessage(response.data.message);
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error("承認の取り消しに失敗しました:", error);
        setMessage(error.response?.data?.error || "承認の取り消しに失敗しました。");
      }
    }
  };

  /**
   * 作業記録と特記事項をサーバーに保存します。
   * @async
   */
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

      // 保存が成功したので、初期状態を現在の状態に更新し、dirtyフラグをリセット
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

  /**
   * 印刷ダイアログをトリガーする関数。
   */
  const handlePrint = useReactToPrint({
    content: () => printComponentRef.current,
  });

  /**
   * 月次レポートを承認します。
   * @async
   */
  const handleApprove = async () => {
    if (isReportScreenDirty) {
      alert('変更が保存されていません。先に保存してください。');
      return;
    }
    if (window.confirm('この報告書を承認しますか？')) {
      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const payload = {
          employee_id: selectedEmployeeId,
          year,
          month,
        };
        const response = await axios.post(`${API_URL}/monthly_reports/approve`, payload);
        setApprovalDate(response.data.approval_date);
        setMessage(response.data.message);
        setTimeout(() => setMessage(''), 3000);
      } catch (error) {
        console.error("承認に失敗しました:", error);
        setMessage(error.response?.data?.error || "承認に失敗しました。");
      }
    }
  };

  /**
   * 年月が変更されたときのハンドラ。
   * 未保存の変更がある場合は確認ダイアログを表示します。
   * @param {Date} newDate - 新しい日付オブジェクト。
   */
  const handleChangeDate = (newDate) => {
    if (isReportScreenDirty) {
      if (window.confirm('変更が保存されていません。移動してもよろしいですか？')) {
        setCurrentDate(newDate);
      }
    } else {
      setCurrentDate(newDate);
    }
  };

  /**
   * 月次集計データのフィールドを更新します。
   * @param {string} field - 更新するフィールド名。
   * @param {string | number} value - 新しい値。
   */
  const handleMonthlySummaryChange = (field, value) => {
    setMonthlySummary(prev => ({ ...prev, [field]: value }));
  };

  /**
   * 日報入力モーダルを開きます。
   * @param {string} date - 'YYYY-MM-DD'形式の日付文字列。
   */
  const handleOpenDailyReport = (date) => {
    setSelectedDateForDailyReport(date);
    setDailyReportModalOpen(true);
  };
  
  /**
   * マスターメンテナンスモーダルでのデータ更新をハンドリングします。
   * @param {Array<object>} updatedEmployees - 更新後の社員リスト。
   */
  const handleMasterUpdate = (updatedEmployees) => {
    setEmployees(updatedEmployees);
  };

  /**
   * マスターメンテナンス画面で社員が選択された際のハンドラ。
   * @param {number} employeeId - 選択された社員のID。
   */
  const handleEmployeeSelectInMaster = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setMasterModalOpen(false);
  };

  /**
   * マスターメンテナンスモーダルを開きます。
   * 5分間の認証タイムアウトをチェックします。
   */
  const handleOpenMaster = () => {
/*    const fiveMinutes = 5 * 60 * 1000; */
    const fiveMinutes = 0.1 * 60 * 1000;
    if (masterAuthState.timestamp && (new Date().getTime() - masterAuthState.timestamp > fiveMinutes)) {
      /* alert('認証の有効期限が切れました。再度認証してください。'); */
      setMasterAuthState({ isAuthenticated: false, isOwner: false, password: '', timestamp: null });
    }
    setMasterModalOpen(true);
  };

  // --- レンダリングのための表示用データ準備 ---
  const selectedEmployee = employees.find(e => e.employee_id === selectedEmployeeId);
  const company = companies.find(c => c.company_id === selectedEmployee?.company_id);
  
  if (!employees.length || !companies.length) {
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
        projectSummary={projectSummary} // 追加
        approvalDate={approvalDate}
        isLoading={isLoading}
        message={message}
        isReadOnly={!isViewingOwnerReport}
        isReportScreenDirty={isReportScreenDirty}
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
      />
      
      <MasterModal
        isOpen={isMasterModalOpen}
        onRequestClose={() => {
          refreshOwnerAndAuth();
          setMasterModalOpen(false);
        }}
        onMasterUpdate={handleMasterUpdate}
        onSelectEmployee={handleEmployeeSelectInMaster}
        selectedEmployeeId={selectedEmployeeId}
        companies={companies}
        auth={masterAuthState}
        setAuth={setMasterAuthState}
        ownerId={ownerId}
        ownerName={ownerName}
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
          projectSummary={projectSummary} // 追加
          approvalDate={approvalDate}
        />
      </div>
    </div>
  );
}

export default App;
