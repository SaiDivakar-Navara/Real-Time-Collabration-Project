const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true
  },
  senderEmail: {
    type: String,
    required: true,
    lowercase: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);