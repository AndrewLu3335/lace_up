# AWS Deployment Guide

This document describes the AWS deployment used for Lace Up.

The current deployment serves the React frontend from **Amazon S3 + CloudFront**. The Django backend runs as a container on **Amazon ECS Express Mode**, pulls the image from **Amazon ECR**, and connects to **Neon PostgreSQL** over SSL.

## Current Architecture

```txt
Browser
  |
  v
CloudFront frontend
  |
  v
S3 bucket with React build files
  |
  v
React app calls ECS backend
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
Amazon S3        stores the React production build
CloudFront       serves the frontend over HTTPS
Amazon ECR       stores the backend Docker image
CloudWatch Logs  stores container logs
Strava OAuth     handles user login and activity access
```

## Live Frontend

Frontend URL:

```txt
https://d2vzk92s1ndecx.cloudfront.net
```

S3 bucket:

```txt
lace-up-frontend-206501439453
```

CloudFront distribution:

```txt
E3URSSJOUQ5OLD
```

The CloudFront distribution uses the S3 bucket as its origin and grants CloudFront private access to the bucket. The bucket should not be public.

React Router requires SPA fallback responses so browser refreshes on client-side routes continue to serve `index.html`:

```txt
403 -> /index.html -> 200
404 -> /index.html -> 200
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
FRONTEND_URL=https://d2vzk92s1ndecx.cloudfront.net
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
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://d2vzk92s1ndecx.cloudfront.net
CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://d2vzk92s1ndecx.cloudfront.net
SESSION_COOKIE_SECURE=True
SESSION_COOKIE_SAMESITE=None
```

`SESSION_COOKIE_SAMESITE=None` is required because the frontend and backend currently use different sites:

```txt
Frontend: https://d2vzk92s1ndecx.cloudfront.net
Backend:  https://la-886cab73b2ca41d79c05f9e9855b0c21.ecs.us-east-1.on.aws
```

When a custom frontend domain is added, update these values to the custom domain:

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

### Backend

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

### Frontend

Create a production env file from the committed example:

```bash
cp frontend/.env.production.example frontend/.env.production
```

Build the React app:

```bash
cd frontend
npm run build
```

Upload the build output to S3:

```bash
cd ..
aws s3 sync frontend/build s3://lace-up-frontend-206501439453 \
  --delete \
  --region us-east-1
```

If CloudFront has cached old assets, create an invalidation:

```bash
aws cloudfront create-invalidation \
  --distribution-id E3URSSJOUQ5OLD \
  --paths "/*"
```

Verify the frontend:

```bash
curl -I https://d2vzk92s1ndecx.cloudfront.net/
curl -I https://d2vzk92s1ndecx.cloudfront.net/runs
```

Both should return `200`. The `/runs` check confirms the SPA fallback is working.

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

Check CloudFront distribution status:

```bash
aws cloudfront get-distribution \
  --id E3URSSJOUQ5OLD \
  --query 'Distribution.{Status:Status,DomainName:DomainName,Enabled:DistributionConfig.Enabled}'
```

Common issues:

| Symptom | Likely cause | Fix |
|---|---|---|
| `CannotPullContainerError`, platform `linux/amd64` missing | Image was built on Apple Silicon as arm64 | Rebuild with `docker buildx build --platform linux/amd64 ... --push` |
| Health check returns `400` | Django `ALLOWED_HOSTS` rejects ALB health check host | Use `ALLOWED_HOSTS=*` for this deployment or configure allowed internal host behavior |
| Strava says `redirect_uri invalid` | `BACKEND_URL` does not match Strava callback domain | Set `BACKEND_URL` to the ECS public URL and set Strava Authorization Callback Domain to the same domain |
| Browser CORS error | Frontend origin not in `CORS_ALLOWED_ORIGINS` | Add the exact frontend origin, including scheme |
| CSRF failure | Frontend origin not trusted or cookies not sent | Add origin to `CSRF_TRUSTED_ORIGINS` and ensure frontend sends credentials |
| Login succeeds but frontend still shows logged out | Session cookie is blocked on cross-site requests | Use `SESSION_COOKIE_SAMESITE=None` and `SESSION_COOKIE_SECURE=True` |
| Refreshing `/runs` returns 403 or 404 | CloudFront/S3 is looking for a real `/runs` file | Add CloudFront custom error responses: `403/404 -> /index.html -> 200` |

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
