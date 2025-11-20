import { describe, it, expect } from 'vitest';
import { timeToMinutes, minutesToTime } from './timeUtils';

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

  it('は、無効または空の入力に対してnullを返すべき', () => {
    expect(timeToMinutes('')).toBe(null);
    expect(timeToMinutes(null)).toBe(null);
    expect(timeToMinutes(undefined)).toBe(null);
    expect(timeToMinutes('invalid-string')).toBe(null);
    expect(timeToMinutes('12:xx')).toBe(null); // 数字でない分
  });
});


// 'minutesToTime'関数のテスト（H:MM形式）
describe('minutesToTime', () => {
  it('は、分数を"H:MM"形式（ゼロパディングなし）の文字列に変換するべき', () => {
    expect(minutesToTime(90)).toBe('1:30');
    expect(minutesToTime(0)).toBe('0:00');
    expect(minutesToTime(1439)).toBe('23:59');
    expect(minutesToTime(75)).toBe('1:15');
    expect(minutesToTime(5)).toBe('0:05'); // 1桁の分
  });

  it('は、無効または負の入力に対して空文字列を返すべき', () => {
    expect(minutesToTime(-10)).toBe('');
    expect(minutesToTime(NaN)).toBe('');
  });
});
