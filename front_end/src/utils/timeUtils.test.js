import { describe, it, expect } from 'vitest';
import { timeToMinutes, minutesToTime, minutesToDuration } from './timeUtils';

/**
 * @file timeUtils.jsのテストスイート。
 * vitestを使用して、各時間変換関数の振る舞いを検証します。
 */

// 'timeToMinutes'関数のテスト
describe('timeToMinutes', () => {
  it('は、"HH:MM"形式の文字列を正しく分数に変換するべき', () => {
    expect(timeToMinutes('01:30')).toBe(90);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('は、無効または空の入力に対して0を返すべき', () => {
    expect(timeToMinutes('')).toBe(0);
    expect(timeToMinutes(null)).toBe(0);
    expect(timeToMinutes(undefined)).toBe(0);
    expect(timeToMinutes('invalid-string')).toBe(0);
    expect(timeToMinutes('12:xx')).toBe(0); // 数字でない分
  });
});


// 'minutesToTime'関数のテスト（HH:MM形式）
describe('minutesToTime', () => {
  it('は、分数を"HH:MM"形式（ゼロパディングあり）の文字列に変換するべき', () => {
    expect(minutesToTime(90)).toBe('01:30');
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(1439)).toBe('23:59');
    expect(minutesToTime(75)).toBe('01:15');
    expect(minutesToTime(5)).toBe('00:05'); // 1桁の分
  });

  it('は、分を正しく丸めるべき', () => {
    // Math.roundの仕様に基づき、.5は切り上げ
    expect(minutesToTime(75.8)).toBe('01:16');
    expect(minutesToTime(75.4)).toBe('01:15');
  });

  it('は、無効または負の入力に対して"00:00"を返すべき', () => {
    expect(minutesToTime(-10)).toBe('00:00');
    expect(minutesToTime(NaN)).toBe('00:00');
  });
});


// 'minutesToDuration'関数のテスト（H:MM形式）
describe('minutesToDuration', () => {
    it('は、分数を"H:MM"形式（時間のみパディングなし）の文字列に変換するべき', () => {
        expect(minutesToDuration(90)).toBe('1:30');
        expect(minutesToDuration(5)).toBe('0:05'); // 0時間の場合
        expect(minutesToDuration(60)).toBe('1:00');
        expect(minutesToDuration(1439)).toBe('23:59');
    });

    it('は、0または負の入力に対して"0:00"を返すべき', () => {
        expect(minutesToDuration(0)).toBe('0:00');
        expect(minutesToDuration(-100)).toBe('0:00');
    });

    it('は、分を正しく丸めるべき', () => {
        expect(minutesToDuration(75.8)).toBe('1:16');
        expect(minutesToDuration(75.4)).toBe('1:15');
    });

    it('は、無効な入力に対して"0:00"を返すべき', () => {
        expect(minutesToDuration(NaN)).toBe('0:00');
    });
});
