   // DOM Elements
const chatbotContainer = document.getElementById('chatbot-container');
const chatContainer = document.getElementById('chat-container');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const fileUpload = document.getElementById('file-upload');
const filePreview = document.getElementById('file-preview');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('sidebar');
const modal = document.getElementById("settings-modal");
const settingsBtn = document.querySelector('a[href="#"].block.py-2\\.5.px-4.rounded.transition.duration-200.hover\\:bg-gray-700:nth-child(3)');
const span = document.getElementsByClassName("close")[0];

// Global variables
let currentFileData = null;
let currentFileType = null;

// Functions
function adjustLayout() {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    chatbotContainer.style.height = `${viewportHeight}px`;
    chatbotContainer.style.width = `${viewportWidth}px`;
    
    const headerHeight = document.querySelector('.chatbot-header').offsetHeight;
    const footerHeight = document.querySelector('.chat-input-container').offsetHeight;
    chatContainer.style.height = `${viewportHeight - headerHeight - footerHeight}px`;

    const mainContent = document.querySelector('.flex-1.flex.flex-col');
    if (window.innerWidth >= 768) {
        mainContent.style.width = sidebar.classList.contains('-translate-x-full') ? '100%' : 'calc(100% - 16rem)';
    } else {
        mainContent.style.width = '100%';
    }
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            currentFileData = e.target.result.split(',')[1];
            currentFileType = file.type.startsWith('image/') ? 'image' : 'document';
            displayFilePreview(file.name, currentFileType);
        };
        reader.readAsDataURL(file);
    } else {
        clearFilePreview();
    }
}

function displayFilePreview(fileName, fileType) {
    const previewElement = document.getElementById('file-preview');
    const previewContent = previewElement.querySelector('.preview-content');
    if (fileType === 'image') {
        previewContent.innerHTML = `<img src="data:image/jpeg;base64,${currentFileData}" alt="Uploaded image" class="preview-image">`;
    } else {
        previewContent.innerHTML = `<span class="preview-document">${fileName}</span>`;
    }
    previewElement.style.display = 'flex';
}

function clearFilePreview() {
    const previewElement = document.getElementById('file-preview');
    previewElement.querySelector('.preview-content').innerHTML = '';
    previewElement.style.display = 'none';
    currentFileData = null;
    currentFileType = null;
    
    const fileInput = document.getElementById('file-upload');
    fileInput.value = '';
}

function setupClosePreview() {
    const closeButton = document.getElementById('close-preview');
    closeButton.addEventListener('click', function(e) {
        e.preventDefault();
        clearFilePreview();
    });
}

function appendMessage(sender, message, fileData = null, fileType = null) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${sender}`;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'content prose';
    
    if (sender === 'user') {
        contentElement.textContent = message;
        if (fileData) {
            if (fileType === 'image') {
                const img = document.createElement('img');
                img.src = `data:image/jpeg;base64,${fileData}`;
                img.style.maxWidth = '200px';
                img.style.maxHeight = '200px';
                contentElement.appendChild(img);
            } else {
                const docInfo = document.createElement('p');
                docInfo.textContent = 'Document attached';
                contentElement.appendChild(docInfo);
            }
        }
    } else if (sender === 'bot') {
        const generatingElement = document.createElement('div');
        generatingElement.className = 'generating';
        generatingElement.innerHTML = 'Generating<span class="dot-1">.</span><span class="dot-2">.</span><span class="dot-3">.</span>';
        contentElement.appendChild(generatingElement);
    } else if (sender === 'system') {
        contentElement.innerHTML = `<em>${message}</em>`;
        contentElement.style.color = '#888';
    } else {
        const sanitizedHtml = DOMPurify.sanitize(marked.parse(message));
        contentElement.innerHTML = sanitizedHtml;
        contentElement.querySelectorAll('pre code').forEach((block) => {
            const pre = block.parentNode;
            hljs.highlightBlock(block);
            addCopyButton(pre, block);
        });
    }
    
    messageElement.appendChild(contentElement);
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return contentElement;
}

function addCopyButton(pre, block) {
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.className = 'copy-button';
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(block.textContent).then(() => {
            copyButton.textContent = 'Copied!';
            setTimeout(() => {
                copyButton.textContent = 'Copy';
            }, 2000);
        });
    });

    const language = block.className.split('-')[1].replace('hljs', '').trim();
    const languageDisplay = document.createElement('span');
    languageDisplay.textContent = language;
    languageDisplay.className = 'language-display';

    const topBar = document.createElement('div');
    topBar.className = 'code-top-bar';
    topBar.appendChild(languageDisplay);
    topBar.appendChild(copyButton);

    pre.insertBefore(topBar, block);
}

function fetchBotResponse(message, fileData = null, fileType = null) {
    const botMessageElement = appendMessage('bot', '');
    const formData = new FormData();
    formData.append('user_input', message);
    if (fileData) {
        if (fileType === 'image') {
            formData.append('image_data', fileData);
        } else {
            formData.append('document_data', fileData);
        }
    }

    const settings = getSettings();
    Object.keys(settings).forEach(key => {
        formData.append(key, settings[key]);
    });

    fetch('/stream', {
        method: 'POST',
        body: formData
    }).then(response => {
        const reader = response.body.getReader();
        let fullMessage = '';

        function readChunk() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    console.log("Stream complete");
                    return;
                }

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n\n');
                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'message_delta') {
                            console.log("Message complete");
                        } else if (data.error) {
                            console.error("Server error:", data.error);
                            botMessageElement.innerHTML = `Error: ${data.error}`;
                        } else if (data.text) {
                            if (fullMessage === '') {
                                botMessageElement.innerHTML = '';
                            }
                            fullMessage += data.text;
                            const sanitizedHtml = DOMPurify.sanitize(marked.parse(fullMessage));
                            botMessageElement.innerHTML = sanitizedHtml;
                            botMessageElement.querySelectorAll('pre code').forEach((block) => {
                                const pre = block.parentNode;
                                hljs.highlightBlock(block);
                                addCopyButton(pre, block);
                            });
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        }
                    }
                });

                readChunk();
            }).catch(error => {
                console.error("Error reading stream:", error);
                botMessageElement.innerHTML = 'Error: Connection lost. Please try again.';
            });
        }

        readChunk();
    }).catch(error => {
        console.error("Fetch error:", error);
        botMessageElement.innerHTML = 'Error: Failed to connect to the server. Please try again.';
    });
}

function startNewChat() {
    chatContainer.innerHTML = '';
    currentFileData = null;
    currentFileType = null;
    clearFilePreview();
    userInput.value = '';
    userInput.style.height = 'auto';
    
    fetch('/new_chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            console.log('Chat history cleared on server:', data.message);
        } else {
            console.error('Error clearing chat history:', data.message);
        }
    })
    .catch(error => {
        console.error('Error clearing chat history:', error);
    });

    if (window.innerWidth < 768) {
        sidebar.classList.add('-translate-x-full');
        adjustLayout();
    }
}

function getSettings() {
    return {
        temperature: document.getElementById('temperature').value,
        top_p: document.getElementById('top-p').value,
        top_k: document.getElementById('top-k').value,
        max_tokens: document.getElementById('tokens').value,
        system_prompt: document.getElementById('system-prompt').value
    };
}

function clearChat() {
    chatContainer.innerHTML = '';
}

// Event Listeners
window.addEventListener('load', adjustLayout);
window.addEventListener('resize', adjustLayout);

chatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const message = userInput.value.trim();
    if (message || currentFileData) {
        appendMessage('user', message, currentFileData, currentFileType);
        fetchBotResponse(message, currentFileData, currentFileType);
        userInput.value = '';
        clearFilePreview();
        userInput.style.height = 'auto';
    }
});

userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

userInput.addEventListener('input', function() {
    autoResizeTextarea(this);
});

fileUpload.addEventListener('change', handleFileSelect);

chatContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
});

chatContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    fileUpload.files = e.dataTransfer.files;
    handleFileSelect({ target: fileUpload });
});

document.getElementById('new-chat').addEventListener('click', function(e) {
    e.preventDefault();
    if (confirm('Are you sure you want to start a new chat? This will clear the current conversation.')) {
        startNewChat();
    }
});

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('-translate-x-full');
    adjustLayout();
});

settingsBtn.onclick = function(e) {
    e.preventDefault();
    modal.classList.remove("hidden");
}

span.onclick = function() {
    modal.classList.add("hidden");
}

window.onclick = function(event) {
    if (event.target == modal) {
        modal.classList.add("hidden");
    }
}

document.querySelectorAll('.setting input[type="range"]').forEach(input => {
    input.oninput = function() {
        document.getElementById(`${this.id}-value`).textContent = this.value;
    }
});

document.getElementById('save-settings').onclick = function() {
    if (confirm("Saving new settings will clear the current chat. Are you sure you want to proceed?")) {
        const settings = getSettings();
        console.log('Settings saved:', settings);
        clearChat();
        modal.classList.add("hidden");
        appendMessage('system', 'New settings applied. The chat has been cleared.');

        fetch('/new_chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                console.log('Chat history cleared on server:', data.message);
            } else {
                console.error('Error clearing chat history:', data.message);
            }
        })
        .catch(error => {
            console.error('Error clearing chat history:', error);
        });
    }
}

// Initial setup
setupClosePreview();
adjustLayout();