import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

const API_BASE = 'http://localhost:5000/api/documents';

const token = localStorage.getItem('token');
const params = new URLSearchParams(window.location.search);
const docId = params.get('docId');
const access = params.get('access'); // 'read' disables editing

if (!token) window.location.href = 'index.html';
if (!docId) {
  alert('No document ID provided');
  window.location.href = 'dashboard.html';
}



// ---------- Socket.io real-time sync ----------
const socket = io('http://localhost:5000', {
  auth: { token }
});

let isApplyingRemoteChange = false; // prevents echo loops
let remoteUpdateTimeout = null;

socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
  socket.emit('join-document', docId);
});

socket.on('error-message', (msg) => {
  showToast(msg, 'error');
});

socket.on('document-edit', ({ content, title, senderEmail }) => {
  if (!editor) return;

  isApplyingRemoteChange = true;

  // Apply remote content without disrupting focus if possible
  editor.commands.setContent(content, false); // false = don't emit another update event

  if (title && title !== titleInput.value) {
    titleInput.value = title;
  }

  isApplyingRemoteChange = false;
  saveStatus.textContent = `Updated by ${senderEmail}`;
});

socket.on('user-joined', ({ email }) => {
  showToast(`${email} joined the document`);
});

socket.on('user-left', ({ email }) => {
  showToast(`${email} left the document`);
});

socket.on('connect_error', (err) => {
  console.error('Socket connection error:', err.message);
});


let editor;
let currentDoc = null;
let saveTimeout = null;
let members = [];
let chatMessages = [];

const titleInput = document.getElementById('documentTitle');
const saveStatus = document.getElementById('saveStatus');

// ---------- Load & Init ----------
let currentPermission = 'view'; // default safe fallback

async function loadDocument() {
  try {
    const res = await fetch(`${API_BASE}/${docId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) {
      alert(data.message || 'Failed to load document');
      window.location.href = 'dashboard.html';
      return;
    }

    currentDoc = data.document;
    currentPermission = data.permission; // 'owner' | 'edit' | 'view'

    titleInput.value = currentDoc.title;
    document.title = currentDoc.title + ' - DocEditor';
    document.getElementById('shareAccessCode').value = currentDoc.accessCode || '';

    // Only owner can add/manage members
    const addMemberBtn = document.querySelector('.add-member-btn');
    if (addMemberBtn) addMemberBtn.style.display = currentPermission === 'owner' ? 'inline-flex' : 'none';
    
    renderMembersFromDoc();
    loadChatHistory();
    initEditor(currentDoc.content);
    setupToolbar();
  } catch (err) {
    console.error('Error loading document:', err);
    alert('Server error loading document');
  }
}


document.getElementById('marginSelect').onchange = (e) => {
  const el = document.getElementById('editor');
  el.classList.remove('margin-normal', 'margin-narrow', 'margin-wide');
  el.classList.add(`margin-${e.target.value}`);
};


function initEditor(content) {
  if (!StarterKit) {
    console.error('StarterKit failed to load — check network tab for failed CDN requests');
    showToast('Editor failed to load — check your connection and refresh', 'error');
    return;
  }

  const hasContent = content && typeof content === 'object' && Object.keys(content).length > 0;
  const isReadOnly = currentPermission === 'view';

  try {
    editor = new Editor({
      element: document.getElementById('editor'),
      editable: !isReadOnly,
      extensions: [
        StarterKit,
        Underline,
        TextStyle,
        Color,
        FontFamily,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Image,
        Link.configure({ openOnClick: false }),
        Table.configure({ resizable: true }),
        TableRow,
        TableHeader,
        TableCell
      ],
      content: hasContent ? content : '<p></p>',
      onUpdate: () => {
        updateToolbarState();
        if (!isReadOnly) {
          scheduleSave();
          if (!isApplyingRemoteChange) {
            broadcastChange();
          }
        }
      },
      onSelectionUpdate: () => updateToolbarState()
    });
  } catch (err) {
    console.error('Failed to initialize Tiptap editor:', err);
    showToast('Editor initialization failed — see console for details', 'error');
    return;
  }

  if (isReadOnly) {
    editor.setEditable(false);
    disableToolbar();
    saveStatus.textContent = 'View only';
  }
}


function disableToolbar() {
  document.querySelectorAll('.toolbar button, .toolbar input, .toolbar select').forEach(el => {
    el.disabled = true;
    el.style.opacity = '0.5';
    el.style.cursor = 'not-allowed';
  });

  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.disabled = true;

  // Download and Share should still work in read-only mode
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) downloadBtn.disabled = false;
}


// ---------- Toolbar wiring ----------
function setupToolbar() {
  const c = () => editor.chain().focus();

  document.getElementById('undoBtn').onclick = () => c().undo().run();
  document.getElementById('redoBtn').onclick = () => c().redo().run();

  document.getElementById('boldBtn').onclick = () => c().toggleBold().run();
  document.getElementById('italicBtn').onclick = () => c().toggleItalic().run();
  document.getElementById('underlineBtn').onclick = () => c().toggleUnderline().run();
  document.getElementById('strikeBtn').onclick = () => c().toggleStrike().run();

  document.getElementById('h1Btn').onclick = () => c().toggleHeading({ level: 1 }).run();
  document.getElementById('h2Btn').onclick = () => c().toggleHeading({ level: 2 }).run();
  document.getElementById('paragraphBtn').onclick = () => c().setParagraph().run();

  document.getElementById('alignLeftBtn').onclick = () => c().setTextAlign('left').run();
  document.getElementById('alignCenterBtn').onclick = () => c().setTextAlign('center').run();
  document.getElementById('alignRightBtn').onclick = () => c().setTextAlign('right').run();
  document.getElementById('alignJustifyBtn').onclick = () => c().setTextAlign('justify').run();

  document.getElementById('bulletListBtn').onclick = () => c().toggleBulletList().run();
  document.getElementById('orderedListBtn').onclick = () => c().toggleOrderedList().run();

  document.getElementById('textColorPicker').oninput = (e) => c().setColor(e.target.value).run();

  document.getElementById('fontFamilySelect').onchange = (e) => c().setFontFamily(e.target.value).run();

  document.getElementById('tableBtn').onclick = () => {
    const rows = parseInt(prompt('Number of rows:', '3'), 10);
    const cols = parseInt(prompt('Number of columns:', '3'), 10);
    if (rows && cols) {
      c().insertTable({ rows, cols, withHeaderRow: true }).run();
    }
  };

  document.getElementById('linkBtn').onclick = () => {
    const url = prompt('Enter URL:', 'https://');
    if (url) c().setLink({ href: url }).run();
  };

  document.getElementById('imageBtn').onclick = () => {
    document.getElementById('imageInput').click();
  };

  document.getElementById('imageInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      c().setImage({ src: ev.target.result }).run();
    };
    reader.readAsDataURL(file);
    // NOTE: base64 images bloat MongoDB documents — fine for now,
    // switch to server-hosted uploads (returning a URL) before production use.
  };

  document.getElementById('saveBtn').onclick = saveDocument;
  document.getElementById('downloadBtn').onclick = downloadDocument;
}

function updateToolbarState() {
  if (!editor) return;
  const map = {
    boldBtn: 'bold',
    italicBtn: 'italic',
    underlineBtn: 'underline',
    strikeBtn: 'strike',
    bulletListBtn: 'bulletList',
    orderedListBtn: 'orderedList'
  };
  Object.entries(map).forEach(([id, mark]) => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', editor.isActive(mark));
  });

  document.getElementById('h1Btn')?.classList.toggle('active', editor.isActive('heading', { level: 1 }));
  document.getElementById('h2Btn')?.classList.toggle('active', editor.isActive('heading', { level: 2 }));
}

// ---------- Save ----------
function scheduleSave() {
  saveStatus.textContent = 'Editing...';
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveDocument, 1000);
}

let broadcastTimeout = null;

function broadcastChange() {
  clearTimeout(broadcastTimeout);
  broadcastTimeout = setTimeout(() => {
    if (!editor) return;
    socket.emit('document-edit', {
      docId,
      content: editor.getJSON(),
      title: titleInput.value
    });
  }, 300); // shorter debounce than save — feels more "live"
}

titleInput.addEventListener('input', () => {
  if (access !== 'read') {
    scheduleSave();
    broadcastChange();
  }
});

async function saveDocument() {
  if (!editor) return;

  const content = editor.getJSON();
  const title = titleInput.value.trim() || 'Untitled Document';

  saveStatus.textContent = 'Saving...';

  try {
    const res = await fetch(`${API_BASE}/${docId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ title, content })
    });

    // Guard against non-JSON responses (e.g. Express's HTML 404 page)
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      console.error('Non-JSON response from server:', res.status, text.slice(0, 200));
      saveStatus.textContent = 'Error saving';
      showToast(`Save failed: server returned ${res.status}. Check backend logs.`, 'error');
      return;
    }

    const data = await res.json();

    if (res.ok) {
      saveStatus.textContent = 'Saved';
      showToast('Document saved successfully!');
    } else {
      saveStatus.textContent = 'Error saving';
      showToast(data.message || 'Failed to save document', 'error');
    }
  } catch (err) {
    saveStatus.textContent = 'Error saving';
    console.error('Save error:', err);
    showToast('Server error while saving', 'error');
  }
}

titleInput.addEventListener('input', () => {
  if (access !== 'read') scheduleSave();
});

// ---------- Download as .docx ----------
async function downloadDocument() {
  if (!editor) return;
  const title = titleInput.value || 'Document';
  const bodyHtml = editor.getHTML();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; line-height: 1.6; font-size: 12pt; }
        h1 { font-size: 18pt; font-weight: bold; margin: 24pt 0 12pt 0; }
        h2 { font-size: 16pt; font-weight: bold; margin: 18pt 0 6pt 0; }
        p { margin: 0 0 12pt 0; }
        table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
        td, th { border: 1pt solid #000; padding: 6pt; text-align: left; }
        img { max-width: 100%; height: auto; }
      </style>
    </head>
    <body>${bodyHtml}</body>
    </html>
  `;

  // Requires html-docx-js loaded separately (see note below)
  const converted = window.htmlDocx.asBlob(html);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(converted);
  a.download = `${title}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);

  showToast('Document downloaded as .docx!');
}

// ---------- Members (UI-only for now) ----------
function renderMembersFromDoc() {
  const list = document.getElementById('membersList');
  const isOwnerViewing = currentPermission === 'owner';

  const ownerRow = `
    <div class="member-item">
      <div class="member-avatar">${currentDoc.ownerEmail.substring(0, 2).toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${currentDoc.ownerEmail}</div>
        <div class="member-role">Owner</div>
      </div>
    </div>
  `;

  const collabRows = (currentDoc.collaborators || []).map(c => {
    const label = c.permission === 'edit' ? 'Can Edit' : 'Can View';
    const menuId = `menu-${c.email.replace(/[^a-zA-Z0-9]/g, '')}`;

    return `
      <div class="member-item">
        <div class="member-avatar">${c.email.substring(0, 2).toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${c.email}</div>
          <div class="member-role">${label}</div>
        </div>
        ${isOwnerViewing ? `
          <div class="member-menu-wrapper">
            <button class="member-menu-btn" data-menu="${menuId}">
              <i class="fas fa-ellipsis-vertical"></i>
            </button>
            <div class="member-dropdown" id="${menuId}">
              <button class="member-dropdown-item" data-action="edit" data-email="${c.email}">
                <i class="fas fa-pen"></i> Can Edit
              </button>
              <button class="member-dropdown-item" data-action="view" data-email="${c.email}">
                <i class="fas fa-eye"></i> Can View
              </button>
              <hr class="member-dropdown-divider">
              <button class="member-dropdown-item danger" data-action="remove" data-email="${c.email}">
                <i class="fas fa-trash"></i> Remove Access
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  list.innerHTML = ownerRow + collabRows;

  if (isOwnerViewing) {
    attachMemberMenuHandlers();
  }
}


async function updateCollaboratorPermission(email, permission) {
  try {
    const res = await fetch(`${API_BASE}/${docId}/collaborators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ email, permission })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || 'Failed to update permission', 'error');
      return;
    }

    currentDoc = data.document;
    renderMembersFromDoc();
    showToast(`${email} updated to ${permission === 'edit' ? 'Can Edit' : 'Can View'}`);
  } catch (err) {
    console.error(err);
    showToast('Server error updating permission', 'error');
  }
}

async function removeCollaborator(email) {
  try {
    const res = await fetch(`${API_BASE}/${docId}/collaborators/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || 'Failed to remove collaborator', 'error');
      return;
    }

    currentDoc = data.document;
    renderMembersFromDoc();
    showToast(`${email} removed`);
  } catch (err) {
    console.error(err);
    showToast('Server error removing collaborator', 'error');
  }
}



function attachMemberMenuHandlers() {
  // Toggle dropdown open/close
  document.querySelectorAll('.member-menu-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const menuId = btn.getAttribute('data-menu');
      const dropdown = document.getElementById(menuId);
      const isOpen = dropdown.classList.contains('show');

      // Close all other open dropdowns first
      document.querySelectorAll('.member-dropdown.show').forEach(d => d.classList.remove('show'));

      if (!isOpen) dropdown.classList.add('show');
    };
  });

  // Handle dropdown item clicks
  document.querySelectorAll('.member-dropdown-item').forEach(item => {
    item.onclick = async (e) => {
      e.stopPropagation();
      const action = item.getAttribute('data-action');
      const email = item.getAttribute('data-email');

      document.querySelectorAll('.member-dropdown.show').forEach(d => d.classList.remove('show'));

      if (action === 'edit' || action === 'view') {
        await updateCollaboratorPermission(email, action);
      } else if (action === 'remove') {
        if (confirm(`Remove ${email} from this document?`)) {
          await removeCollaborator(email);
        }
      }
    };
  });

  // Close any open dropdown when clicking elsewhere
  document.addEventListener('click', () => {
    document.querySelectorAll('.member-dropdown.show').forEach(d => d.classList.remove('show'));
  });
}

function openAddMemberModal() {
  document.getElementById('addMemberModal').style.display = 'block';
}

async function addMember() {
  const email = document.getElementById('memberEmail').value.trim();
  const permission = document.getElementById('memberPermission')?.value || 'view';

  if (!email) return showToast('Please enter an email address', 'error');

  try {
    const res = await fetch(`${API_BASE}/${docId}/collaborators`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ email, permission })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || 'Failed to add member', 'error');
      return;
    }

    currentDoc = data.document;
    renderMembersFromDoc();
    closeModal('addMemberModal');
    showToast(`${email} added`);
  } catch (err) {
    console.error(err);
    showToast('Server error adding member', 'error');
  }
}
window.addMember = addMember;

// ---------- Chat (UI-only for now) ----------
// ---------- Chat ----------
async function loadChatHistory() {
  try {
    const res = await fetch(`${API_BASE}/${docId}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok) {
      chatMessages = data.messages.map(m => ({
        user: m.senderEmail,
        message: m.message,
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));
      renderChatMessages();
    }
  } catch (err) {
    console.error('Failed to load chat history:', err);
  }
}

function renderChatMessages() {
  const chatContainer = document.getElementById('chatMessages');
  const userEmail = JSON.parse(localStorage.getItem('user') || '{}').email;

  chatContainer.innerHTML = chatMessages.map(msg => {
    const isMe = msg.user === userEmail;
    return `
      <div class="message ${isMe ? 'message-own' : ''}">
        <div class="message-header">
          <div class="message-name">${isMe ? 'You' : msg.user}</div>
          <div class="message-time">${msg.time}</div>
        </div>
        <div class="message-text">${escapeHtml(msg.message)}</div>
      </div>
    `;
  }).join('');
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.sendMessage = function () {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  socket.emit('send-chat-message', { docId, message });
  input.value = '';
};

socket.on('new-chat-message', ({ senderEmail, message, createdAt }) => {
  chatMessages.push({
    user: senderEmail,
    message,
    time: new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  renderChatMessages();
});


// ---------- Sidebar / Modal helpers (exposed globally for inline onclick) ----------
window.toggleLeftSidebar = () => document.getElementById('leftSidebar').classList.toggle('collapsed');
window.toggleRightSidebar = () => document.getElementById('rightSidebar').classList.toggle('collapsed');
window.openAddMemberModal = openAddMemberModal;
window.addMember = addMember;
window.openShareModal = () => { document.getElementById('shareModal').style.display = 'block'; };
window.closeModal = (id) => { document.getElementById(id).style.display = 'none'; };
window.copyShareLink = () => {
  const input = document.getElementById('shareAccessCode');
  input.select();
  document.execCommand('copy');
  showToast('Access code copied!');
  closeModal('shareModal');
};

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px;
    background: ${type === 'error' ? '#dc3545' : '#28a745'};
    color: white; padding: 12px 20px; border-radius: 4px;
    z-index: 10000; font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Save shortcut
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveDocument();
  }
});

document.getElementById('chatInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ---------- Kick things off ----------
renderChatMessages();
loadDocument();