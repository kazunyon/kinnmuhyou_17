/**
 * "HH:MM" 形式の時間文字列を分単位の数値に変換します。
 * '24:00'までの時間を正しく扱います。
 *
 * @param {string} timeStr - "HH:MM" 形式の時間文字列。
 * @returns {number|null} 変換された分単位の数値。入力が不正な形式の場合はnullを返します。
 */
export const timeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string' || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
        return null;
    }
    const [hours, minutes] = timeStr.split(':').map(Number);

    // 24:00 の特別扱い
    if (hours === 24 && minutes === 0) {
        return 24 * 60;
    }

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
        return hours * 60 + minutes;
    }
    return null;
};

/**
 * 分単位の数値を "H:MM" 形式の文字列に変換します。
 * 時間部分は2桁表示ではありません（例: "8:30"）。
 *
 * @param {number|null} totalMinutes - 分単位の数値。
 * @returns {string} "H:MM" 形式の時間文字列。入力が無効な場合は空文字列を返します。
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
 * 数値のみの文字列を "H:MM" または "HH:MM" 形式にフォーマットします。
 * 例: "9" -> "9:00", "930" -> "9:30", "1230" -> "12:30"
 *
 * @param {string} input - ユーザーによって入力された時間文字列。
 * @returns {string} フォーマットされた時間文字列。入力がない場合は空文字列を返します。
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
 * 出退社時刻の入力が有効か（00:00から24:00の間の15分刻みか）を検証します。
 *
 * @param {string} timeStr - "HH:MM"形式の時間文字列。
 * @returns {boolean} 時間が有効な場合はtrue、それ以外はfalse。
 */
export const validateTimeInput = (timeStr) => {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return false;
    const [h, m] = timeStr.split(':').map(Number);

    if (h === 24 && m === 0) return true;

    return h >= 0 && h <= 23 && m >= 0 && m < 60 && m % 15 === 0;
};

/**
 * 休憩時間の入力が有効か（0:00から5:00の間か）を検証します。
 *
 * @param {string} timeStr - "H:MM"形式の時間文字列。
 * @returns {boolean} 休憩時間が有効な場合はtrue、それ以外はfalse。
 */
export const validateRestTimeInput = (timeStr) => {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return false;
    const totalMinutes = timeToMinutes(timeStr);
    return totalMinutes !== null && totalMinutes >= 0 && totalMinutes <= 300; // 5 hours * 60 minutes
};
