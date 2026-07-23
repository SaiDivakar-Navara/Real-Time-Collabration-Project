// Check if the user is logged in
        // This script runs before the rest of the body loads,
        // ensuring immediate redirection if not authenticated.
// if (localStorage.getItem('isLoggedIn') !== 'true') {
//     window.location.href = 'index.html'; // Redirect to login page
// }



// const user = JSON.parse(localStorage.getItem("user"));
//     if (!user) {
//       window.location.href = "index.html"; // redirect if not logged in
//     } else {
//       document.getElementById("user-info").innerHTML = `
//         <p> Wecome! ${user.firstName}</p>
//       `;
//     }


// Global variables
let sidebarOpen = true;
let userDropdownOpen = false;

// DOM ready function
document.addEventListener('DOMContentLoaded', function() {
    console.log('Project-K Dashboard loaded successfully!');
    initializeEventListeners();
});

// Initialize all event listeners
function initializeEventListeners() {
    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!event.target.closest('.user-dropdown')) {
            closeUserDropdown();
        }
        
        if (!event.target.closest('.modal') && event.target.classList.contains('modal-overlay')) {
            closeJoinCollabModal();
        }
    });
    
    // Add click handlers to all buttons
    addButtonHandlers();
}

// Add click handlers to buttons
function addButtonHandlers() {
    // Navigation buttons
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const buttonText = this.querySelector('span').textContent;
            console.log(`Navigating to: ${buttonText}`);
            showNotification(`Opening ${buttonText}`);
        });
    });
    
    // Action card buttons
    // const actionCards = document.querySelectorAll('.action-card');
    // actionCards.forEach(card => {
    //     card.addEventListener('click', function() {
    //         const title = this.querySelector('h3').textContent;
    //         console.log(`Action clicked: ${title}`);
    //         showNotification(`${title} functionality coming soon!`);
    //     });
    // });
    

    // Sidebar creation buttons
    const documentBtn = document.querySelector('.document-btn');
    const whiteboardBtn = document.querySelector('.whiteboard-btn');
    
    if (documentBtn) {
        documentBtn.addEventListener('click', function() {
            console.log('Creating new document...');
            showNotification('Creating new document...');
        });
    }
    
    if (whiteboardBtn) {
        whiteboardBtn.addEventListener('click', function() {
            console.log('Creating new whiteboard...');
            showNotification('Creating new whiteboard...');
        });
    }
    
    // Work card clicks
    const workCards = document.querySelectorAll('.work-card:not(.create-new)');
    workCards.forEach(card => {
        card.addEventListener('click', function() {
            const title = this.querySelector('.card-title').textContent;
            console.log(`Opening: ${title}`);
            showNotification(`Opening "${title}"`);
        });
    });
    
    // Create new card
    const createNewCard = document.querySelector('.create-new');
    if (createNewCard) {
        createNewCard.addEventListener('click', function() {
            console.log('Create new clicked');
            showNotification('Choose document or whiteboard from sidebar');
        });
    }
    
    // Dropdown items
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', function() {
            const text = this.textContent.trim();
            console.log(`Dropdown action: ${text}`);
            
            if (text === 'Logout') {
                handleLogout();
            } else {
                showNotification(`${text} functionality coming soon!`);
            }
            
            closeUserDropdown();
        });
    });
}

// Toggle user dropdown
function toggleUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    userDropdownOpen = !userDropdownOpen;
    
    if (userDropdownOpen) {
        dropdown.classList.add('show');
    } else {
        dropdown.classList.remove('show');
    }
}

// Close user dropdown
function closeUserDropdown() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.classList.remove('show');
    userDropdownOpen = false;
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebarOpen = !sidebarOpen;
    
    if (window.innerWidth <= 1024) {
        if (sidebarOpen) {
            sidebar.classList.add('show');
        } else {
            sidebar.classList.remove('show');
        }
    } else {
        if (sidebarOpen) {
            sidebar.classList.remove('collapsed');
        } else {
            sidebar.classList.add('collapsed');
        }
    }
    
    console.log(`Sidebar ${sidebarOpen ? 'opened' : 'closed'}`);
}



function openJoinCollabModal() {
    const modal = document.getElementById('joinCollabModal');
    modal.classList.add('show');

    const input = document.getElementById('accessCodeInput');
    setTimeout(() => input.focus(), 100);

    console.log('Join Collaboration modal opened');
}

function closeJoinCollabModal() {
    const modal = document.getElementById('joinCollabModal');
    const input = document.getElementById('accessCodeInput');

    modal.classList.remove('show');
    input.value = '';

    console.log('Join Collaboration modal closed');
}

async function submitJoinCollab() {
    const input = document.getElementById('accessCodeInput');
    const accessCode = input.value.trim();

    if (!accessCode) {
        showNotification('Please enter a valid access code');
        input.focus();
        return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Please log in first');
        return;
    }

    showNotification(`Attempting to join with code: ${accessCode}`);
    closeJoinCollabModal();

    try {
        const response = await fetch('http://localhost:5000/api/documents/join', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ accessCode })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Access granted! Redirecting...');
            window.location.href = `editor.html?docId=${data.documentId}`;
        } else {
            showNotification(data.message || 'Unable to join document.');
        }
    } catch (error) {
        console.error('Error joining document:', error);
        showNotification('Server error occurred while joining.');
    }
}



function handleLogout() {
    console.log('Logging out...');
    showNotification('Logging out...');

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}



// Show notification (simple alert for now)
function showNotification(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #1f2937;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        font-size: 14px;
        font-weight: 500;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Handle window resize
window.addEventListener('resize', function() {
    const sidebar = document.getElementById('sidebar');
    
    if (window.innerWidth > 1024) {
        sidebar.classList.remove('show');
        sidebarOpen = true;
    } else {
        sidebar.classList.remove('collapsed');
        if (!sidebarOpen) {
            sidebar.classList.remove('show');
        }
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // ESC key to close modals
    if (event.key === 'Escape') {
        closeJoinModal();
        closeUserDropdown();
    }
    
    // Enter key in join modal
    if (event.key === 'Enter' && document.getElementById('joinModal').classList.contains('show')) {
        handleJoinCode();
    }
    
    // Ctrl/Cmd + K for search (future enhancement)
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }
});

// Search functionality
document.querySelector('.search-input')?.addEventListener('input', function(event) {
    const query = event.target.value;
    console.log(`Searching for: ${query}`);
    
    // Here you would implement actual search functionality
    if (query.length > 2) {
        // Simulate search results
        console.log('Search results would appear here');
    }
});

// Initialize responsive behavior
function initializeResponsive() {
    if (window.innerWidth <= 1024) {
        sidebarOpen = false;
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.remove('show');
    }
}

// Call responsive initialization
initializeResponsive();

console.log('Project-K Dashboard script loaded successfully!');







//-----------------------------------------------------------------//

 function openModal() {
            const modal = document.getElementById('modal-overlay');
            const titleInput = document.getElementById('document-title');
            const errorMessage = document.getElementById('error-message');
            
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('active');
                titleInput.focus();
            }, 10);
            
            // Clear previous error messages
            errorMessage.textContent = '';
            titleInput.classList.remove('error');
        }
 function openModal1() {
            const modal = document.getElementById('modal-overlay1');
            const titleInput = document.getElementById('document-title');
            const errorMessage = document.getElementById('error-message');
            
            modal.style.display = 'flex';
            setTimeout(() => {
                modal.classList.add('active');
                titleInput.focus();
            }, 10);
            
            // Clear previous error messages
            errorMessage.textContent = '';
            titleInput.classList.remove('error');
        }

        function closeModal() {
            const modal = document.getElementById('modal-overlay');
            const form = document.getElementById('create-form');
            
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                form.reset();
            }, 300);
        }

        function closeModal1() {
            const modal = document.getElementById('modal-overlay1');
            const form = document.getElementById('create-form');
            
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                form.reset();
            }, 300);
        }


// CREATE DOCUMENT
async function createDocument(event) {
  event.preventDefault();

  const titleInput = document.getElementById("docTitle");
  const title = titleInput.value.trim();

  if (!title) {
    document.getElementById("error-message").textContent = "Please enter a title.";
    return;
  }

  const token = localStorage.getItem("token");

  try {
    const res = await fetch("http://localhost:5000/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ title, type: "document" })
    });

    const data = await res.json();

    if (!res.ok) {
      document.getElementById("error-message").textContent = data.message || "Failed to create document";
      return;
    }

    closeModal();
    window.location.href = `editor.html?docId=${data.document._id}`;
  } catch (err) {
    console.error("Error creating document:", err);
    document.getElementById("error-message").textContent = "Server error, please try again";
  }
}





function showError(message) {
    const titleInput = document.getElementById('document-title');
    const errorMessage = document.getElementById('error-message');
    
    titleInput.classList.add('error');
    errorMessage.textContent = message;
}

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});

// Auto-focus on title input when modal opens
document.getElementById('document-title').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        createDocument(event);
    }
});



// Recent Documents View

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const container = document.getElementById("documentsContainer");

  if (!token || !container) {
    console.error("Token or container missing");
    return;
  }

  container.classList.add("work-cards");

  try {
    const res = await fetch("http://localhost:5000/api/documents", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (!data.documents || !Array.isArray(data.documents)) {
      console.error("Invalid document data");
      return;
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userEmail = user.email;

    data.documents.forEach((doc) => {
      const isOwner = doc.ownerEmail === userEmail;
      const collaboratorsCount = doc.collaborators?.length || 0;
      const timeAgoText = timeAgo(new Date(doc.updatedAt));
      const fileTypeClass = doc.type === "whiteboard" ? "whiteboard" : "document";

      const card = document.createElement("div");
      card.className = "work-card";
      card.innerHTML = `
        <div class="card-header">
          <div class="file-icon ${fileTypeClass}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
            </svg>
          </div>
        </div>
        <h3 class="card-title">${doc.title}</h3>
        <div class="card-meta">
          <span>${timeAgoText}</span>
        </div>
        <div class="card-footer">
          <div class="collaborators">
            <span>${collaboratorsCount} collaborator${collaboratorsCount !== 1 ? "s" : ""}</span>
          </div>
          ${isOwner ? `<div class="owner-badge">Owner</div>` : ""}
        </div>
      `;

      const wrapper = document.createElement("a");
      wrapper.href = `editor.html?docId=${doc._id}`;
      wrapper.className = "card-link";
      wrapper.style.textDecoration = "none";
      wrapper.style.color = "inherit";
      wrapper.appendChild(card);

      container.appendChild(wrapper);
    });
  } catch (err) {
    console.error("Error fetching user documents:", err);
  }
});


function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count >= 1) {
      return `${count} ${unit}${count > 1 ? "s" : ""} ago`;
    }
  }

  return "just now";
}
