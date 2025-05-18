from django.core.management.base import BaseCommand
from users.models import RegistrationKey

class Command(BaseCommand):
    help = 'Creates registration keys'

    def add_arguments(self, parser):
        parser.add_argument('--count', type=int, default=1, help='Number of keys to create')

    def handle(self, *args, **options):
        count = options['count']
        created_keys = []
        
        for _ in range(count):
            key = RegistrationKey.objects.create()
            created_keys.append(str(key.key))
        
        self.stdout.write(self.style.SUCCESS(f'Successfully created {count} registration keys:'))
        for key in created_keys:
            self.stdout.write(key) 