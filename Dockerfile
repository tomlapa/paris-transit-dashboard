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

# Copy CSV data and build search index
COPY data/perimetre-des-donnees-tr-disponibles-plateforme-idfm.csv ./data/
RUN python3 -c "from api.build_search_index import parse_csv_to_search_index; import json; index = parse_csv_to_search_index('./data/perimetre-des-donnees-tr-disponibles-plateforme-idfm.csv'); json.dump(index, open('./data/search_index.json', 'w'), ensure_ascii=False)"

# Create data directory for persistent config
RUN mkdir -p /data && chmod 777 /data

# Expose port
EXPOSE 8080

# Run app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
