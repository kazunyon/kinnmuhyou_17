/**
 * "HH:MM" 形式の文字列を分単位の数値に変換します。
 * 不正な形式の場合は null を返します。
 * @param {string} timeStr - "HH:MM" 形式の時間文字列
 * @returns {number|null} 分単位の数値、または null
 */
export const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string' || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
        return null;
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return hours * 60 + minutes;
    }
    return null;
};

/**
 * 分単位の数値を "HH:MM" 形式の文字列に変換します。
 * @param {number} totalMinutes - 分単位の数値
 * @returns {string} "HH:MM" 形式の時間文字列
 */
export const minutesToTime = (totalMinutes) => {
    if (totalMinutes === null || isNaN(totalMinutes) || totalMinutes < 0) {
        return '';
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
};

/**
 * 時間の入力をフォーマットします (例: 9 -> 9:00, 930 -> 9:30)
 * @param {string} input - ユーザーの入力
 * @returns {string} フォーマットされた時間文字列
 */
export const formatTime = (input) => {
    if (!input) return '';
    const cleanInput = input.replace(/[^0-9]/g, '');
    
    if (cleanInput.length <= 2) {
        return `${cleanInput}:00`;
    }
    if (cleanInput.length === 3) {
        return `${cleanInput.slice(0, 1)}:${cleanInput.slice(1)}`;
    }
    if (cleanInput.length >= 4) {
        return `${cleanInput.slice(0, 2)}:${cleanInput.slice(2, 4)}`;
    }
    return input;
};

/**
 * 出退社時刻の入力が有効か検証します (00:00 - 23:45)
 * @param {string} timeStr - HH:MM形式の時刻
 * @returns {boolean} 有効な場合は true
 */
export const validateTimeInput = (timeStr) => {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return false;
    const [h, m] = timeStr.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m < 60 && m % 15 === 0;
};

/**
 * 休憩時間の入力が有効か検証します (0:00 - 5:00)
 * @param {string} timeStr - H:MM形式の時刻
 * @returns {boolean} 有効な場合は true
 */
export const validateRestTimeInput = (timeStr) => {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return false;
    const totalMinutes = timeToMinutes(timeStr);
    return totalMinutes >= 0 && totalMinutes <= 300; // 5 hours * 60 minutes
};
