/**
 * 指定された年月のカレンダーデータを生成します。
 * 各日付には、日付情報、曜日、祝日情報が含まれます。
 *
 * @param {number} year - 対象の年 (例: 2025)。
 * @param {number} month - 対象の月 (1から12)。
 * @param {Map<string, string>} holidays - 'YYYY-MM-DD' をキー、祝日名を値とする祝日のMapオブジェクト。
 * @returns {Array<{date: string, year: number, month: number, day: number, weekday: string, isHoliday: boolean, holidayName: string}>}
 *          1ヶ月分の日付オブジェクトの配列。各オブジェクトには日付に関する詳細情報が含まれます。
 */
export const generateCalendar = (year, month, holidays) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const calendar = [];
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        calendar.push({
            date: dateStr,
            year,
            month,
            day,
            weekday: weekdays[date.getDay()],
            isHoliday: holidays.has(dateStr),
            holidayName: holidays.get(dateStr) || '',
        });
    }

    return calendar;
};
