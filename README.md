# CAST CRM — Backend API
## Revenue Engine v3.0 · Node.js + Express + Google Workspace

---

## Requisitos

- Node.js 18+
- Google Cloud Project con Service Account
- Google Workspace (Sheets, Drive, Gmail, Calendar)

---

## Instalación

```bash
cd cast-crm-backend
npm install
cp .env.example .env
# Edita .env con tus credenciales reales
```

---

## Configuración de Google Service Account

1. Ve a [Google Cloud Console](https://console.cloud.google.com)
2. Crea un proyecto o usa uno existente
3. Activa las APIs: Sheets, Drive, Gmail, Calendar
4. Crea una **Service Account** y descarga el archivo JSON de credenciales
5. Copia `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` en `.env`
6. Copia `private_key` → `GOOGLE_PRIVATE_KEY` en `.env` (mantén los `\n`)
7. **Importante para Gmail:** Activa "Domain-wide Delegation" en la Service Account y configura los scopes en Google Workspace Admin

---

## Setup inicial (ejecutar UNA VEZ)

```bash
# 1. Crear carpetas en Google Drive
node scripts/setupDrive.js
# → Copia los IDs que imprime al .env

# 2. Crear hojas en Google Sheets + usuarios iniciales
node scripts/setupSheets.js
```

---

## Ejecución

```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

El servidor corre en `http://localhost:3001`

---

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login con email/password |
| GET | `/api/leads` | Lista todos los leads |
| POST | `/api/leads` | Crear nuevo lead |
| PATCH | `/api/leads/:id/stage` | Cambiar etapa |
| GET | `/api/blueprint/:leadId` | Obtener sesión Blueprint |
| POST | `/api/blueprint/:leadId/approve` | Aprobar output (CEO only) |
| POST | `/api/calendar/blueprint-session` | Crear evento en Google Calendar |
| POST | `/api/emails/session-confirmed` | Enviar Email 1 |
| GET | `/api/dashboard/stats` | Métricas del dashboard |
| POST | `/api/webhooks/n8n/lead-received` | Webhook desde n8n |

---

## Variables de entorno

Ver `.env.example` para la lista completa.

---

## Credenciales por defecto (después del setup)

- **CEO:** `carlos@castconsultorias.com` / `cast2026`
- **Equipo:** `equipo@castconsultorias.com` / `cast2026`

> ⚠️ Cambia las contraseñas en producción

---

*CAST Consultorías SAS · "No vendemos consultoría. Construimos el futuro."*
