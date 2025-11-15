from rest_framework import generics
from .models import RunRecord
from .serializers import RunRecordSerializer


class RunRecordListCreateView(generics.ListCreateAPIView):
    queryset = RunRecord.objects.all().order_by('-date')
    serializer_class = RunRecordSerializer