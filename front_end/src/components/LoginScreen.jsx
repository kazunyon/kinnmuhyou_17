import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LoginScreen = ({ onLogin }) => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("LoginScreen mounted");
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/login', {
        employee_id: employeeId,
        password: password
      });
      if (response.data.success) {
        onLogin(response.data.user);
      }
    } catch (err) {
      console.error(err);
      setError('ログインに失敗しました。IDとパスワードを確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      const response = await axios.post('/api/change_password', {
        employee_id: employeeId,
        current_password: currentPassword,
        new_password: newPassword
      });
      if (response.data.success) {
        setSuccessMessage('パスワードを変更しました。新しいパスワードでログインしてください。');
        setIsChangingPassword(false);
        setPassword('');
        setCurrentPassword('');
        setNewPassword('');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'パスワード変更に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsChangingPassword(!isChangingPassword);
    setError('');
    setSuccessMessage('');
    setPassword('');
    setCurrentPassword('');
    setNewPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {isChangingPassword ? 'パスワード変更' : '勤務表アプリ ログイン'}
        </h2>
        {error && <div className="mb-4 text-red-600 text-sm text-center">{error}</div>}
        {successMessage && <div className="mb-4 text-green-600 text-sm text-center">{successMessage}</div>}

        {!isChangingPassword ? (
          <form onSubmit={handleLoginSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="employeeId">
                社員ID (社員番号)
              </label>
              <input
                type="number"
                id="employeeId"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                パスワード
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="flex items-center justify-center mb-4">
              <button
                type="submit"
                disabled={loading}
                className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>
            </div>
            <div className="text-center">
                <button
                    type="button"
                    onClick={toggleMode}
                    className="text-sm text-blue-600 hover:underline focus:outline-none"
                >
                    パスワード変更はこちら
                </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="employeeIdChange">
                社員ID (社員番号)
              </label>
              <input
                type="number"
                id="employeeIdChange"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="currentPassword">
                現在のパスワード
              </label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newPassword">
                新しいパスワード
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
                required
              />
            </div>
            <div className="flex items-center justify-center mb-4">
              <button
                type="submit"
                disabled={loading}
                className={`bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? '変更中...' : 'パスワード変更'}
              </button>
            </div>
             <div className="text-center">
                <button
                    type="button"
                    onClick={toggleMode}
                    className="text-sm text-blue-600 hover:underline focus:outline-none"
                >
                    ログイン画面に戻る
                </button>
            </div>
          </form>
        )}

        <div className="mt-4 text-center text-xs text-gray-500">
          <p>初期パスワード: 123</p>
          <p>テストユーザーID: 1 (社員), 2 (部長), 4 (経理)</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
