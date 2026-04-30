import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lace_up.settings')

app = Celery('lace_up')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()