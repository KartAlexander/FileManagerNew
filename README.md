# FileManagerNew

## Установка и запуск проекта

git clone https://github.com/KartAlexander/FileManager.git

### Бэкенд:

python -m venv venv

source venv/bin/activate  # Для macOS/Linux

venv\Scripts\activate     # Для Windows

pip install -r requirements.txt

python manage.py migrate

### Фронтенд:

cd frontend

npm install

npm run build

### Старт проекта в project:

./start.sh

### Для генерации ключей:

python manage.py create_registration_key --count=5
