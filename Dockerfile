FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create data directory and set it as working directory for config
RUN mkdir -p /data && chmod 777 /data

# Expose port
EXPOSE 8080

# Run app - config.yaml will be created in /data
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
