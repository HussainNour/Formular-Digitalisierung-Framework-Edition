

# JSONForms Manager (Zuarbeit & Dozenten) – Frontend + File-API

Eine React-basierte Webanwendung zur strukturierten Pflege von Lehrplanungs-/Lehrveranstaltungsdaten. Die UI nutzt **JSON Forms (Material Renderers)**, um Datenmodelle als Formular- und Listenansichten darzustellen. Persistenz erfolgt über eine **Node/Express File-API**, die JSON-Dokumente im Dateisystem speichert.

---
## Vorschau
![frontendJsonForms](/jsonForms/Bilder/frontend_variante_b1.png)
![frontendJsonForms](/jsonForms/Bilder/frontend_variante_b2.png)
![frontendJsonForms](/jsonForms/Bilder/frontend_variante_b3.png)
![frontendJsonForms](/jsonForms/Bilder/frontend_variante_b4.png)
![frontendJsonForms](/jsonForms/Bilder/frontend_variante_b5.png)
![frontendJsonForms](/jsonForms/Bilder/frontend_variante_b6.png)
![frontendJsonForms](/jsonForms/Bilder/frontend_variante_b7.png)
![frontendJsonForms](/jsonForms/Bilder/frontend_variante_b8.png)
![frontendJsonForms](/jsonForms/Bilder/frontend_variante_b9.png)


## Überblick

### Hauptmodule

* **Zuarbeit**

  * Array-/Listenansicht (JSONForms)
  * Einzel-Editor pro Datensatz (ID-basiert)
* **Dozenten**

  * Array-/Listenansicht (JSONForms)
  * Einzel-Editor pro Datensatz (ID-basiert)
* **Autofill-Module**

  * Bearbeitung einer Modul-JSON im Browser
  * Export als JSON-Datei (Download)
* **Login**

  * Token-basierte Requests im Frontend

---

## Features

### Zuarbeit

* **Array-Seite** (Route: `/zuarbeit`) lädt/speichert die gesamte Liste über die API `.../Zuarbeit`. 
* **Einzel-Editor** (Route: `/zuarbeit/:id`) lädt einen Datensatz per ID und speichert per `PUT`. 

### Dozenten

* **Array-Seite** (Route: `/dozenten`) lädt/speichert über die API `.../Dozenten`. 
* **Einzel-Editor: `DozentenEditor`** (Route: `/dozenten/:id`) lädt/speichert einen Datensatz per ID. 
* Share-Links werden aus `window.location.origin` erzeugt und verweisen auf den jeweiligen Einzel-Editor. 

### Autofill-Module

* Route: `/autofill`. 
* Änderungen erfolgen browserseitig; Export als `INB_module.json` per Download. 

---

## Routen

Die Routen sind in `App.tsx` definiert: 

* `/` – Start/Übersicht
* `/zuarbeit` – Zuarbeit (Array)
* `/zuarbeit/:id` – Zuarbeit Einzel-Editor (`ZuarbeitEditor`)
* `/dozenten` – Dozenten (Array)
* `/dozenten/:id` – Dozenten Einzel-Editor (`DozentenEditor`)
* `/autofill` – Autofill-Module
* `/login` – Login

---

## API-Konzept

Standardmäßig erwartet das Frontend die File-API unter:

* `http://localhost:5050/Zuarbeit` 
* `http://localhost:5050/Dozenten` 

Empfohlene Endpunkte (CRUD):

* `GET /Zuarbeit`, `POST /Zuarbeit`, `PUT /Zuarbeit/:id`, `DELETE /Zuarbeit/:id`
* `GET /Dozenten`, `POST /Dozenten`, `PUT /Dozenten/:id`, `DELETE /Dozenten/:id`
* optional: `POST /login` (Token)

**Hinweis Auth (Frontend):**
API-Requests werden (wo implementiert) tokenbasiert über `fetchAuth(...)` ausgeführt; bei abgelaufenen/ungültigen Tokens erfolgt Redirect zum Login. 

---

## Projektstruktur (Auszug)

Frontend:

* `App.tsx` – Routing & Navigation 
* `JsonFormsDemo.tsx` – Zuarbeit Array 
* `ZuarbeitEditor.tsx` – Zuarbeit Einzel-Editor 
* `jsonFormsDozenten.tsx` – Dozenten Array 
* `DozentenEditor.tsx` – Dozenten Einzel-Editor 
* `AutofillManager.tsx` – Autofill-Module & Export 

Backend:

* `jfs-server.js` – Node/Express File-API (Entry im Projekt-Root)

---

## Voraussetzungen

* Node.js (empfohlen: **20.x**)
* npm
* Optional: Container Runtime (Podman oder Docker) für Containerbetrieb

---

## Setup & Entwicklung

### Installation

```bash
npm install
```

### Frontend starten

```bash
npm run dev -- --host 0.0.0.0 --port 3000
```

### Backend starten

```bash
node jfs-server.js
```

oder für Development mit Auto-Restart:

```bash
npx nodemon jfs-server.js
```

Standard-URLs:

* Frontend: `http://localhost:3000`
* Backend: `http://localhost:5050`

---

## Containerbetrieb

### Persistenz & Schreibrechte (wichtig)

Da die File-API JSON-Dokumente im Dateisystem speichert, muss das Backend in ein Verzeichnis schreiben, das:

1. existiert,
2. beschreibbar ist,
3. als Volume gemountet wird (Persistenz).

Empfehlung:

* Datenpfad im Container: `/app/data`
* Übergabe per Umgebungsvariable: `DATA_ROOT=/app/data`
* Volume-Mount: Host-Ordner → `/app/data`

### Beispiel (generisch)

```bash
# Image bauen (Dockerfile oder Containerfile)
podman build -t my-node-react -f Containerfile .

# Datenordner vorbereiten
mkdir -p ./data/Zuarbeit ./data/Dozenten

# Backend starten (Volume + DATA_ROOT)
podman run --name my-backend -p 5050:5050 \
  -e DATA_ROOT=/app/data \
  -v "$(pwd)/data:/app/data" \
  my-node-react npx nodemon jfs-server.js

# Frontend starten
podman run --name my-frontend -p 3000:3000 \
  my-node-react npm run dev -- --host 0.0.0.0 --port 3000
```

> Damit `DATA_ROOT` wirksam ist, muss das Backend diesen Wert auch verwenden (Store-Pfade daraus ableiten und Verzeichnisse beim Start anlegen).

---

## Troubleshooting

### `net::ERR_EMPTY_RESPONSE` / `TypeError: Failed to fetch` bei PUT/POST

In der Regel antwortet das Backend nicht korrekt (Crash/Restart) oder scheitert beim Schreiben ins Dateisystem.

Prüfen:

* Backend-Logs:

  ```bash
  podman logs --tail 200 my-backend
  ```
* Schreibtest im Container:

  ```bash
  podman exec -it my-backend sh -lc "mkdir -p /app/data/test && echo ok >/app/data/test/a.txt && cat /app/data/test/a.txt"
  ```

### Änderungen erscheinen im Container nicht

Ohne Source-Mount enthält das Image nur den Stand vom Build. Lösung:

* Image neu bauen, oder
* Quellcode als Volume mounten (Dev-Workflow).

### Einzel-Editor „nicht gefunden“

Einzel-Editoren versuchen zuerst `GET /…/:id` und nutzen sonst `GET /…` als Fallback (Liste laden und nach `id` suchen).
Prüfen:

* existiert der Datensatz in der Liste?
* ist `id` gesetzt und korrekt?

---

## Lizenz

Dieses Projekt ist unter der **MIT-Lizenz** veröffentlicht.

Lege eine Datei `LICENSE` im Projekt-Root an (Jahr/Name anpassen):

```text
MIT License

Copyright (c) 2026 <Nouralrahman Hussain>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

Wenn du möchtest, kann ich die README zusätzlich mit folgenden professionellen Elementen erweitern: `.env.example`, API-Beispiel-Requests (curl), Release-/Build-Abschnitt (Production Build), sowie eine kurze „User Journey“ (Schritt-für-Schritt: Login → Liste laden → Datensatz editieren → Share-Link).

