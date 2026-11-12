# Runs the API on your own server (Docker). Online on Vercel, api/index.py is used instead.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt "uvicorn[standard]>=0.30"
COPY . .
EXPOSE 8000
# Several workers so one slow request doesn't hold up the others.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2", "--proxy-headers"]
