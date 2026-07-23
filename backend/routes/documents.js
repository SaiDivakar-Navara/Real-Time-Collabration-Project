const express = require('express');
const crypto = require('crypto');
const Document = require('../models/Document');
const authMiddleware = require('../middleware/authMiddleware');
const ChatMessage = require('../models/ChatMessage');

const router = express.Router();

// All routes below require a valid JWT
router.use(authMiddleware);

// CREATE a new document (or whiteboard)
router.post('/', async (req, res) => {
  try {
    const { title, type } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const newDocument = new Document({
      title: title.trim(),
      type: type === 'whiteboard' ? 'whiteboard' : 'document',
      content: {},
      ownerEmail: req.user.email,
      accessCode: crypto.randomBytes(4).toString('hex') // e.g. "a1b2c3d4"
    });

    await newDocument.save();

    res.status(201).json({
      message: 'Document created successfully',
      document: newDocument
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET all documents belonging to (or shared with) the logged-in user
router.get('/', async (req, res) => {
  try {
    const email = req.user.email;

    const documents = await Document.find({
      $or: [
        { ownerEmail: email },
        { 'collaborators.email': email }
      ]
    }).sort({ updatedAt: -1 });

    res.status(200).json({ documents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET a single document by ID (returns permission level too)
router.get('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const email = req.user.email;
    let permission = null;

    if (document.ownerEmail === email) {
      permission = 'owner';
    } else {
      const collaborator = document.collaborators.find(c => c.email === email);
      if (collaborator) permission = collaborator.permission;
    }

    if (!permission) {
      return res.status(403).json({ message: 'You do not have access to this document' });
    }

    res.status(200).json({ document, permission });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// UPDATE document content (used when saving edits)
router.put('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const email = req.user.email;
    const isAuthorized =
      document.ownerEmail === email ||
      document.collaborators.some(c => c.email === email && c.permission === 'edit');

    if (!isAuthorized) {
      return res.status(403).json({ message: 'You do not have permission to edit this document' });
    }

    const { title, content } = req.body;
    if (title !== undefined) document.title = title;
    if (content !== undefined) document.content = content;

    await document.save();

    res.status(200).json({ message: 'Document updated', document });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE a document (only the owner can delete)
router.delete('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Only the owner can delete this document' });
    }

    await document.deleteOne();
    res.status(200).json({ message: 'Document deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ADD or UPDATE a collaborator (owner only)
router.post('/:id/collaborators', async (req, res) => {
  try {
    const { email, permission } = req.body;

    if (!email || !['view', 'edit'].includes(permission)) {
      return res.status(400).json({ message: 'Valid email and permission (view/edit) are required' });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Only the owner can manage collaborators' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (normalizedEmail === document.ownerEmail) {
      return res.status(400).json({ message: 'Owner already has full access' });
    }

    const existing = document.collaborators.find(c => c.email === normalizedEmail);
    if (existing) {
      existing.permission = permission; // update permission if already a collaborator
    } else {
      document.collaborators.push({ email: normalizedEmail, permission });
    }

    await document.save();

    res.status(200).json({ message: 'Collaborator added', document });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// REMOVE a collaborator (owner only)
router.delete('/:id/collaborators/:email', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (document.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Only the owner can manage collaborators' });
    }

    const emailToRemove = req.params.email.toLowerCase();
    document.collaborators = document.collaborators.filter(c => c.email !== emailToRemove);

    await document.save();
    res.status(200).json({ message: 'Collaborator removed', document });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});




// JOIN a document using an access code (adds requester as a 'view' collaborator by default)
router.post('/join', async (req, res) => {
  try {
    const { accessCode } = req.body;

    if (!accessCode || !accessCode.trim()) {
      return res.status(400).json({ message: 'Access code is required' });
    }

    const document = await Document.findOne({ accessCode: accessCode.trim() });

    if (!document) {
      return res.status(404).json({ message: 'Invalid access code' });
    }

    const email = req.user.email;

    // Owner trying to join their own doc — just send them straight in
    if (document.ownerEmail === email) {
      return res.status(200).json({ message: 'You are the owner of this document', documentId: document._id });
    }

    // Already a collaborator — don't duplicate, just let them back in
    const existing = document.collaborators.find(c => c.email === email);
    if (!existing) {
      document.collaborators.push({ email, permission: 'view' }); // default to view-only when joining via code
      await document.save();
    }

    res.status(200).json({ message: 'Joined document successfully', documentId: document._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET chat history for a document
router.get('/:id/messages', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const email = req.user.email;
    const isAuthorized =
      document.ownerEmail === email ||
      document.collaborators.some(c => c.email === email);

    if (!isAuthorized) {
      return res.status(403).json({ message: 'You do not have access to this document' });
    }

    const messages = await ChatMessage.find({ documentId: req.params.id })
      .sort({ createdAt: 1 })
      .limit(200); // reasonable cap; oldest messages beyond this won't load

    res.status(200).json({ messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;