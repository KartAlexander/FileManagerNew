from rest_framework import serializers
from .models import EncryptedFile

class EncryptedFileSerializer(serializers.ModelSerializer):
    size = serializers.SerializerMethodField()

    class Meta:
        model = EncryptedFile
        fields = ['id', 'filename', 'uploaded_at', 'size', 'is_encrypted']

    def get_size(self, obj):
        return obj.file.size if obj.file else None