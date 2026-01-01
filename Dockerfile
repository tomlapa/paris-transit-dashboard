# Multi-stage build optimized for Raspberry Pi
# Stage 1: Build search index
FROM python:3.11-slim as builder

WORKDIR /build

# Copy only what's needed for index building
COPY api/build_search_index.py ./api/
COPY data/perimetre-des-donnees-tr-disponibles-plateforme-idfm.csv ./data/

# Build search index
RUN python3 -c "from api.build_search_index import parse_csv_to_search_index; import json; index = parse_csv_to_search_index('./data/perimetre-des-donnees-tr-disponibles-plateforme-idfm.csv'); json.dump(index, open('./data/search_index.json', 'w'), ensure_ascii=False)"

# Stage 2: Runtime image
FROM python:3.11-slim

WORKDIR /app

# Install only runtime dependencies (no build tools)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && rm -rf /root/.cache

# Copy application files
COPY api/ ./api/
COPY static/ ./static/
COPY templates/ ./templates/
COPY main.py .
COPY transit-config.py .

# Copy pre-built search index from builder stage
COPY --from=builder /build/data/search_index.json ./data/

# Create non-root user for security
RUN useradd -m -u 1000 transit \
    && mkdir -p /data \
    && chown -R transit:transit /app /data

# Switch to non-root user
USER transit

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health').read()" || exit 1

# Run app with optimized settings for Raspberry Pi
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
