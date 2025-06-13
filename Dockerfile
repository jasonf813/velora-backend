# Base image with Node.js and Python
FROM node:18-slim

# Install dependencies for Python and system
RUN apt-get update && apt-get install -y \
  python3 \
  python3-pip \
  python3-venv \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

# Buat virtual environment
RUN python3 -m venv /opt/venv

# Aktifkan virtual env & tambahkan ke PATH
ENV PATH="/opt/venv/bin:$PATH"

# Set workdir
WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY requirements.txt ./

# Install deps
RUN npm install
RUN pip install --no-cache-dir -r requirements.txt

# Copy semua file project
COPY . .

# Jalankan server
CMD ["npm", "start"]