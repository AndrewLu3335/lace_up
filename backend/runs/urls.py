from django.urls import path
from .views import RunRecordListCreateView

urlpatterns = [
    path("runs/", RunRecordListCreateView.as_view()),
]