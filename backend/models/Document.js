const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['document', 'whiteboard'],
    default: 'document'
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ownerEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  collaborators: [{
    email: { type: String, lowercase: true, required: true },
    permission: { type: String, enum: ['view', 'edit'], default: 'view' }
  }],
  accessCode: {
    type: String,
    unique: true,
    sparse: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);