FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY api/ ./api/
COPY static/ ./static/
COPY templates/ ./templates/
COPY main.py .
COPY transit-config.py .

# Create data directory for persistent config
RUN mkdir -p /data && chmod 777 /data

# Expose port
EXPOSE 8080

# Run app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
