from rest_framework import generics, permissions
from strava.views import CsrfExemptSessionAuthentication
from .models import RunRecord
from .serializers import RunRecordSerializer


class RunRecordListCreateView(generics.ListCreateAPIView):
    serializer_class = RunRecordSerializer
    authentication_classes = [CsrfExemptSessionAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Filter runs by the authenticated user
        return RunRecord.objects.filter(user=self.request.user).order_by('-date')

    def perform_create(self, serializer):
        # Set the user to the current authenticated user when creating a run
        serializer.save(user=self.request.user)