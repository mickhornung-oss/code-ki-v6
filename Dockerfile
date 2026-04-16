# Code KI V6 — Backend API
# Runs without a local LLM model — set MODEL_PATH to your .gguf file.
#
# Build:  docker build -t code-ki .
# Run:    docker run -p 8787:8787 -v /path/to/models:/models \
#           -e MODEL_PATH=/models/your-model.gguf code-ki
#
# Note: llama-cpp-python requires a compatible CPU/GPU.
# For CPU-only inference the image works out of the box.

FROM python:3.11-slim

WORKDIR /app

# Build tools needed for llama-cpp-python compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (llama-cpp-python compiles here)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY config/ ./config/

ENV HOST=0.0.0.0
ENV PORT=8787

EXPOSE 8787

CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8787"]
