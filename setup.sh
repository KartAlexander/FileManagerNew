#!/bin/bash

# Создание виртуального окружения
python3 -m venv venv

# Активация виртуального окружения
source venv/bin/activate

# Установка зависимостей
pip install -r requirements.txt

# Применение миграций
python manage.py makemigrations
python manage.py migrate

# Создание суперпользователя (опционально)
echo "Создание суперпользователя..."
python manage.py createsuperuser

echo "Настройка завершена!" 