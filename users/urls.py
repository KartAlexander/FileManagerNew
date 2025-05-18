from django.urls import path
from . import views  # Импортируем views из текущей директории

urlpatterns = [ 
    path('', views.home, name='home'),  # Главная страница
    path('register/', views.register, name='register'),  # Регистрация пользователя
    path('login/', views.login, name='login'),  # Логин  
]
