import { Buffer } from 'buffer';

// Генерация ключей AES
export const generateAESKey = async () => {
    const key = await window.crypto.subtle.generateKey(
        {
            name: "AES-CBC",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
    return key;
};

// Экспорт ключа в формат для передачи
export const exportKey = async (key) => {
    const exported = await window.crypto.subtle.exportKey(
        "raw",
        key
    );
    return Buffer.from(exported).toString('base64');
};

// Импорт ключа из формата передачи
export const importKey = async (keyData) => {
    const keyBuffer = Buffer.from(keyData, 'base64');
    return await window.crypto.subtle.importKey(
        "raw",
        keyBuffer,
        {
            name: "AES-CBC",
            length: 256
        },
        true,
        ["encrypt", "decrypt"]
    );
};

// Шифрование файла
export const encryptFile = async (file, key) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const fileBuffer = await file.arrayBuffer();
    
    const encryptedData = await window.crypto.subtle.encrypt(
        {
            name: "AES-CBC",
            iv: iv
        },
        key,
        fileBuffer
    );

    // Создаем Blob из зашифрованных данных
    const encryptedBlob = new Blob([encryptedData], { type: 'application/octet-stream' });
    
    // Возвращаем объект с данными и IV
    return {
        data: encryptedBlob,
        iv: Buffer.from(iv).toString('base64')
    };
};

// Дешифрование файла
export const decryptFile = async (encryptedData, key, iv) => {
    // encryptedData — это Uint8Array или ArrayBuffer
    const decryptedData = await window.crypto.subtle.decrypt(
        {
            name: "AES-CBC",
            iv: iv
        },
        key,
        encryptedData
    );
    return decryptedData; // ArrayBuffer
};

// Генерация RSA ключей для обмена ключами
export const generateRSAKeyPair = async () => {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"]
    );
    return keyPair;
};

// Экспорт публичного ключа RSA
export const exportPublicKey = async (keyPair) => {
    const exported = await window.crypto.subtle.exportKey(
        "spki",
        keyPair.publicKey
    );
    return Buffer.from(exported).toString('base64');
};

// Экспорт приватного ключа RSA
export const exportPrivateKey = async (keyPair) => {
    const exported = await window.crypto.subtle.exportKey(
        "pkcs8",
        keyPair.privateKey
    );
    return Buffer.from(exported).toString('base64');
};

// Функция для импорта RSA публичного ключа
export async function importPublicKey(pemKey) {
    // Удаляем заголовки и подвалы PEM формата
    const base64Key = pemKey
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s/g, '');
    
    // Конвертируем base64 в ArrayBuffer
    const binaryKey = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    
    // Импортируем ключ
    return await window.crypto.subtle.importKey(
        'spki',
        binaryKey,
        {
            name: 'RSA-OAEP',
            hash: 'SHA-256'
        },
        true,
        ['encrypt']
    );
}

// Импорт приватного ключа RSA
export const importPrivateKey = async (keyData) => {
    const keyBuffer = Buffer.from(keyData, 'base64');
    return await window.crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256",
        },
        true,
        ["decrypt"]
    );
};

// Декодирование base64 строки в Uint8Array
export const base64ToUint8Array = (base64String) => {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

// Утилиты для работы с криптографией на клиенте

// Шифрование файла с помощью AES
export const encryptFileWithAES = async (file, key) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    const fileBuffer = await file.arrayBuffer();
    
    const encryptedData = await window.crypto.subtle.encrypt(
        {
            name: "AES-CBC",
            iv: iv
        },
        key,
        fileBuffer
    );

    return {
        data: new Blob([encryptedData], { type: 'application/octet-stream' }),
        iv: Buffer.from(iv).toString('base64')
    };
};

// Расшифровка файла с помощью AES
export const decryptFileWithAES = async (encryptedData, key, iv) => {
    const decryptedData = await window.crypto.subtle.decrypt(
        {
            name: "AES-CBC",
            iv: new Uint8Array(Buffer.from(iv, 'base64'))
        },
        key,
        encryptedData
    );
    return new Blob([decryptedData]);
};

// Получаем базовый URL бэкенда
const getBackendUrl = () => {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${currentHost}:8000`;
};

// Отправка публичного ключа на сервер
const sendPublicKeyToServer = async (publicKey) => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/files/keys/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify({ public_key: publicKey })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка при отправке публичного ключа на сервер');
        }

        return await response.json();
    } catch (error) {
        console.error('Ошибка при отправке публичного ключа:', error);
        throw error;
    }
};

// Инициализация ключей пользователя
export const initializeUserKeys = async () => {
    try {
        // Проверяем наличие ключей в localStorage
        let privateKey = localStorage.getItem('private_key');
        let publicKey = localStorage.getItem('public_key');

        if (!privateKey || !publicKey) {
            console.log('Генерация новых ключей...');
            // Генерация новых ключей
            const keyPair = await generateRSAKeyPair();
            
            // Сохранение приватного ключа
            privateKey = await exportPrivateKey(keyPair);
            localStorage.setItem('private_key', privateKey);
            
            // Экспорт и сохранение публичного ключа
            publicKey = await exportPublicKey(keyPair);
            localStorage.setItem('public_key', publicKey);
            
            // Отправка публичного ключа на сервер
            try {
                await sendPublicKeyToServer(publicKey);
                console.log('Публичный ключ успешно отправлен на сервер');
            } catch (error) {
                console.error('Ошибка при отправке публичного ключа:', error);
                // Удаляем ключи из localStorage, так как они не были сохранены на сервере
                localStorage.removeItem('private_key');
                localStorage.removeItem('public_key');
                throw error;
            }
        } else {
            console.log('Используем существующие ключи');
            // Проверяем, что ключи есть на сервере
            try {
                const response = await fetch(`${getBackendUrl()}/api/files/keys/public/`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                    }
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error('Ошибка при получении публичного ключа:', errorData);
                    // Если ключей нет на сервере, отправляем их
                    await sendPublicKeyToServer(publicKey);
                    console.log('Публичный ключ успешно отправлен на сервер');
                } else {
                    const data = await response.json();
                    if (data.public_key !== publicKey) {
                        console.log('Обновляем публичный ключ на сервере');
                        await sendPublicKeyToServer(publicKey);
                    }
                }
            } catch (error) {
                console.error('Ошибка при проверке ключей на сервере:', error);
                throw error;
            }
        }

        return { privateKey, publicKey };
    } catch (error) {
        console.error('Ошибка инициализации ключей:', error);
        throw error;
    }
};

// Расшифровка AES ключа с помощью RSA
export const decryptAesKey = async (encryptedAesKey, privateKey) => {
    try {
        const decryptedKey = await window.crypto.subtle.decrypt(
            {
                name: "RSA-OAEP"
            },
            privateKey,
            encryptedAesKey
        );
        
        return await window.crypto.subtle.importKey(
            "raw",
            decryptedKey,
            {
                name: "AES-CBC",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
    } catch (error) {
        console.error('Ошибка при расшифровке AES ключа:', error);
        throw new Error('Не удалось расшифровать AES ключ');
    }
};

// Расшифровка содержимого файла с помощью AES
export const decryptFileContent = async (encryptedContent, aesKey, iv) => {
    try {
        const decryptedData = await window.crypto.subtle.decrypt(
            {
                name: "AES-CBC",
                iv: iv
            },
            aesKey,
            encryptedContent
        );
        return decryptedData;
    } catch (error) {
        console.error('Ошибка при расшифровке содержимого файла:', error);
        throw new Error('Не удалось расшифровать содержимое файла');
    }
}; 