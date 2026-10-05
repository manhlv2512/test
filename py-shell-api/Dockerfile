FROM python:3.12-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# bash is needed to execute the .sh scripts
RUN apt-get update \
    && apt-get install -y --no-install-recommends bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app ./app
COPY scripts ./scripts
COPY config.yaml .

# Ensure scripts are executable
RUN chmod +x scripts/*.sh

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
