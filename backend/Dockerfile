FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data

# シードデータ投入（初回のみ）→ サーバー起動
CMD ["sh", "-c", "python seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8001"]
