from django.shortcuts import render
from django.contrib.auth.models import User as DjangoUser
from django.contrib.auth.hashers import make_password
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.http import JsonResponse
from django.contrib.auth import authenticate
from django.utils import timezone
from django.db import IntegrityError
from .models import RegistrationKey, User

import json

# Главная страница
def home(request):
    return render(request, 'home.js')  # Замените 'home.js' на правильный шаблон, например 'home.html'

# Регистрация пользователя
@api_view(['POST'])
def register(request):
    try:
        # Получаем данные пользователя из запроса
        username = request.data.get('username')
        password = request.data.get('password')
        registration_key = request.data.get('registration_key')

        if not all([username, password, registration_key]):
            return Response({'error': 'Все поля обязательны для заполнения'}, status=400)

        # Проверяем, существует ли пользователь с таким именем
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Пользователь с таким именем уже существует'}, status=400)

        try:
            key = RegistrationKey.objects.get(key=registration_key, is_used=False)
        except RegistrationKey.DoesNotExist:
            return Response({'error': 'Недействительный или уже использованный ключ регистрации'}, status=400)

        # Создаём нового пользователя
        user = User.objects.create(
            username=username,
            password=make_password(password)
        )
        user.save()

        # Создаем пользователя Django для аутентификации
        django_user = DjangoUser.objects.create(
            username=username,
            password=make_password(password)
        )
        django_user.save()

        # Отмечаем ключ как использованный
        key.is_used = True
        key.used_at = timezone.now()
        key.used_by = user
        key.save()

        return Response({'message': 'Пользователь успешно создан'}, status=201)
    except IntegrityError:
        return Response({'error': 'Пользователь с таким именем уже существует'}, status=400)
    except Exception as e:
        return Response({'error': str(e)}, status=400)

# Логин пользователя
@api_view(['POST'])
def login(request):
    if request.method == 'POST':
        username = request.data.get('username')
        password = request.data.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            return Response({'access_token': access_token, 'refresh_token': str(refresh)}, status=200)
        else:
            return Response({'error': 'Invalid credentials'}, status=400)
    return Response({'error': 'Invalid method'}, status=405)