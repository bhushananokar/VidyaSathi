FROM python:3.11-slim

WORKDIR /app

# Install system deps (for PyMuPDF and brotli)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev mupdf-tools gcc g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.5.1+cpu --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
