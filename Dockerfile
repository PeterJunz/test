FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY fb_ads_bot ./fb_ads_bot
CMD ["python", "-m", "fb_ads_bot"]
