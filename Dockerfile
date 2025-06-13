# Gunakan image Node.js sebagai base
FROM node:18

# Install Python 3, pip, dan dependensi sistem tambahan
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-dev build-essential && \
    apt-get clean

# Pastikan python bisa dipanggil
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Set direktori kerja
WORKDIR /app

# Salin dan install dependensi Node.js
COPY package*.json ./
RUN npm install

# Salin dan install dependensi Python
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# Salin semua source code
COPY . .

# Jalankan aplikasi Node.js
CMD ["npm", "start"]
