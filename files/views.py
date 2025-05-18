from django.utils.crypto import get_random_string
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.response import Response
import os
from django.http import JsonResponse, FileResponse
from django.core.files.storage import FileSystemStorage
from django.shortcuts import get_object_or_404
from django.utils.encoding import smart_str
from django.conf import settings
import mimetypes
import tempfile
from .models import EncryptedFile, UserKeys
from .crypto_utils import (
    generate_rsa_key_pair,
    encrypt_aes_key,
    decrypt_aes_key,
    import_public_key,
    import_private_key,
    export_public_key,
    export_private_key,
    encrypt_file_content,
    decrypt_file_content
)
from django.core.files.base import ContentFile
import json
import base64
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import uuid
from .logger import log_user_action


# Функция загрузки файла с шифрованием
@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def file_upload(request):
    try:
        if 'file' not in request.FILES:
            log_user_action(request.user, "Попытка загрузки файла", "Файл не найден")
            return Response({'error': 'Файл не найден'}, status=400)
            
        file = request.FILES['file']
        encrypt = request.POST.get('encrypt', 'false').lower() == 'true'
        
        # Проверка размера файла (максимум 100MB)
        if file.size > 100 * 1024 * 1024:
            log_user_action(request.user, "Попытка загрузки файла", f"Превышен размер файла: {file.size} байт")
            return Response({'error': 'Размер файла превышает 100MB'}, status=400)
        
        # Получаем оригинальное имя файла и расширение
        original_filename = file.name
        file_extension = os.path.splitext(original_filename)[1]
        
        # Генерируем уникальное имя файла, сохраняя расширение
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Создаем запись в базе данных без сохранения файла
        file_instance = EncryptedFile(
            user=request.user,
            filename=original_filename,
            size=file.size,
            is_encrypted=encrypt
        )
        
        # Считываем содержимое файла
        file_content = file.read()
        
        # Если нужно шифрование
        if encrypt:
            try:
                # Проверяем наличие IV и зашифрованного ключа
                iv = request.POST.get('iv')
                encrypted_aes_key = request.POST.get('encrypted_aes_key')
                
                if not iv:
                    log_user_action(request.user, "Попытка загрузки зашифрованного файла", "Отсутствует IV")
                    return Response({'error': 'Отсутствует IV для шифрования'}, status=400)
                if not encrypted_aes_key:
                    log_user_action(request.user, "Попытка загрузки зашифрованного файла", "Отсутствует AES ключ")
                    return Response({'error': 'Отсутствует зашифрованный AES ключ'}, status=400)
                
                # Получаем или создаем ключи пользователя
                user_keys, created = UserKeys.objects.get_or_create(user=request.user)
                
                # Если у пользователя нет ключей, генерируем новую пару
                if not user_keys.rsa_public_key:
                    key_pair = generate_rsa_key_pair()
                    user_keys.rsa_public_key = key_pair['public_key']
                    user_keys.rsa_private_key = key_pair['private_key']
                    user_keys.save()
                    log_user_action(request.user, "Сгенерирована новая пара RSA ключей")
                
                # Сохраняем зашифрованный файл
                try:
                    file_instance.file.save(unique_filename, ContentFile(file_content), save=False)
                    file_instance.encrypted_aes_key = base64.b64decode(encrypted_aes_key)
                    file_instance.iv = base64.b64decode(iv)
                except Exception as e:
                    log_user_action(request.user, "Ошибка при сохранении зашифрованного файла", str(e))
                    return Response({
                        'error': 'Ошибка при сохранении файла',
                        'details': str(e)
                    }, status=500)
                
            except Exception as e:
                log_user_action(request.user, "Ошибка при загрузке зашифрованного файла", str(e))
                return Response({
                    'error': 'Ошибка шифрования',
                    'details': str(e)
                }, status=500)
        else:
            # Сохраняем файл без шифрования
            try:
                file_instance.file.save(unique_filename, ContentFile(file_content), save=False)
            except Exception as e:
                log_user_action(request.user, "Ошибка при сохранении файла", str(e))
                return Response({
                    'error': 'Ошибка при сохранении файла',
                    'details': str(e)
                }, status=500)
        
        # Сохраняем запись в базе данных
        try:
            file_instance.save()
            
            # Проверяем, что файл действительно сохранен
            if not os.path.exists(file_instance.file.path):
                log_user_action(request.user, "Ошибка при сохранении файла", "Файл не найден после сохранения")
                file_instance.delete()
                return Response({
                    'error': 'Ошибка при сохранении файла',
                    'details': 'Файл не был сохранен на диск'
                }, status=500)
                
        except Exception as e:
            log_user_action(request.user, "Ошибка при сохранении записи файла", str(e))
            return Response({
                'error': 'Ошибка при сохранении записи файла',
                'details': str(e)
            }, status=500)
        
        log_user_action(request.user, "Файл успешно загружен", f"Имя файла: {original_filename}, Размер: {file.size} байт, Шифрование: {'Да' if encrypt else 'Нет'}")
        
        return Response({
            'message': 'Файл успешно загружен',
            'file_id': file_instance.id,
            'filename': original_filename,
            'is_encrypted': encrypt
        })
        
    except Exception as e:
        import traceback
        log_user_action(request.user, "Ошибка при загрузке файла", f"{str(e)}\n{traceback.format_exc()}")
        return Response({
            'error': 'Ошибка загрузки файла',
            'details': str(e)
        }, status=500)


# Функция получения списка файлов
@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def file_list(request):
    files = EncryptedFile.objects.filter(user=request.user)
    files_data = [{
        'id': f.id, 
        'filename': f.filename,
        'size': f.size,
        'is_encrypted': f.is_encrypted,
        'uploaded_at': f.uploaded_at.strftime('%Y-%m-%d %H:%M:%S') if f.uploaded_at else None
    } for f in files]
    log_user_action(request.user, "Получен список файлов", f"Количество файлов: {len(files_data)}")
    return Response({'files': files_data})


# Новый endpoint для получения метаданных зашифрованного файла
@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def file_meta(request, file_id):
    file_instance = get_object_or_404(EncryptedFile, id=file_id, user=request.user)
    if not file_instance.is_encrypted:
        log_user_action(request.user, "Попытка получения метаданных", f"Файл {file_instance.filename} не зашифрован")
        return Response({'error': 'Файл не зашифрован'}, status=400)
    if not file_instance.encrypted_aes_key or not file_instance.iv:
        log_user_action(request.user, "Попытка получения метаданных", f"Отсутствуют ключи шифрования для файла {file_instance.filename}")
        return Response({'error': 'Отсутствуют ключи шифрования'}, status=400)
    log_user_action(request.user, "Получены метаданные файла", f"Файл: {file_instance.filename}")
    return Response({
        'encrypted_aes_key': base64.b64encode(file_instance.encrypted_aes_key).decode('utf-8'),
        'iv': base64.b64encode(file_instance.iv).decode('utf-8'),
        'filename': file_instance.filename
    })


# Исправленный endpoint скачивания файла
@api_view(['GET', 'DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def file_download(request, file_id):
    try:
        file_instance = get_object_or_404(EncryptedFile, id=file_id, user=request.user)
        
        # Обработка DELETE запроса
        if request.method == 'DELETE':
            try:
                filename = file_instance.filename
                # Проверяем существование файла
                if file_instance.file and os.path.exists(file_instance.file.path):
                    os.remove(file_instance.file.path)
                file_instance.delete()
                log_user_action(request.user, "Файл успешно удален", f"Файл: {filename}")
                return JsonResponse({'message': 'Файл успешно удален'})
            except Exception as e:
                log_user_action(request.user, "Ошибка при удалении файла", str(e))
                return JsonResponse({'error': f'Ошибка удаления файла: {str(e)}'}, status=500)
        
        # Обработка GET запроса (скачивание)
        if not file_instance.file:
            log_user_action(request.user, "Попытка скачивания файла", f"Файл {file_id} не найден в базе данных")
            return JsonResponse({'error': 'Файл не найден в базе данных'}, status=404)
            
        if not os.path.exists(file_instance.file.path):
            log_user_action(request.user, "Попытка скачивания файла", f"Файл {file_id} не найден на диске")
            file_instance.delete()
            return JsonResponse({'error': 'Файл не найден на сервере'}, status=404)
        
        try:
            with open(file_instance.file.path, 'rb') as f:
                file_content = f.read()
        except Exception as e:
            log_user_action(request.user, "Ошибка при чтении файла", str(e))
            return JsonResponse({'error': 'Ошибка при чтении файла'}, status=500)
        
        # Если файл зашифрован и требуется расшифровка
        decrypt_requested = request.GET.get('decrypt', 'true').lower() == 'true'
        if file_instance.is_encrypted and decrypt_requested:
            try:
                if not file_instance.encrypted_aes_key or not file_instance.iv:
                    log_user_action(request.user, "Попытка скачивания зашифрованного файла", "Отсутствуют ключи шифрования")
                    return JsonResponse({'error': 'Отсутствуют ключи шифрования'}, status=400)
                
                # Возвращаем зашифрованный файл вместе с метаданными для расшифровки на клиенте
                response_data = {
                    'encrypted_content': base64.b64encode(file_content).decode('utf-8'),
                    'encrypted_aes_key': base64.b64encode(file_instance.encrypted_aes_key).decode('utf-8'),
                    'iv': base64.b64encode(file_instance.iv).decode('utf-8'),
                    'filename': file_instance.filename,
                    'mime_type': mimetypes.guess_type(file_instance.filename)[0] or 'application/octet-stream'
                }
                
                log_user_action(request.user, "Файл подготовлен для расшифровки на клиенте", f"Файл: {file_instance.filename}")
                return JsonResponse(response_data)
                
            except Exception as e:
                import traceback
                log_user_action(request.user, "Ошибка при подготовке зашифрованного файла", f"{str(e)}\n{traceback.format_exc()}")
                return JsonResponse({'error': f'Ошибка подготовки файла: {str(e)}'}, status=500)
        else:
            # Возвращаем файл как есть (без расшифровки)
            mime_type, _ = mimetypes.guess_type(file_instance.filename)
            mime_type = mime_type or 'application/octet-stream'
            filename = smart_str(file_instance.filename)
            
            response = FileResponse(open(file_instance.file.path, 'rb'), as_attachment=True)
            response['Content-Type'] = mime_type
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            log_user_action(request.user, "Файл успешно скачан", f"Файл: {file_instance.filename}, Размер: {len(file_content)} байт")
            
            return response
            
    except Exception as e:
        import traceback
        log_user_action(request.user, "Ошибка при скачивании файла", f"{str(e)}\n{traceback.format_exc()}")
        return JsonResponse({'error': str(e)}, status=500)


# Очистка временных файлов после отправки
def cleanup_temp_file(sender, **kwargs):
    if 'response' in kwargs and hasattr(kwargs['response'], '_file_to_clean'):
        try:
            os.remove(kwargs['response']._file_to_clean)
        except (OSError, AttributeError):
            pass


# Регистрация сигнала
from django.core.signals import request_finished
request_finished.connect(cleanup_temp_file)


# Функция удаления файла
@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def file_delete(request, file_id):
    try:
        file_instance = get_object_or_404(EncryptedFile, id=file_id, user=request.user)
        filename = file_instance.filename
        
        # Проверяем существование файла
        if not file_instance.file:
            log_user_action(request.user, "Попытка удаления файла", f"Файл {file_id} не найден в базе данных")
            file_instance.delete()  # Удаляем запись из базы
            return JsonResponse({'message': 'Файл уже был удален'})
            
        # Проверяем существование файла на диске
        if not os.path.exists(file_instance.file.path):
            log_user_action(request.user, "Попытка удаления файла", f"Файл {file_id} не найден на диске")
            file_instance.delete()  # Удаляем запись из базы
            return JsonResponse({'message': 'Файл уже был удален'})
        
        try:
            # Удаляем физический файл
            if os.path.exists(file_instance.file.path):
                os.remove(file_instance.file.path)
            
            # Удаляем запись из базы данных
            file_instance.delete()
            
            log_user_action(request.user, "Файл успешно удален", f"Файл: {filename}")
            return JsonResponse({'message': 'Файл успешно удален'})
            
        except Exception as e:
            log_user_action(request.user, "Ошибка при удалении файла", f"Ошибка: {str(e)}")
            return JsonResponse({
                'error': 'Ошибка при удалении файла',
                'details': str(e)
            }, status=500)
            
    except Exception as e:
        log_user_action(request.user, "Ошибка при удалении файла", str(e))
        return JsonResponse({
            'error': 'Ошибка при удалении файла',
            'details': str(e)
        }, status=500)


# Получение публичного ключа для шифрования
@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_public_key(request):
    try:
        public_key = request.data.get('public_key')
        if not public_key:
            log_user_action(request.user, "Попытка обновления публичного ключа", "Публичный ключ не предоставлен")
            return Response({'error': 'Публичный ключ не предоставлен'}, status=400)

        # Получаем или создаем запись ключей пользователя
        user_keys, created = UserKeys.objects.get_or_create(user=request.user)
        
        # Обновляем публичный ключ
        try:
            # Проверяем, что ключ в формате base64
            if isinstance(public_key, str):
                # Декодируем base64 для проверки
                decoded_key = base64.b64decode(public_key)
                user_keys.rsa_public_key = decoded_key
            else:
                user_keys.rsa_public_key = public_key.encode()
            
            user_keys.save()
            log_user_action(request.user, "Обновлен публичный ключ")
            return Response({'message': 'Публичный ключ успешно обновлен'})
        except Exception as e:
            log_user_action(request.user, "Ошибка при обработке публичного ключа", str(e))
            return Response({'error': 'Неверный формат публичного ключа'}, status=400)
            
    except Exception as e:
        log_user_action(request.user, "Ошибка при обновлении публичного ключа", str(e))
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def get_public_key(request):
    try:
        user_keys, created = UserKeys.objects.get_or_create(user=request.user)
        
        if not user_keys.rsa_public_key:
            log_user_action(request.user, "Попытка получения публичного ключа", "Публичный ключ не найден")
            return Response({'error': 'Публичный ключ не найден. Пожалуйста, сгенерируйте новые ключи.'}, status=404)
            
        try:
            # Проверяем, что ключ можно декодировать
            public_key = user_keys.rsa_public_key
            if isinstance(public_key, bytes):
                try:
                    # Пробуем декодировать как base64
                    public_key = public_key.decode('utf-8')
                except UnicodeDecodeError:
                    # Если не получилось, конвертируем в base64
                    public_key = base64.b64encode(public_key).decode('utf-8')
            
            return Response({
                'public_key': public_key
            })
        except Exception as e:
            log_user_action(request.user, "Ошибка при обработке публичного ключа", str(e))
            return Response({'error': f'Ошибка при обработке публичного ключа: {str(e)}'}, status=500)
            
    except Exception as e:
        log_user_action(request.user, "Ошибка при получении публичного ключа", str(e))
        return Response({'error': str(e)}, status=500)