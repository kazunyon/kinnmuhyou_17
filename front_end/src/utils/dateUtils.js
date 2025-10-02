/**
 * 指定された年月のカレンダーデータを生成します。
 * @param {number} year - 年
 * @param {number} month - 月 (1-12)
 * @param {Map} holidays - YYYY-MM-DD をキー、祝日名を値とするMap
 * @returns {Array<Object>} 1ヶ月分の日付オブジェクトの配列
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
