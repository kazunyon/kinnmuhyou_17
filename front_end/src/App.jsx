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
 */
const API_URL = '/api';

/**
 * アプリケーションの最上位コンポーネント。
 * 全体の状態管理、APIとのデータ通信、主要コンポーネントのレンダリングを担当する。
 */
function App() {
  // --- State定義 ---

  // マスターデータ
  const [employees, setEmployees] = useState([]); // 社員リスト
  const [companies, setCompanies] = useState([]); // 会社リスト

  // ユーザーの選択状態
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(1); // 選択中の社員ID
  const [currentDate, setCurrentDate] = useState(new Date(2025, 9, 1)); // 表示対象の年月 (初期値: 令和7年10月)

  // 表示データ
  const [workRecords, setWorkRecords] = useState([]); // 1ヶ月分の作業記録
  const [holidays, setHolidays] = useState({}); // 祝日データ (例: {'2025-01-01': '元日'})
  const [specialNotes, setSpecialNotes] = useState(""); // 月次の特記事項

  // UIの状態
  const [isLoading, setIsLoading] = useState(true); // データ読み込み中のフラグ
  const [message, setMessage] = useState(''); // 保存成功時などに表示するメッセージ
  
  // モーダルウィンドウの開閉状態
  const [isDailyReportModalOpen, setDailyReportModalOpen] = useState(false); // 日報入力モーダル
  const [isMasterModalOpen, setMasterModalOpen] = useState(false); // マスターメンテナンスモーダル
  const [isDailyReportListModalOpen, setDailyReportListModalOpen] = useState(false); // 日報一覧モーダル

  // 日報モーダルに渡す日付
  const [selectedDateForDailyReport, setSelectedDateForDailyReport] = useState(null);

  // 印刷用コンポーネントへの参照
  const printComponentRef = useRef();

  // --- データ取得関連 (副作用フック) ---

  /**
   * コンポーネントのマウント時に一度だけ実行される。
   * 社員や会社などの基本的なマスターデータをサーバーから取得する。
   */
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // 社員リストと会社リストを並行して取得
        const [empRes, compRes] = await Promise.all([
          axios.get(`${API_URL}/employees`),
          axios.get(`${API_URL}/companies`),
        ]);
        setEmployees(empRes.data);
        setCompanies(compRes.data);
        // 社員リスト取得後、最初の社員を選択状態にする
        if (empRes.data.length > 0) {
          setSelectedEmployeeId(empRes.data[0].employee_id);
        }
      } catch (error) {
        console.error("初期データの取得に失敗しました:", error);
        setMessage("サーバーとの通信に失敗しました。");
      }
    };
    fetchInitialData();
  }, []); // 空の依存配列は、マウント時に一度だけ実行されることを意味する

  /**
   * 選択中の社員ID (selectedEmployeeId) または年月 (currentDate) が変更されたときに実行される。
   * 該当する年月の作業記録と、該当年の祝日データをサーバーから取得する。
   */
  useEffect(() => {
    if (!selectedEmployeeId) return; // 社員が選択されていなければ何もしない

    const fetchWorkData = async () => {
      setIsLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      try {
        // 作業記録と祝日データを並行して取得
        const [recordsRes, holidaysRes] = await Promise.all([
           axios.get(`${API_URL}/work_records/${selectedEmployeeId}/${year}/${month}`),
           axios.get(`${API_URL}/holidays/${year}`)
        ]);
        
        // --- APIから取得したデータをUIで扱いやすい形式に整形 ---
        // 1. APIからの日次記録を日付(day)をキーにしたMapに変換し、高速アクセスを可能にする
        const recordsMap = new Map(recordsRes.data.records.map(r => [r.day, r]));
        // 2. その月の日数分の配列を生成する
        const daysInMonth = getDaysInMonth(currentDate);
        const newRecords = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          // 3. Mapに記録があればそのデータを、なければ空の初期データを設定する
          return recordsMap.get(day) || { day, work_content: '', start_time: '', end_time: '', break_time: '00:00' };
        });

        setWorkRecords(newRecords);
        setSpecialNotes(recordsRes.data.special_notes || "");
        setHolidays(holidaysRes.data);
        
      } catch (error) {
        console.error("作業記録の取得に失敗しました:", error);
        setMessage("作業記録の取得に失敗しました。");
        // エラーが発生した場合でも、テーブルが崩れないように空の記録で初期化する
        const daysInMonth = getDaysInMonth(currentDate);
        const emptyRecords = Array.from({ length: daysInMonth }, (_, i) => ({
          day: i + 1, work_content: '', start_time: '', end_time: '', break_time: '00:00'
        }));
        setWorkRecords(emptyRecords);
        setSpecialNotes("");
      } finally {
        setIsLoading(false); // 成功・失敗にかかわらずローディング状態を解除
      }
    };

    fetchWorkData();
  }, [selectedEmployeeId, currentDate]); // 依存配列:これらの値が変更された時だけ再実行
  
  // --- イベントハンドラ ---

  /**
   * 「保存」ボタンがクリックされたときに実行される。
   * 現在の作業記録と特記事項をサーバーに送信する。
   */
  const handleSave = async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const payload = {
        employee_id: selectedEmployeeId,
        year,
        month,
        // 何か一つでも入力がある行のみをフィルタリングして送信データ量を削減
        records: workRecords.filter(r => r.start_time || r.end_time || r.work_content),
        special_notes: specialNotes
      };
      const response = await axios.post(`${API_URL}/work_records`, payload);
      setMessage(response.data.message);
      setTimeout(() => setMessage(''), 3000); // 3秒後にメッセージを自動的に消去
    } catch (error) {
      console.error("保存に失敗しました:", error);
      setMessage("保存に失敗しました。");
    }
  };

  /**
   * 「印刷」ボタンがクリックされたときに実行される。
   * react-to-printライブラリを使用して印刷ダイアログをトリガーする。
   */
  const handlePrint = useReactToPrint({
    content: () => printComponentRef.current, // 印刷するコンポーネントの参照を返す
  });

  /**
   * ReportTableの行がダブルクリックされたときに呼び出される。
   * 日報入力モーダルを開く。
   * @param {string} date - 'YYYY-MM-DD'形式の日付文字列
   */
  const handleOpenDailyReport = (date) => {
    setSelectedDateForDailyReport(date);
    setDailyReportModalOpen(true);
  };
  
  /**
   * マスターメンテナンスモーダルでデータが更新されたときに呼び出されるコールバック。
   * @param {Array} updatedEmployees - 更新後の社員リスト
   */
  const handleMasterUpdate = (updatedEmployees) => {
    setEmployees(updatedEmployees);
  };


  // --- レンダリングのための表示用データ準備 ---
  const selectedEmployee = employees.find(e => e.employee_id === selectedEmployeeId);
  const company = companies.find(c => c.company_id === selectedEmployee?.company_id);
  
  // 初期データの読み込みが完了するまでローディング表示
  if (!employees.length || !companies.length) {
    return <div className="p-4">初期データを読み込み中です...</div>;
  }

  // --- レンダリング ---
  return (
    <div className="bg-gray-100 min-h-screen p-4 font-sans text-10pt">
      {/* メイン画面コンポーネント */}
      <ReportScreen
        // 表示用データ
        employees={employees}
        selectedEmployee={selectedEmployee}
        company={company}
        currentDate={currentDate}
        workRecords={workRecords}
        holidays={holidays}
        specialNotes={specialNotes}
        isLoading={isLoading}
        message={message}
        // イベントハンドラ (状態を変更する関数)
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

      {/* 日報入力モーダル */}
      <DailyReportModal
        isOpen={isDailyReportModalOpen}
        onRequestClose={() => setDailyReportModalOpen(false)}
        employeeId={selectedEmployeeId}
        employeeName={selectedEmployee?.employee_name}
        date={selectedDateForDailyReport}
        // 選択された日付に該当する作業記録を探して渡す
        workRecord={workRecords.find(r => selectedDateForDailyReport && r.day === new Date(selectedDateForDailyReport).getDate())}
        onSave={(updatedWorkRecord) => {
            // モーダルで作業時間が更新された場合、メイン画面のworkRecords stateにも反映する
            const updatedRecords = workRecords.map(r => 
                r.day === updatedWorkRecord.day ? {...r, ...updatedWorkRecord} : r
            );
            setWorkRecords(updatedRecords);
        }}
      />
      
      {/* マスターメンテナンスモーダル */}
      <MasterModal
        isOpen={isMasterModalOpen}
        onRequestClose={() => setMasterModalOpen(false)}
        employees={employees}
        onMasterUpdate={handleMasterUpdate}
      />

      {/* 日報一覧モーダル */}
      <DailyReportListModal
        isOpen={isDailyReportListModalOpen}
        onRequestClose={() => setDailyReportListModalOpen(false)}
        employeeId={selectedEmployeeId}
        year={currentDate.getFullYear()}
        month={currentDate.getMonth() + 1}
      />
      
      {/* 印刷用レイアウトコンポーネント (画面上には表示されない) */}
      <div style={{ visibility: 'hidden', height: 0, overflow: 'hidden' }}>
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