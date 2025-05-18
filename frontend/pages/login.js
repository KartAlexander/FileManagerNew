import { useState } from 'react';
import { useRouter } from 'next/router';
import { FiLogOut, FiAlertCircle } from 'react-icons/fi';
import '../styles/globals.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      
      const response = await fetch(`${backendUrl}/api/users/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        mode: 'cors',
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Сервер вернул неверный формат ответа');
      }

      const data = await response.json();

      if (response.ok) {
        if (data.access_token && data.refresh_token) {
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          router.push('/home');
        } else {
          throw new Error('Токены не получены от сервера');
        }
      } else {
        setError(data.error || 'Неправильный логин или пароль');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Ошибка подключения к серверу. Пожалуйста, попробуйте позже.');
    }
  };

  const handleRegisterRedirect = () => {
    router.push('/register');
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login'); // Переход на страницу логина после выхода
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-800">
      <div className="bg-gray-900 p-8 rounded-lg shadow-md w-full sm:w-96">
        <h1 className="text-3xl font-bold text-center text-white mb-6">Вход</h1>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium text-gray-300">
              Имя пользователя
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-2 mt-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Пароль
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 mt-2 border border-gray-700 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm mb-4 flex items-start">
              <FiAlertCircle className="mr-1 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button
            type="submit"
            className="w-full py-2 px-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            Войти
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={handleRegisterRedirect}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            Нет аккаунта? Зарегистрироваться
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
