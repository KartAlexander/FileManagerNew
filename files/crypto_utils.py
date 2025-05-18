from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import base64
import os


def generate_rsa_key_pair():
    """Генерирует новую пару RSA ключей"""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
        backend=default_backend()
    )
    
    # Сериализация приватного ключа
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    
    # Сериализация публичного ключа
    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    
    return {
        'private_key': private_pem,
        'public_key': public_pem
    }


def generate_aes_key():
    """Генерирует случайный AES ключ и IV"""
    # 32 байта для AES-256
    key = os.urandom(32)
    # 16 байтов для IV (размер блока AES)
    iv = os.urandom(16)
    return key, iv


def encrypt_aes_key(aes_key_data, public_key_pem):
    """Шифрует AES ключ и IV с использованием публичного ключа RSA"""
    public_key = serialization.load_pem_public_key(
        public_key_pem,
        backend=default_backend()
    )
    
    encrypted_key = public_key.encrypt(
        aes_key_data,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return encrypted_key


def decrypt_aes_key(encrypted_aes_key, private_key_pem):
    """Дешифрует AES ключ с использованием приватного ключа RSA"""
    private_key = serialization.load_pem_private_key(
        private_key_pem,
        password=None,
        backend=default_backend()
    )
    
    decrypted_key = private_key.decrypt(
        encrypted_aes_key,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None
        )
    )
    
    return decrypted_key


def import_public_key(public_key_data):
    """Импортирует публичный ключ из base64 строки"""
    try:
        key_bytes = base64.b64decode(public_key_data)
        return serialization.load_pem_public_key(
            key_bytes,
            backend=default_backend()
        )
    except Exception as e:
        raise ValueError(f"Ошибка импорта публичного ключа: {str(e)}")


def import_private_key(private_key_data):
    """Импортирует приватный ключ из base64 строки"""
    try:
        key_bytes = base64.b64decode(private_key_data)
        return serialization.load_pem_private_key(
            key_bytes,
            password=None,
            backend=default_backend()
        )
    except Exception as e:
        raise ValueError(f"Ошибка импорта приватного ключа: {str(e)}")


def export_public_key(public_key):
    """Экспортирует публичный ключ в base64 строку"""
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo
    )
    return base64.b64encode(public_pem).decode('utf-8')


def export_private_key(private_key):
    """Экспортирует приватный ключ в base64 строку"""
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    )
    return base64.b64encode(private_pem).decode('utf-8')


def encrypt_file_content(file_content, public_key_pem):
    """Шифрует содержимое файла с использованием гибридного шифрования RSA+AES"""
    try:
        # Генерация AES ключа и IV
        aes_key, iv = generate_aes_key()
        
        # Объединяем ключ и IV для шифрования с помощью RSA
        key_data = aes_key + iv
        
        # Шифруем AES ключ и IV с помощью RSA
        encrypted_key_data = encrypt_aes_key(key_data, public_key_pem)
        
        # Создаем AES шифратор
        cipher = Cipher(
            algorithms.AES(aes_key),
            modes.CBC(iv),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        
        # Добавляем padding (PKCS7)
        block_size = algorithms.AES.block_size // 8  # в байтах
        padding_length = block_size - (len(file_content) % block_size)
        if padding_length == 0:
            padding_length = block_size
        
        padded_data = file_content + bytes([padding_length] * padding_length)
        
        # Шифруем данные
        encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
        
        return {
            'encrypted_data': encrypted_data,
            'encrypted_key': encrypted_key_data,
            'aes_key': aes_key,
            'iv': iv
        }
    except Exception as e:
        raise Exception(f"Ошибка при шифровании файла: {str(e)}")


def decrypt_file_content(encrypted_data, encrypted_aes_key, iv, private_key_pem):
    """Дешифрует содержимое файла с использованием гибридного шифрования RSA+AES"""
    try:
        # Расшифровка AES ключа
        aes_key = decrypt_aes_key(encrypted_aes_key, private_key_pem)
        if len(aes_key) != 32:  # AES-256 ключ должен быть 32 байта
            raise ValueError("Неверный формат AES ключа")
        
        # Создаем AES дешифратор
        cipher = Cipher(
            algorithms.AES(aes_key),
            modes.CBC(iv),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        
        # Дешифруем данные
        padded_data = decryptor.update(encrypted_data) + decryptor.finalize()
        
        # Проверяем padding
        padding_length = padded_data[-1]
        if padding_length > 16 or padding_length == 0:  # AES block size = 16 bytes
            raise ValueError("Неверный padding")
            
        # Проверяем, что все байты padding одинаковые
        if not all(x == padding_length for x in padded_data[-padding_length:]):
            raise ValueError("Неверный формат padding")
            
        # Удаляем padding
        data = padded_data[:-padding_length]
        
        return data
    except Exception as e:
        raise Exception(f"Ошибка при дешифровании файла: {str(e)}")