# DYC CODING CAMPUS — Web-Based Online Compiler Platform

A production-ready, secure, and modern Web-Based Online Compiler Platform. Users can edit code inside a Monaco editor, compile it, and run it inside isolated, resource-constrained Docker containers. System administrators can monitor execution metrics, audit logs, and toggle supported environments.

## Tech Stack
* **Frontend**: React (Vite), Tailwind CSS, Monaco Editor, Axios, Recharts, Lucide Icons, React Hook Form.
* **Backend**: Python FastAPI, Pydantic, Motor (MongoDB Async), Docker SDK, Passlib (bcrypt).
* **Database**: MongoDB.
* **Gateway & Proxy**: Nginx.
* **Orchestration**: Docker Compose.

---

## Folder Structure
```
Online-compiler/
├── backend/                  # FastAPI Web Application
│   ├── app/
│   │   ├── config.py         # Settings & environment variables
│   │   ├── database.py       # Async Motor connection & DB seeder
│   │   ├── models.py         # Request/Response Pydantic models
│   │   ├── auth.py           # JWT generation & password hashing
│   │   ├── executor.py       # Sandboxed Docker execution engine
│   │   └── routes/           # Routing controllers
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # React Application
│   ├── src/
│   │   ├── components/       # Custom Terminal, Navbar, Sidebar
│   │   ├── context/          # JWT Auth Context
│   │   ├── pages/            # Landing, Editor, Analytics, Profile
│   │   └── api.js            # Axios JWT interceptors
│   ├── index.html
│   ├── package.json
│   └── Dockerfile
├── docker/
│   └── nginx/
│       └── default.conf      # Nginx routing proxies
├── docker-compose.yml        # Orchestration YAML
└── README.md
```

---

## Security Sandbox Engine

Every execution request is compiled and executed in a sandboxed, dedicated, single-use container:
1. **Network**: Blocked (`network_mode="none"`). No curl, wget, or socket calls to external servers.
2. **CPU Limit**: `1.0` Core maximum.
3. **Memory Limit**: `256MB` limit. Out-of-memory errors (OOM) will terminate execution immediately.
4. **Storage Limit**: Writable workspace size is constrained to a `50MB` RAM-based tmpfs folder, with the remainder of the container mounted as read-only.
5. **Execution Timeout**: Enforced at `5 seconds`. Processes looping indefinitely are forcefully terminated.
6. **PID Limit**: Cap of `30` parallel processes to prevent fork-bombs from crashing the host machine.
7. **Permissions**: Containers run as a non-privileged `nobody` user.

---

## REST API Specification

### Authentication Module
* `POST /api/auth/register` - Create user account (default role: `user`).
* `POST /api/auth/login` - Authenticate credentials. Returns Access token (30m) & Refresh token (7d).
* `POST /api/auth/refresh` - Swap refresh token for fresh access token.
* `GET /api/auth/me` - Retrieve current user profile details.
* `PUT /api/auth/me` - Update profile name or password.

### Program Management
* `GET /api/programs` - List logged-in user's files.
* `POST /api/programs` - Create program file.
* `GET /api/programs/{id}` - Fetch single file data.
* `PUT /api/programs/{id}` - Update title, language, or code.
* `DELETE /api/programs/{id}` - Delete program file.

### Execution Sandbox
* `POST /api/execute` - Compile and run code.
* `GET /api/history` - Read execution history logs.

### Administration Panels
* `GET /api/admin/users` - Search and list user database.
* `PUT /api/admin/users/{id}/block` - Block/unblock a user.
* `DELETE /api/admin/users/{id}` - Delete user and all their code assets.
* `GET /api/admin/analytics` - Fetch telemetry totals and Recharts time-series data.
* `GET /api/admin/logs` - Fetch security activity logs.
* `GET /api/admin/languages` - List supported execution environments.
* `PUT /api/admin/languages/{name}` - Toggle availability of any language.

---

## Local Deployment & Testing

### Prerequisites
Make sure you have **Docker** and **Docker Compose** installed on your host machine.

### Start the Platform
Run the following command in the root folder containing `docker-compose.yml`:
```bash
docker compose up --build
```
This will compile and launch the services:
1. Nginx proxy gateway on: `http://localhost/` (Port 80)
2. React frontend on: `http://localhost:5173/` (Proxied via Nginx)
3. FastAPI backend docs on: `http://localhost/docs` (Proxied via Nginx)
4. MongoDB database running on: `localhost:27017`

### Default Admin Credentials
For testing and system administration, the database seeds a default administrator on initial boot:
* **Email**: `admin@compiler.com`
* **Password**: `adminpassword`
