from django.urls import path
from . import views

urlpatterns = [
    path('', views.file_list, name='file_list'),
    path('upload/', views.file_upload, name='file_upload'),
    path('<int:file_id>/', views.file_download, name='file_download'),
    path('keys/', views.update_public_key, name='update_public_key'),
    path('keys/public/', views.get_public_key, name='get_public_key'),
]