# Real-Time Collaboration

A real-time collaborative document editor — think Google Docs, built from scratch with Node.js, Express, MongoDB, and Tiptap. Multiple users can register, create documents, share them with granular permissions, edit together live, and chat inside each document.

## Features

- **Authentication** — secure register/login with hashed passwords (bcrypt) and JWT-based sessions
- **Document management** — create, open, rename, and delete documents from a personal dashboard
- **Rich text editing** — powered by [Tiptap](https://tiptap.dev/): bold, italic, underline, strikethrough, headings, text alignment, font family, text color, bullet/numbered lists, tables, links, and images
- **Google Docs–style editor UI** — centered A4-style page, dynamic height, adjustable margins (normal/narrow/wide)
- **Download as .docx** — export any document to a real Word file
- **Sharing & permissions**
  - Owner can invite collaborators by email with `view` or `edit` access
  - Owner can change or revoke a collaborator's access at any time (via a per-member menu)
  - Anyone with a document's **access code** can join instantly (default `view` access)
- **Real-time collaboration** — edits sync live between everyone viewing a document, powered by Socket.io
- **Per-document chat** — collaborators can message each other inside a document, with full message history persisted in MongoDB
- **Access control enforced server-side** — permissions are checked on every API route and socket event, not just hidden in the UI

## Tech Stack

**Frontend**
- HTML, CSS, JavaScript (vanilla, no framework/build step)
- [Tiptap](https://tiptap.dev/) (ProseMirror-based rich text editor)
- [Socket.io Client](https://socket.io/)
- [html-docx-js](https://github.com/evidenceprime/html-docx-js) for `.docx` export

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- [Socket.io](https://socket.io/) for real-time sync
- JSON Web Tokens (JWT) for authentication
- bcryptjs for password hashing

## Project Structure

```
app/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   ├── Document.js
│   │   └── ChatMessage.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── documents.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── utils/
│   │   └── db.js
│   ├── server.js
│   ├── package.json
│   └── .env              # not committed — see Setup below
│
└── frontend/
    ├── index.html         # login / sign-up landing page
    ├── script.js
    ├── styles.css
    ├── dashboard.html      # user's document dashboard
    ├── dashboard.js
    ├── dashboard.css
    ├── editor.html         # collaborative document editor
    ├── editor.js
    ├── editor.css
    ├── whiteboard.html     # (in progress)
    ├── whiteboard.js
    └── whiteboard.css
```

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) — either a local instance or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- A code editor with a live server extension (e.g. VS Code + Live Server) to run the frontend

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>/app
```

### 2. Backend setup
```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:
```
MONGO_URI=mongodb://127.0.0.1:27017/projectK
JWT_SECRET=replace_this_with_a_long_random_secret
PORT=5000
```
> If using MongoDB Atlas, replace `MONGO_URI` with your Atlas connection string.

Start the backend (with auto-restart on file changes):
```bash
npm run dev
```
You should see:
```
Server running on port 5000
MongoDB connected successfully
```

### 3. Frontend setup
No build step required. Open the `frontend/` folder in VS Code and launch `index.html` with **Live Server** (or any static file server).

> The frontend expects the backend to be running at `http://localhost:5000`. Update the `API_BASE` constant in `dashboard.js` / `editor.js` and the URLs in `script.js` if you run the backend on a different port.

### 4. Try it out
1. Open `index.html` → create an account → log in
2. From the dashboard, create a new document
3. Open the document in the editor, start typing
4. Click **Share** to copy the document's access code, or use **Add Member** to invite a collaborator by email
5. Open the same document in a second browser (or an incognito window, logged in as a different user) to see real-time sync and chat in action

## API Overview

All `/api/documents/*` routes (except `register`/`login`) require a valid JWT sent as `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Log in, returns a JWT |
| POST | `/api/documents` | Create a new document |
| GET | `/api/documents` | List documents owned by or shared with the user |
| GET | `/api/documents/:id` | Get a document's content and the requester's permission level |
| PUT | `/api/documents/:id` | Save document title/content |
| DELETE | `/api/documents/:id` | Delete a document (owner only) |
| POST | `/api/documents/join` | Join a document using its access code |
| POST | `/api/documents/:id/collaborators` | Add or update a collaborator's permission (owner only) |
| DELETE | `/api/documents/:id/collaborators/:email` | Remove a collaborator (owner only) |
| GET | `/api/documents/:id/messages` | Fetch chat history for a document |

### Socket.io events

| Event | Direction | Description |
|---|---|---|
| `join-document` | client → server | Join a document's real-time room |
| `document-edit` | both | Broadcast/receive live content changes |
| `send-chat-message` | client → server | Send a chat message |
| `new-chat-message` | server → client | Receive a chat message |
| `user-joined` / `user-left` | server → client | Presence notifications |

## Known Limitations / Roadmap

- Images are currently stored as base64 inside document content — fine for testing, but should move to a dedicated upload endpoint (disk or cloud storage) before real-world use, since MongoDB documents are capped at 16MB
- Real-time sync uses a "broadcast full content" strategy rather than operational transforms/CRDTs (e.g. Yjs) — two users editing the exact same spot at the exact same moment can overwrite one another
- No live "who's currently viewing" presence indicators yet (join/leave toasts exist, but no persistent online list)
- Whiteboard functionality is scaffolded in the file structure but not yet implemented
- No rate limiting on auth endpoints yet

## License

This project is for educational/portfolio purposes.