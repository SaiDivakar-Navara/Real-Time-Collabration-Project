require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const connectDB = require('./utils/db');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const Document = require('./models/Document');
const ChatMessage = require('./models/ChatMessage');


const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // tighten this to your actual frontend origin before production
    methods: ['GET', 'POST']
  }
});

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// ---------- Socket.io ----------

// Authenticate every socket connection using the same JWT as REST routes
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token provided'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded; // { id, email }
    next();
  } catch (err) {
    next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.user.email}`);

  socket.on('join-document', async (docId) => {
    try {
      const document = await Document.findById(docId);
      if (!document) return;

      const email = socket.user.email;
      const isOwner = document.ownerEmail === email;
      const collaborator = document.collaborators.find(c => c.email === email);

      if (!isOwner && !collaborator) {
        socket.emit('error-message', 'You do not have access to this document');
        return;
      }

      socket.join(docId);
      socket.currentDocId = docId;

      // Let others in the room know someone joined (for presence, later)
      socket.to(docId).emit('user-joined', { email });

      console.log(`${email} joined document room: ${docId}`);
    } catch (err) {
      console.error('join-document error:', err);
    }
  });

  socket.on('document-edit', ({ docId, content, title }) => {
    if (socket.currentDocId !== docId) return; // safety: only broadcast if actually in this room

    // Broadcast to everyone else in the room (not back to sender)
    socket.to(docId).emit('document-edit', { content, title, senderEmail: socket.user.email });
  });

  socket.on('disconnect', () => {
    if (socket.currentDocId) {
      socket.to(socket.currentDocId).emit('user-left', { email: socket.user.email });
    }
    console.log(`Socket disconnected: ${socket.user.email}`);
  });


  socket.on('send-chat-message', async ({ docId, message }) => {
    if (socket.currentDocId !== docId) return;
    if (!message || !message.trim()) return;

    try {
      const chatMessage = new ChatMessage({
        documentId: docId,
        senderEmail: socket.user.email,
        message: message.trim()
      });
      await chatMessage.save();

      // Broadcast to everyone in the room, INCLUDING the sender (so their own message renders too)
      io.to(docId).emit('new-chat-message', {
        senderEmail: chatMessage.senderEmail,
        message: chatMessage.message,
        createdAt: chatMessage.createdAt
      });
    } catch (err) {
      console.error('send-chat-message error:', err);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});