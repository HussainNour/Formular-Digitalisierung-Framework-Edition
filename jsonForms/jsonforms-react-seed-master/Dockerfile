# 1. Build-Stage
FROM node:22-alpine AS build

# Arbeitsverzeichnis im Container
WORKDIR /app

# package-Dateien kopieren und Dependencies installieren
COPY package*.json ./
RUN npm install

# restlichen Code kopieren
COPY . .

# Production-Build erstellen
RUN npm run build

# 2. Runtime-Stage mit Nginx
FROM nginx:alpine

# Build aus der ersten Stage nach Nginx HTML-Verzeichnis kopieren
COPY --from=build /app/dist /usr/share/nginx/html
# oder bei create-react-app:
# COPY --from=build /app/build /usr/share/nginx/html

# Nginx-Port
EXPOSE 80

# Standard-Command von Nginx reicht aus
CMD ["nginx", "-g", "daemon off;"]
