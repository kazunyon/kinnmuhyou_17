import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { format, getDaysInMonth } from 'date-fns';
import ReportScreen from './components/ReportScreen';
import DailyReportModal from './components/DailyReportModal';
import MasterModal from './components/MasterModal';
import DailyReportListModal from './components/DailyReportListModal';
import PrintLayout from './components/PrintLayout';
import { useReactToPrint } from 'react-to-print';

// APIのベースURL
// 開発環境(vite dev)ではvite.config.jsのプロキシ設定が、
// 本番環境(flask serve)では同じオリジンからの配信が使われるため、相対パスが最適。
const API_URL = '/api';

function App() {
  // --- State定義 ---
  const [employees, setEmployees] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(1); // 初期社員ID
  const [currentDate, setCurrentDate] = useState(new Date(2025, 9, 1)); // 令和7年10月
  const [workRecords, setWorkRecords] = useState([]);
  const [holidays, setHolidays] = useState({});
  const [specialNotes, setSpecialNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  // モーダル関連
  const [isDailyReportModalOpen, setDailyReportModalOpen] = useState(false);
  const [isMasterModalOpen, setMasterModalOpen] = useState(false);
  const [isDailyReportListModalOpen, setDailyReportListModalOpen] = useState(false);
  const [selectedDateForDailyReport, setSelectedDateForDailyReport] = useState(null);

  const printComponentRef = useRef();

  // --- データ取得関連 ---
  useEffect(() => {
    // 初期データをまとめて取得
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [empRes, compRes] = await Promise.all([
          axios.get(`${API_URL}/employees`),
          axios.get(`${API_URL}/companies`),
        ]);
        setEmployees(empRes.data);
        setCompanies(compRes.data);
        if (empRes.data.length > 0) {
          setSelectedEmployeeId(empRes.data[0].employee_id);
        }
      } catch (error) {
        console.error("初期データの取得に失敗しました:", error);
        setMessage("サーバーとの通信に失敗しました。");
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    // 年月や社員が変更されたら、該当の作業記録と祝日を取得
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
        
        // APIからのデータをUIで使いやすい形に整形
        const recordsMap = new Map(recordsRes.data.records.map(r => [r.day, r]));
        const daysInMonth = getDaysInMonth(currentDate);
        const newRecords = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          return recordsMap.get(day) || { day, work_content: '', start_time: '', end_time: '', break_time: '00:00' };
        });

        setWorkRecords(newRecords);
        setSpecialNotes(recordsRes.data.special_notes || "");
        setHolidays(holidaysRes.data);
        
      } catch (error) {
        console.error("作業記録の取得に失敗しました:", error);
        setMessage("作業記録の取得に失敗しました。");
        // エラー時も空のテーブルを表示するため初期化
        const daysInMonth = getDaysInMonth(currentDate);
        const emptyRecords = Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1, work_content: '', start_time: '', end_time: '', break_time: '00:00'
        }));
        setWorkRecords(emptyRecords);
        setSpecialNotes("");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkData();
  }, [selectedEmployeeId, currentDate]);
  
  // --- イベントハンドラ ---
  const handleSave = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const payload = {
        employee_id: selectedEmployeeId,
        year,
        month,
        records: workRecords.filter(r => r.start_time || r.end_time || r.work_content), // 入力がある行のみ送信
        special_notes: specialNotes
      };
      const response = await axios.post(`${API_URL}/work_records`, payload);
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000); // 3秒後にメッセージを消す
    } catch (error) {
      console.error("保存に失敗しました:", error);
      setMessage("保存に失敗しました。");
    }
  };

  const handlePrint = useReactToPrint({
    content: () => printComponentRef.current,
  });

  const handleOpenDailyReport = (date) => {
    setSelectedDateForDailyReport(date);
    setDailyReportModalOpen(true);
  };
  
  const handleMasterUpdate = (updatedEmployees) => {
    setEmployees(updatedEmployees);
  };


  // --- 表示用データ ---
  const selectedEmployee = employees.find(e => e.employee_id === selectedEmployeeId);
  const company = companies.find(c => c.company_id === selectedEmployee?.company_id);
  
  if (!employees.length || !companies.length) {
    return <div className="p-4">初期データを読み込み中です...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 font-sans text-10pt">
      <ReportScreen
        employees={employees}
        selectedEmployee={selectedEmployee}
        company={company}
        currentDate={currentDate}
        workRecords={workRecords}
        holidays={holidays}
        specialNotes={specialNotes}
        isLoading={isLoading}
        message={message}
        onEmployeeChange={(id) => setSelectedEmployeeId(parseInt(id))}
        onDateChange={setCurrentDate}
        onWorkRecordsChange={setWorkRecords}
        onSpecialNotesChange={setSpecialNotes}
        onSave={handleSave}
        onPrint={handlePrint}
        onOpenDailyReportList={() => setDailyReportListModalOpen(true)}
        onOpenMaster={() => setMasterModalOpen(true)}
        onRowClick={(record) => {
          const dateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), record.day), 'yyyy-MM-dd');
          handleOpenDailyReport(dateStr);
        }}
      />

      <DailyReportModal
        isOpen={isDailyReportModalOpen}
        onRequestClose={() => setDailyReportModalOpen(false)}
        employeeId={selectedEmployeeId}
        date={selectedDateForDailyReport}
        workRecord={workRecords.find(r => selectedDateForDailyReport && r.day === new Date(selectedDateForDailyReport).getDate())}
        onSave={(updatedWorkRecord) => {
            // モーダルで更新された作業時間をメイン画面に反映
            const updatedRecords = workRecords.map(r => 
                r.day === updatedWorkRecord.day ? {...r, ...updatedWorkRecord} : r
            );
            setWorkRecords(updatedRecords);
        }}
      />
      
      <MasterModal
        isOpen={isMasterModalOpen}
        onRequestClose={() => setMasterModalOpen(false)}
        employees={employees}
        onMasterUpdate={handleMasterUpdate}
      />

      <DailyReportListModal
        isOpen={isDailyReportListModalOpen}
        onRequestClose={() => setDailyReportListModalOpen(false)}
        employeeId={selectedEmployeeId}
        year={currentDate.getFullYear()}
        month={currentDate.getMonth() + 1}
      />
      
      {/* 印刷用コンポーネント（画面上には表示されない） */}
      <div style={{ display: "none" }}>
        <PrintLayout
          ref={printComponentRef}
          employee={selectedEmployee}
          company={company}
          currentDate={currentDate}
          workRecords={workRecords}
          holidays={holidays}
        />
      </div>
    </div>
  );
}

export default App;
