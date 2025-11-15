from rest_framework import serializers
from .models import RunRecord

class RunRecordSerializer(serializers.ModelSerializer):
    pace_min_per_km = serializers.ReadOnlyField()

    class Meta:
        model = RunRecord
        fields = "__all__"