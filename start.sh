#!/bin/bash

# Активация виртуального окружения
source venv/bin/activate

# Переменные
PORT=8000
FRONTEND_DIR="frontend"

# Убиваем процесс, занимающий порт $PORT
PID=$(lsof -ti :$PORT)

if [ -n "$PID" ]; then
    echo "Убиваем процесс, занимающий порт $PORT (PID: $PID)..."
    kill -9 $PID
else
    echo "Порт $PORT свободен."
fi

# Запускаем бэкенд Django в фоне
echo "Запускаем Django-сервер на 0.0.0.0:$PORT..."
python manage.py runserver 0.0.0.0:$PORT &

# Ждём немного, чтобы сервер успел стартовать
sleep 2

# Переходим в папку frontend и запускаем Next.js
if [ -d "$FRONTEND_DIR" ]; then
    echo "Запускаем фронтенд в папке $FRONTEND_DIR..."
    cd "$FRONTEND_DIR"
    # Установка зависимостей, если они еще не установлены
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    # Запуск Next.js в режиме разработки
    NODE_ENV=development npm run dev &
else
    echo "❌ Ошибка: папка '$FRONTEND_DIR' не найдена"
    exit 1
fi

# Ожидание завершения всех процессов
wait
