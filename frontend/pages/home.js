import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { isAuthenticated, logout } from '../utils/auth';
import { useRouter } from 'next/router';
import { 
  FiUpload, 
  FiDownload, 
  FiTrash2, 
  FiLogOut, 
  FiLock, 
  FiUnlock,
  FiFile,
  FiRefreshCw,
  FiInfo,
  FiAlertCircle,
  FiCheckCircle,
  FiSearch,
  FiChevronDown,
  FiChevronUp,
  FiFilter,
  FiImage,
  FiFileText,
  FiCode,
  FiMusic,
  FiVideo,
  FiArchive,
  FiPlusCircle,
  FiX,
  FiSun,
  FiMoon
} from 'react-icons/fi';
import { 
  generateAESKey, 
  exportKey, 
  encryptFile, 
  importPublicKey, 
  initializeUserKeys, 
  encryptFileWithAES,
  importPrivateKey,
  decryptAesKey,
  decryptFileContent
} from '../src/utils/crypto';

// Вспомогательная функция для конвертации base64 в ArrayBuffer
const base64ToArrayBuffer = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const Home = () => {
  const [fileId, setFileId] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info'); // info, success, error
  const [authenticated, setAuthenticated] = useState(false);
  const [file, setFile] = useState(null);
  const [encrypt, setEncrypt] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingFile, setLoadingFile] = useState(null); // ID файла, который скачивается
  const [deletingFile, setDeletingFile] = useState(null); // ID файла, который удаляется
  const [showUploadSection, setShowUploadSection] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'uploaded_at', direction: 'desc' });
  const [filterType, setFilterType] = useState('all');
  const [darkMode, setDarkMode] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const router = useRouter();

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const backendUrl = `http://${currentHost}:8000`;

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
    } else {
      setAuthenticated(true);
      fetchFiles();
    }

    // Проверяем сохраненные настройки темы
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }

    // Инициализация ключей при загрузке страницы
    initializeUserKeys().catch(error => {
      console.error('Ошибка инициализации ключей:', error);
      setError('Ошибка инициализации ключей. Пожалуйста, перезагрузите страницу.');
    });
  }, []);

  // Автоматически скрывать сообщения через 5 секунд
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Эффект для фильтрации и сортировки файлов
  useEffect(() => {
    applyFiltersAndSort();
  }, [files, searchQuery, sortConfig, filterType]);

  const applyFiltersAndSort = () => {
    let result = [...files];
    
    // Применяем фильтр по типу
    if (filterType !== 'all') {
      result = result.filter(file => getFileCategory(file.filename) === filterType);
    }
    
    // Применяем поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(file => 
        file.filename.toLowerCase().includes(query)
      );
    }
    
    // Применяем сортировку
    result.sort((a, b) => {
      if (sortConfig.key === 'filename') {
        return sortConfig.direction === 'asc' 
          ? a.filename.localeCompare(b.filename)
          : b.filename.localeCompare(a.filename);
      } else if (sortConfig.key === 'uploaded_at') {
        return sortConfig.direction === 'asc'
          ? new Date(a.uploaded_at) - new Date(b.uploaded_at)
          : new Date(b.uploaded_at) - new Date(a.uploaded_at);
      } else if (sortConfig.key === 'size') {
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        return sortConfig.direction === 'asc' 
          ? sizeA - sizeB
          : sizeB - sizeA;
      }
      return 0;
    });
    
    setFilteredFiles(result);
  };

  // Определение категории файла по расширению
  const getFileCategory = (filename) => {
    if (!filename) return 'other';
    
    const extension = filename.split('.').pop().toLowerCase();
    
    // Изображения
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'tiff'].includes(extension)) {
      return 'image';
    }
    // Документы
    else if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension)) {
      return 'document';
    }
    // Код
    else if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'php', 'rb', 'go', 'json', 'xml'].includes(extension)) {
      return 'code';
    }
    // Аудио
    else if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(extension)) {
      return 'audio';
    }
    // Видео
    else if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv', 'flv'].includes(extension)) {
      return 'video';
    }
    // Архивы
    else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) {
      return 'archive';
    }
    // Прочее
    else {
      return 'other';
    }
  };

  // Получение иконки для типа файла
  const getFileIcon = (filename) => {
    const category = getFileCategory(filename);
    
    switch(category) {
      case 'image':
        return <FiImage className="text-blue-500" />;
      case 'document':
        return <FiFileText className="text-green-500" />;
      case 'code':
        return <FiCode className="text-purple-500" />;
      case 'audio':
        return <FiMusic className="text-red-500" />;
      case 'video':
        return <FiVideo className="text-orange-500" />;
      case 'archive':
        return <FiArchive className="text-yellow-500" />;
      default:
        return <FiFile className="text-gray-500" />;
    }
  };

  // Отображение сообщения
  const showMessage = (text, type = 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  // Проверка истечения срока действия токена
  const checkTokenExpiration = (token) => {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000;
    return Date.now() > expirationTime;
  };

  // Получение актуального токена
  const getAccessToken = async () => {
    let accessToken = localStorage.getItem('access_token');
    const refreshToken = localStorage.getItem('refresh_token');

    if (accessToken) {
      const isTokenExpired = checkTokenExpiration(accessToken);
      if (isTokenExpired && refreshToken) {
        try {
          const response = await fetch(`${backendUrl}/api/token/refresh/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh: refreshToken }),
          });

          if (response.ok) {
            const data = await response.json();
            accessToken = data.access;
            localStorage.setItem('access_token', accessToken);
          } else {
            logout();
            router.push('/login');
          }
        } catch (error) {
          console.error('Ошибка при обновлении токена:', error);
          logout();
          router.push('/login');
        }
      }
    }
    return accessToken;
  };

  const fetchFiles = async () => {
    setLoading(true);
    const token = await getAccessToken();

    if (!token) {
      showMessage('Не удалось авторизоваться. Пожалуйста, войдите снова.', 'error');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/api/files/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files);
      } else {
        showMessage('Не удалось загрузить файлы', 'error');
      }
    } catch (err) {
      showMessage('Ошибка при загрузке файлов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleDownload = async (fileId, filename, isEncrypted) => {
    try {
        const token = await getAccessToken();
        if (!token) {
            setMessage('Ошибка авторизации');
            return;
        }

        const url = `${backendUrl}/api/files/${fileId}/${isEncrypted ? '?decrypt=true' : ''}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                setMessage('Файл не найден');
                return;
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка скачивания файла');
        }

        if (isEncrypted) {
            // Обработка зашифрованного файла
            const data = await response.json();
            
            // Получаем приватный ключ из localStorage
            const privateKeyPem = localStorage.getItem('private_key');
            if (!privateKeyPem) {
                setMessage('Приватный ключ не найден. Пожалуйста, перезагрузите страницу для инициализации ключей.');
                return;
            }

            try {
                // Расшифровываем AES ключ
                const privateKey = await importPrivateKey(privateKeyPem);
                const encryptedAesKey = base64ToArrayBuffer(data.encrypted_aes_key);
                const iv = base64ToArrayBuffer(data.iv);
                const encryptedContent = base64ToArrayBuffer(data.encrypted_content);

                const aesKey = await decryptAesKey(encryptedAesKey, privateKey);
                const decryptedContent = await decryptFileContent(encryptedContent, aesKey, iv);

                // Создаем и скачиваем файл
                const blob = new Blob([decryptedContent], { type: data.mime_type });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = data.filename;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } catch (error) {
                console.error('Ошибка расшифровки:', error);
                setMessage('Ошибка расшифровки файла');
            }
        } else {
            // Обработка незашифрованного файла
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }

        setMessage('Файл успешно скачан');
    } catch (error) {
        console.error('Ошибка скачивания:', error);
        setMessage(error.message || 'Ошибка скачивания файла');
    }
  };

  const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg w-auto max-w-lg flex flex-col justify-center items-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <div className="mt-4 text-gray-700 dark:text-gray-300 flex justify-center">{children}</div>
          <div className="mt-6 flex justify-center w-full">
            <button 
              onClick={onClose} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition w-full"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Добавляем функцию для отображения информации о файле
  const showFileInfo = (file) => {
    setModalContent({
      title: 'Информация о файле',
      content: (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Имя файла:</h3>
            <p className="text-gray-600 dark:text-gray-400">{file.filename}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Размер:</h3>
            <p className="text-gray-600 dark:text-gray-400">{formatFileSize(file.size)}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Дата загрузки:</h3>
            <p className="text-gray-600 dark:text-gray-400">{formatDate(file.uploaded_at)}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Статус шифрования:</h3>
            <p className="text-gray-600 dark:text-gray-400">
              {file.is_encrypted ? (
                <span className="flex items-center text-green-600 dark:text-green-400">
                  <FiLock className="mr-1" /> Зашифрован
                </span>
              ) : (
                <span className="flex items-center text-gray-600 dark:text-gray-400">
                  <FiUnlock className="mr-1" /> Не зашифрован
                </span>
              )}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Тип файла:</h3>
            <p className="text-gray-600 dark:text-gray-400 flex items-center">
              {getFileIcon(file.filename)}
              <span className="ml-2">{getFileCategory(file.filename)}</span>
            </p>
          </div>
        </div>
      )
    });
    setModalOpen(true);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  // Обработка Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    setDropActive(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    setDropActive(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setDropActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Выберите файл');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    
    try {
      if (encrypt) {
        // Генерируем AES ключ
        const aesKey = await generateAESKey();
        
        // Получаем публичный ключ RSA с сервера
        const keyResponse = await fetch(`${backendUrl}/api/files/keys/public/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${await getAccessToken()}`,
          },
        });
        
        if (!keyResponse.ok) {
          const errorData = await keyResponse.json();
          throw new Error(errorData.error || 'Ошибка получения публичного ключа');
        }
        
        const { public_key } = await keyResponse.json();
        
        // Шифруем файл с помощью AES
        const encryptedFile = await encryptFile(file, aesKey);
        
        // Экспортируем AES ключ
        const exportedKey = await exportKey(aesKey);
        
        // Конвертируем base64 в ArrayBuffer для RSA шифрования
        const keyBuffer = Uint8Array.from(atob(exportedKey), c => c.charCodeAt(0));
        
        // Шифруем AES ключ с помощью RSA
        const encryptedAesKey = await window.crypto.subtle.encrypt(
          {
            name: "RSA-OAEP"
          },
          await importPublicKey(public_key),
          keyBuffer
        );
        
        // Добавляем зашифрованный файл и ключи в formData
        formData.append('file', new File([encryptedFile.data], file.name, {
          type: 'application/octet-stream'
        }));
        formData.append('encrypted_aes_key', Buffer.from(encryptedAesKey).toString('base64'));
        formData.append('iv', encryptedFile.iv);
      } else {
        formData.append('file', file);
      }
      
      formData.append('encrypt', encrypt.toString());
      formData.append('size', file.size);

      const response = await fetch(`${backendUrl}/api/files/upload/`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        showMessage(`Файл ${file.name} ${encrypt ? 'зашифрован и' : ''} успешно загружен`, 'success');
        setFile(null);
        setEncrypt(false);
        // Сбрасываем input file
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';
        fetchFiles();
      } else {
        const data = await response.json();
        setError(data.error || 'Ошибка загрузки');
      }
    } catch (err) {
      console.error('Ошибка загрузки:', err);
      setError(err.message || 'Ошибка загрузки файла');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId) => {
    setDeletingFile(fileId);
    const token = await getAccessToken();

    try {
      const response = await fetch(`${backendUrl}/api/files/${fileId}/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        showMessage('Файл успешно удалён', 'success');
        fetchFiles();
      } else {
        console.error('Ошибка удаления:', response.status);
        showMessage(`Ошибка удаления файла`, 'error');
      }
    } catch (err) {
      console.error('Ошибка сети при удалении файла:', err);
      showMessage('Ошибка сети при удалении файла', 'error');
    } finally {
      setDeletingFile(null);
    }
  };

  // Форматирование даты
  const formatDate = (dateString) => {
    if (!dateString) return 'н/д';
    // Добавляем 'Z', чтобы явно указать, что это UTC
    const date = new Date(dateString.replace(' ', 'T') + 'Z');
    return date.toLocaleString('ru-RU');
  };

  // Переключатель шифрования
  const toggleEncryption = () => {
    setEncrypt(!encrypt);
  };

  // Переключатель темы
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Изменение сортировки
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Получение иконки и стиля сообщения по типу
  const getMessageStyle = (type) => {
    switch(type) {
      case 'success':
        return {
          icon: <FiCheckCircle className="mr-2" />,
          style: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
        };
      case 'error':
        return {
          icon: <FiAlertCircle className="mr-2" />,
          style: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
        };
      default:
        return {
          icon: <FiInfo className="mr-2" />,
          style: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
        };
    }
  };

  // Получение размера файла в человекочитаемом формате
  const formatFileSize = (bytes) => {
    if (bytes === undefined || bytes === null) return 'н/д';
    const sizes = ['Байт', 'КБ', 'МБ', 'ГБ', 'ТБ'];
    if (bytes === 0) return '0 Байт';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
  };

  return authenticated ? (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''} bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-200`}>
      {/* Навигационная панель */}
      <nav className="bg-white dark:bg-gray-800 shadow-md dark:shadow-gray-700/20 px-6 py-4 w-full fixed top-0 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FiLock className="text-blue-600 dark:text-blue-400 text-xl" />
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">Файловый менеджер</h1>
          </div>
          
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input 
                type="text" 
                placeholder="Поиск файлов..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <FiSearch className="absolute right-3 top-3 text-gray-400" />
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* <button
              onClick={toggleDarkMode}
              className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition"
              title={darkMode ? "Светлая тема" : "Темная тема"}
            >
              {darkMode ? <FiSun /> : <FiMoon />}
            </button> */}
            
            <button
              onClick={fetchFiles}
              className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center"
              title="Обновить список файлов"
              disabled={loading}
            >
              <FiRefreshCw className={`${loading ? 'animate-spin' : ''}`} />
            </button>
            
            <button
              onClick={handleLogout}
              className="flex items-center text-red-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition"
              title="Выйти"
            >
              <FiLogOut className="md:mr-1" /> <span className="hidden md:inline">Выйти</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Поиск на мобильных устройствах */}
      <div className="md:hidden fixed top-16 z-10 w-full bg-white dark:bg-gray-800 px-6 py-2 shadow-sm">
        <div className="relative w-full">
          <input 
            type="text" 
            placeholder="Поиск файлов..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <FiSearch className="absolute right-3 top-2.5 text-gray-400" />
        </div>
      </div>

      {/* Основной контент */}
      <main className="pt-24 md:pt-24 pb-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          
          {/* Сообщения */}
          {message && (
            <div className={`mb-6 flex items-center p-4 rounded-lg border ${getMessageStyle(messageType).style}`}>
              {getMessageStyle(messageType).icon}
              {message}
            </div>
          )}

          {/* Контейнер с двумя колонками */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Левая колонка - Загрузка файлов */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-gray-700/10 overflow-hidden">
                <div className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-4 flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Загрузка файла</h2>
                  <button 
                    onClick={() => setShowUploadSection(!showUploadSection)}
                    className="text-white hover:text-blue-200 transition"
                  >
                    {showUploadSection ? '−' : '+'}
                  </button>
                </div>
                
                {showUploadSection && (
                  <div className="p-6">
                    <div 
                      className={`mb-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                        dropActive 
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {file ? (
                        <div className="flex flex-col items-center">
                          {getFileIcon(file.name)}
                          <div className="mt-2 text-sm font-medium">{file.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                          </div>
                          <button 
                            onClick={() => {
                              setFile(null);
                              const fileInput = document.getElementById('file-input');
                              if (fileInput) fileInput.value = '';
                            }}
                            className="mt-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm flex items-center"
                          >
                            <FiX className="mr-1" /> Удалить
                          </button>
                        </div>
                      ) : (
                        <>
                          <FiUpload className="mx-auto text-gray-400 dark:text-gray-500 text-2xl mb-2" />
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            Перетащите файл сюда или
                          </p>
                          <label className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition">
                            <FiPlusCircle className="mr-1" /> Выбрать файл
                            <input
                              id="file-input"
                              type="file"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                          </label>
                        </>
                      )}
                    </div>
                    
                    <div className="mb-4">
                      <div className="relative inline-block w-full">
                        <button 
                          onClick={toggleEncryption}
                          className={`w-full flex items-center justify-center py-2 px-4 rounded-lg border transition duration-200 hover:bg-opacity-90 ${
                            encrypt 
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700' 
                              : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {encrypt ? <FiLock className="mr-2" /> : <FiUnlock className="mr-2" />}
                          {encrypt ? 'Будет зашифрован' : 'Без шифрования'}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex justify-center transition text-center">
                        {encrypt 
                          ? 'Файл будет зашифрован' 
                          : 'Файл будет загружен в исходном виде'}
                      </p>
                    </div>
                    
                    <button
                      onClick={handleUpload}
                      className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 dark:bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition duration-200 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                      disabled={loading || !file}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <FiUpload className="mr-2" /> Загрузить файл
                        </>
                      )}
                    </button>
                    
                    {error && (
                      <div className="mt-3 text-red-600 dark:text-red-400 text-sm flex items-start">
                        <FiAlertCircle className="mr-1 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Фильтр по категориям */}
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-gray-700/10 overflow-hidden">
                <div className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-4">
                  <h2 className="text-lg font-semibold flex items-center">
                    <FiFilter className="mr-2" /> Категории файлов
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setFilterType('all')} 
                      className={`p-2 rounded-lg border text-sm flex items-center justify-center transition ${
                        filterType === 'all' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' 
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <FiFile className="mr-1" /> Все
                    </button>
                    <button 
                      onClick={() => setFilterType('image')} 
                      className={`p-2 rounded-lg border text-sm flex items-center justify-center transition ${
                        filterType === 'image' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' 
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <FiImage className="mr-1 text-blue-500" /> Изображения
                    </button>
                    <button 
                      onClick={() => setFilterType('document')} 
                      className={`p-2 rounded-lg border text-sm flex items-center justify-center transition ${
                        filterType === 'document' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' 
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <FiFileText className="mr-1 text-green-500" /> Документы
                    </button>
                    <button 
                      onClick={() => setFilterType('code')} 
                      className={`p-2 rounded-lg border text-sm flex items-center justify-center transition ${
                        filterType === 'code' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' 
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <FiCode className="mr-1 text-purple-500" /> Код
                    </button>
                    <button 
                      onClick={() => setFilterType('audio')} 
                      className={`p-2 rounded-lg border text-sm flex items-center justify-center transition ${
                        filterType === 'audio' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' 
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <FiMusic className="mr-1 text-red-500" /> Аудио
                    </button>
                    <button 
                      onClick={() => setFilterType('video')} 
                      className={`p-2 rounded-lg border text-sm flex items-center justify-center transition ${
                        filterType === 'video' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' 
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <FiVideo className="mr-1 text-orange-500" /> Видео
                    </button>
                    <button 
                      onClick={() => setFilterType('archive')} 
                      className={`p-2 rounded-lg border text-sm flex items-center justify-center transition ${
                        filterType === 'archive' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' 
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <FiArchive className="mr-1 text-yellow-500" /> Архивы
                    </button>
                    <button 
                      onClick={() => setFilterType('other')} 
                      className={`p-2 rounded-lg border text-sm flex items-center justify-center transition ${
                        filterType === 'other' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700' 
                          : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      <FiFile className="mr-1 text-gray-500" /> Прочее
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Правая колонка - Список файлов */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md dark:shadow-gray-700/10 overflow-hidden">
                <div className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-4">
                  <h2 className="text-lg font-semibold">Мои файлы</h2>
                </div>
                
                {loading ? (
                  <div className="p-10 text-center">
                    <div className="animate-spin mx-auto h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Загрузка файлов...</p>
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="p-10 text-center">
                    <FiFile className="mx-auto text-gray-400 h-12 w-12 mb-4" />
                    {files.length === 0 ? (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">У вас пока нет файлов</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">Загрузите свой первый файл с помощью формы слева</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">Файлы не найдены</p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">Попробуйте изменить параметры поиска или фильтры</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition"                            onClick={() => requestSort('filename')}
                          >
                            <div className="flex items-center">
                              Имя файла
                              {sortConfig.key === 'filename' && (
                                sortConfig.direction === 'asc' 
                                  ? <FiChevronUp className="ml-1" />
                                  : <FiChevronDown className="ml-1" />
                              )}
                            </div>
                          </th>
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition"                            onClick={() => requestSort('uploaded_at')}
                          >
                            <div className="flex items-center">
                              Дата загрузки
                              {sortConfig.key === 'uploaded_at' && (
                                sortConfig.direction === 'asc' 
                                  ? <FiChevronUp className="ml-1" />
                                  : <FiChevronDown className="ml-1" />
                              )}
                            </div>
                          </th>
                          <th 
                            scope="col" 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition"                            onClick={() => requestSort('size')}
                          >
                            <div className="flex items-center">
                              Размер
                              {sortConfig.key === 'size' && (
                                sortConfig.direction === 'asc' 
                                  ? <FiChevronUp className="ml-1" />
                                  : <FiChevronDown className="ml-1" />
                              )}
                            </div>
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700/50">
                        {filteredFiles.map((file) => (
                          <tr key={file.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/50 transition">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 mr-2">
                                  {getFileIcon(file.filename)}
                                </div>
                                <div className="ml-1 flex space-x-2">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white max-w-[200px] truncate" title={file.filename}>
                                    {file.filename.length > 30 ? file.filename.substring(0, 30) + '...' : file.filename}
                                  </div>
                                  {file.is_encrypted && (
                                    <FiLock className="text-xs text-green-500 mt-1" />
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {formatDate(file.uploaded_at)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {formatFileSize(file.size)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                <button 
                                  onClick={() => showFileInfo(file)}
                                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 transition"
                                  title="Информация"
                                >
                                  <FiInfo />
                                </button>
                                <button 
                                  onClick={() => handleDownload(file.id, file.filename, file.is_encrypted)}
                                  className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 transition"
                                  title="Скачать"
                                  disabled={loadingFile === file.id}
                                >
                                  {loadingFile === file.id ? (
                                    <div className="animate-spin h-4 w-4 border-2 border-green-500 border-t-transparent rounded-full" />
                                  ) : (
                                    <FiDownload />
                                  )}
                                </button>
                                <button 
                                  onClick={() => handleDelete(file.id)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition"
                                  title="Удалить"
                                  disabled={deletingFile === file.id}
                                >
                                  {deletingFile === file.id ? (
                                    <div className="animate-spin h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full" />
                                  ) : (
                                    <FiTrash2 />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Подвал */}
      <footer className="w-full bg-white dark:bg-gray-800 py-4 px-6 shadow-inner dark:shadow-gray-700/10">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© 2025 Файловый менеджер. Все права защищены.</p>
        </div>
      </footer>

      {/* Модальное окно */}
      {modalOpen && modalContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{modalContent.title}</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {modalContent.content}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : null;
};

export default Home;