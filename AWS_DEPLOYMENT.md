# AWS Deployment Guide

This document describes the AWS deployment used for Lace Up.

The current deployment runs the Django backend as a container on **Amazon ECS Express Mode**, pulls the image from **Amazon ECR**, and connects to **Neon PostgreSQL** over SSL.

## Current Architecture

```txt
Browser
  |
  v
ECS Express Mode public URL
  |
  v
Application Load Balancer managed by ECS Express Mode
  |
  v
ECS Fargate task running Django + Gunicorn
  |
  v
Neon PostgreSQL over SSL
```

Supporting services:

```txt
Amazon ECR       stores the backend Docker image
CloudWatch Logs  stores container logs
Strava OAuth     handles user login and activity access
```

## Live Backend

Backend URL:

```txt
https://la-886cab73b2ca41d79c05f9e9855b0c21.ecs.us-east-1.on.aws
```

Health check:

```txt
https://la-886cab73b2ca41d79c05f9e9855b0c21.ecs.us-east-1.on.aws/api/health/
```

Expected response:

```json
{"status": "ok"}
```

## ECR Image

Repository:

```txt
206501439453.dkr.ecr.us-east-1.amazonaws.com/lace-up-backend
```

Image tag used by ECS:

```txt
latest
```

Because local development happens on Apple Silicon, images must be built for `linux/amd64` before pushing to ECR. ECS Fargate expects an amd64-compatible image unless the task is explicitly configured otherwise.

Build and push:

```bash
docker buildx build --platform linux/amd64 \
  -t 206501439453.dkr.ecr.us-east-1.amazonaws.com/lace-up-backend:latest \
  ./backend --push
```

Verify the pushed image platform:

```bash
docker buildx imagetools inspect \
  206501439453.dkr.ecr.us-east-1.amazonaws.com/lace-up-backend:latest
```

The output should include:

```txt
Platform: linux/amd64
```

## ECS Express Mode Configuration

Region:

```txt
us-east-1 / United States (N. Virginia)
```

Service:

```txt
lace-up-backend-b332
```

Cluster:

```txt
default
```

Container port:

```txt
8000
```

Health check path:

```txt
/api/health/
```

CPU and memory:

```txt
0.25 vCPU
0.5 GB memory
```

Docker command:

```txt
Leave blank in ECS.
```

The container command is already defined in `backend/Dockerfile`:

```dockerfile
CMD ["gunicorn", "lace_up.wsgi:application", "--bind", "0.0.0.0:8000"]
```

Do not override the command with test values such as `echo,hello world`, or the Django server will not start.

## Runtime Environment Variables

Set these in the ECS Express Mode service environment variable section. Do not commit real values to Git.

### Django

```env
SECRET_KEY=<django-secret-key>
DEBUG=False
ALLOWED_HOSTS=*
```

`ALLOWED_HOSTS=*` is currently used because the ECS/ALB health check can send internal host headers. If this is tightened too early, Django may return `400 Bad Request`, causing ECS health checks to fail and the service to roll back.

### Database

```env
DB_NAME=neondb
DB_USER=neondb_owner
DB_PASS=<neon-password>
DB_HOST=<neon-host>
DB_PORT=5432
DB_SSLMODE=require
DB_CHANNEL_BINDING=require
```

The deployed backend uses Neon PostgreSQL for cost control. The Django settings read `DB_SSLMODE` and `DB_CHANNEL_BINDING` and pass them to the PostgreSQL driver through `DATABASES["default"]["OPTIONS"]`.

### Strava

```env
STRAVA_CLIENT_ID=<strava-client-id>
STRAVA_CLIENT_SECRET=<strava-client-secret>
STRAVA_WEBHOOK_VERIFY_TOKEN=<webhook-verify-token>
```

The Strava client secret must stay on the backend. Do not expose it in frontend code.

### URLs

```env
BACKEND_URL=https://la-886cab73b2ca41d79c05f9e9855b0c21.ecs.us-east-1.on.aws
FRONTEND_URL=http://localhost:3000
```

`BACKEND_URL` is used to generate the Strava OAuth callback:

```txt
{BACKEND_URL}/api/strava/callback/
```

For the current backend URL, the full callback is:

```txt
https://la-886cab73b2ca41d79c05f9e9855b0c21.ecs.us-east-1.on.aws/api/strava/callback/
```

In Strava app settings, the **Authorization Callback Domain** should be only the domain, without scheme or path:

```txt
la-886cab73b2ca41d79c05f9e9855b0c21.ecs.us-east-1.on.aws
```

### Browser Security

```env
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_SAMESITE=Lax
```

When the React frontend is deployed to S3 and CloudFront, update these values to the CloudFront or custom frontend domain:

```env
FRONTEND_URL=https://<frontend-domain>
CORS_ALLOWED_ORIGINS=https://<frontend-domain>
CSRF_TRUSTED_ORIGINS=https://<frontend-domain>
```

### Celery

```env
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1
```

These values are placeholders in the current deployment. Redis is not currently deployed on AWS, so Celery background workers are not part of the live backend.

A fuller production version would use:

```txt
ElastiCache Redis
ECS service for Celery worker
ECS service for Celery beat
```

## Database Migration

Run migrations against Neon from the Docker image:

```bash
docker run --rm --env-file backend/.env.neon \
  lace-up-backend python manage.py migrate
```

The local `.env.neon` file is ignored by Git and should contain the same database-related values used in ECS.

## Deployment Flow

1. Make code changes.
2. Commit changes.
3. Build and push an amd64 image to ECR:

```bash
docker buildx build --platform linux/amd64 \
  -t 206501439453.dkr.ecr.us-east-1.amazonaws.com/lace-up-backend:latest \
  ./backend --push
```

4. Force ECS to pull the updated `latest` image:

```bash
aws ecs update-service \
  --cluster default \
  --service lace-up-backend-b332 \
  --force-new-deployment \
  --region us-east-1
```

5. Verify health:

```bash
curl -i https://la-886cab73b2ca41d79c05f9e9855b0c21.ecs.us-east-1.on.aws/api/health/
```

## Debugging

Check ECS service status:

```bash
aws ecs describe-services \
  --cluster default \
  --services lace-up-backend-b332 \
  --region us-east-1
```

List running tasks:

```bash
aws ecs list-tasks \
  --cluster default \
  --service-name lace-up-backend-b332 \
  --region us-east-1 \
  --desired-status RUNNING
```

Common issues:

| Symptom | Likely cause | Fix |
|---|---|---|
| `CannotPullContainerError`, platform `linux/amd64` missing | Image was built on Apple Silicon as arm64 | Rebuild with `docker buildx build --platform linux/amd64 ... --push` |
| Health check returns `400` | Django `ALLOWED_HOSTS` rejects ALB health check host | Use `ALLOWED_HOSTS=*` for this deployment or configure allowed internal host behavior |
| Strava says `redirect_uri invalid` | `BACKEND_URL` does not match Strava callback domain | Set `BACKEND_URL` to the ECS public URL and set Strava Authorization Callback Domain to the same domain |
| Browser CORS error | Frontend origin not in `CORS_ALLOWED_ORIGINS` | Add the exact frontend origin, including scheme |
| CSRF failure | Frontend origin not trusted or cookies not sent | Add origin to `CSRF_TRUSTED_ORIGINS` and ensure frontend sends credentials |

## Cost Notes

This deployment uses ECS Express Mode because App Runner is no longer available to new customers.

Approximate monthly cost for this backend:

```txt
ECS Fargate task: low tens of dollars depending on runtime
Application Load Balancer: fixed monthly cost
CloudWatch logs: usually small for low traffic
Neon PostgreSQL: currently used for cost control
```

Use AWS Budgets to monitor spend. Recommended budget alerts:

```txt
$20 monthly warning
$50 monthly critical alert
```

## Future Production Architecture

A fuller AWS-native architecture would use:

```txt
React frontend       S3 + CloudFront
Django API           ECS Fargate / ECS Express Mode
PostgreSQL           Amazon RDS PostgreSQL
Redis broker         ElastiCache Redis
Background jobs      ECS services for Celery worker and Celery beat
Secrets              AWS Secrets Manager or SSM Parameter Store
Logs                 CloudWatch Logs
```

The current live deployment uses Neon instead of RDS to reduce database cost. If database operations need to stay fully within AWS, replace Neon with Amazon RDS PostgreSQL and update the database environment variables.
