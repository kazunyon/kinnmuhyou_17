import React from 'react';

/**
 * 日報一覧を印刷するためのレイアウトコンポーネント。
 * このコンポーネントは `react-to-print` から使用されることを想定しており、
 * 画面上には表示されず、印刷時のみレンダリングされます。
 * @param {object} props - コンポーネントのプロパティ。
 * @param {Array<object>} props.reports - 印刷する日報データの配列。
 * @param {number} props.year - 対象の年。
 * @param {number} props.month - 対象の月。
 * @param {React.Ref} ref - `react-to-print` が印刷対象を識別するためのref。
 * @returns {JSX.Element|null} 印刷用のレイアウトを持つJSX要素、またはレポートがない場合はnull。
 */
const DailyReportListPrint = React.forwardRef((props, ref) => {
  const { reports, year, month } = props;

  /**
   * レポートデータに基づいてテーブル行のCSSクラス名を返します。
   * @param {object} report - 表示するレポートオブジェクト。
   * @returns {string} Tailwind CSSのクラス名。
   */
  const getRowClassName = (report) => {
    if (report.isHoliday || report.dayOfWeek === '日') {
      return 'bg-red-100 align-top';
    }
    if (report.dayOfWeek === '土') {
      return 'bg-blue-100 align-top';
    }
    return 'align-top';
  };

  if (!reports || reports.length === 0) {
    return null;
  }

  return (
    <div ref={ref} className="p-4 bg-white text-black print-container">
      <h2 className="text-xl font-bold text-center mb-4 print-title">日報一覧 ({year}年{month}月)</h2>
      <table className="w-full text-left border-collapse text-xs report-table">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border border-black w-[4%]">日付</th>
            <th className="p-2 border border-black w-[4%]">曜日</th>
            <th className="p-2 border border-black w-[7%]">作業時間</th>
            <th className="p-2 border border-black w-[30.6%]">作業内容</th>
            <th className="p-2 border border-black w-[13.6%]">問題点</th>
            <th className="p-2 border border-black w-[13.6%]">課題</th>
            <th className="p-2 border border-black w-[13.6%]">明日する内容</th>
            <th className="p-2 border border-black w-[13.6%]">所感</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.date} className={getRowClassName(report)}>
              <td className="p-2 border border-black text-center">{report.date}</td>
              <td className="p-2 border border-black text-center">{report.dayOfWeek}</td>
              <td className="p-2 border border-black text-center">{report.workTime}</td>
              <td className="p-2 border border-black whitespace-pre-wrap">{report.work_summary}</td>
              <td className="p-2 border border-black whitespace-pre-wrap">{report.problems}</td>
              <td className="p-2 border border-black whitespace-pre-wrap">{report.challenges}</td>
              <td className="p-2 border border-black whitespace-pre-wrap">{report.tomorrow_tasks}</td>
              <td className="p-2 border border-black whitespace-pre-wrap">{report.thoughts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

DailyReportListPrint.displayName = 'DailyReportListPrint';

export default DailyReportListPrint;