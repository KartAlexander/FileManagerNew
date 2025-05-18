import logging
from datetime import datetime

# Настройка логгера
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('user_actions')

def log_user_action(user, action, details=None):
    """Логирует действие пользователя"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    message = f"Пользователь {user.username} ({user.id}) - {action}"
    if details:
        message += f" - {details}"
    logger.info(message) 