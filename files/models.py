from django.utils import timezone
from django.db import models
from django.contrib.auth.models import User

class UserKeys(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    rsa_public_key = models.BinaryField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Keys for {self.user.username}"

    class Meta:
        verbose_name = "Ключи пользователя"
        verbose_name_plural = "Ключи пользователей"

class EncryptedFile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='encrypted_files')
    file = models.FileField(upload_to='encrypted_files/')
    filename = models.CharField(max_length=255)
    encrypted_aes_key = models.BinaryField(null=True, blank=True)  # Зашифрованный AES ключ
    iv = models.BinaryField(null=True, blank=True)  # Вектор инициализации для AES
    is_encrypted = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    size = models.BigIntegerField(null=True, blank=True)

    def __str__(self):
        encryption_status = "зашифрован" if self.is_encrypted else "не зашифрован"
        return f"{self.filename} ({encryption_status})"

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = "Зашифрованный файл"
        verbose_name_plural = "Зашифрованные файлы"