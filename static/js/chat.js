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
let currentConversationId = null;
let attachedFiles = [];

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
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
        if (attachedFiles.length >= 5) {
            alert('Maximum of 5 files allowed.');
            break;
        }
        const file = files[i];
        const reader = new FileReader();
        reader.onload = function(e) {
            const fileData = e.target.result.split(',')[1];
            const fileType = file.type.startsWith('image/') ? 'image' : 'document';
            attachedFiles.push({ name: file.name, data: fileData, type: fileType });
            updateFilePreview();
        };
        reader.readAsDataURL(file);
    }
}


function displayFilePreview(fileName, fileType) {
    const previewElement = document.getElementById('file-preview');
    const previewContent = previewElement.querySelector('.preview-content');
    if (fileType === 'image') {
        previewContent.innerHTML = `<img src="data:image/jpeg;base64,${currentFileData}" alt="Uploaded image" class="preview-image">`;
    } else if (fileType === 'document') {
        const content = atob(currentFileData);
        const truncatedContent = content.length > 50 ? content.substring(0, 50) + '...' : content;
        previewContent.innerHTML = `
            <div class="flex items-center bg-gray-300 rounded-lg p-2">
                <div class="flex-shrink-0 w-15 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                    <span class="text-xs font-semibold text-gray-600">PASTED</span>
                </div>
                <div class="flex-grow">
                    <!-- <div class="text-sm font-medium text-gray-900">${fileName}</div> -->
                    <div class="text-xs text-gray-500">${truncatedContent}</div>
                </div>
                <button class="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-600" onclick="clearFilePreview()">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
    }
    previewElement.style.display = 'flex';
}

function clearFilePreview() {
    attachedFiles = [];
    updateFilePreview();
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

function appendMessage(sender, message, timestamp = null, files = []) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${sender}`;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'content prose';
    
    if (sender === 'user') {
        contentElement.textContent = message;
        if (files.length > 0) {
            const attachmentsElement = document.createElement('div');
            attachmentsElement.className = 'attachments';
            files.forEach(file => {
                const attachmentElement = document.createElement('div');
                attachmentElement.className = 'attachment';
                if (file.type === 'image') {
                    attachmentElement.innerHTML = `<img src="data:image/jpeg;base64,${file.data}" alt="Attached image" class="attachment-image">`;
                } else {
                    attachmentElement.textContent = `Attached: ${file.name}`;
                }
                attachmentsElement.appendChild(attachmentElement);
            });
            contentElement.appendChild(attachmentsElement);
        }
    } else if (sender === 'assistant' || sender === 'bot') {
        if (message === 'Generating...') {
            contentElement.innerHTML = `Generating<span class="generating-dots"><span></span><span></span><span></span></span>`;
        } else if (message) {
            const sanitizedHtml = DOMPurify.sanitize(marked.parse(message));
            contentElement.innerHTML = sanitizedHtml;
            contentElement.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightBlock(block);
                addCopyButton(block.parentNode, block);
            });
        }
    } else if (sender === 'system') {
        contentElement.innerHTML = `<em>${message}</em>`;
        contentElement.style.color = '#888';
    }
    
    messageElement.appendChild(contentElement);
    
    if (timestamp) {
        const timeElement = document.createElement('div');
        timeElement.className = 'text-xs text-gray-400 mt-1';
        timeElement.textContent = new Date(timestamp).toLocaleString();
        messageElement.appendChild(timeElement);
    }
    
    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return contentElement;
}

function appendAttachment(contentElement, fileData, fileType) {
    if (fileType === 'image') {
        const img = document.createElement('img');
        img.src = `data:image/jpeg;base64,${fileData}`;
        img.style.maxWidth = '400px';
        img.style.maxHeight = '400px';
        contentElement.appendChild(img);
    } else if (fileType === 'document') {
        const documentPreview = document.createElement('div');
        documentPreview.className = 'flex items-center bg-gray-300 rounded-lg p-2 mt-2';
        documentPreview.innerHTML = `
            <div class="flex-shrink-0 w-15 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                <span class="text-xs font-semibold text-gray-600">DOC</span>
            </div>
            <div class="flex-grow">
                <div class="text-xs text-gray-500">${atob(fileData).substring(0, 50)}${atob(fileData).length > 50 ? '...' : ''}</div>
            </div>
        `;
        contentElement.appendChild(documentPreview);
    }
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

function fetchBotResponse(message) {
    const botMessageElement = appendMessage('bot', 'Generating...');
    let tokenUsage = null;
    const formData = new FormData();
    
    formData.append('user_input', message);
    formData.append('conversation_id', currentConversationId);
    
    attachedFiles.forEach((file, index) => {
        formData.append(`file_${index}`, file.data);
        formData.append(`file_${index}_name`, file.name);
        formData.append(`file_${index}_type`, file.type);
    });

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
                    if (tokenUsage) {
                        displayTokenUsage(botMessageElement, tokenUsage);
                    }
                    return;
                }

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n\n');
                lines.forEach(line => {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        if (data.type === 'message_start') {
                            botMessageElement.innerHTML = ''; // Clear the 'Generating...' message
                        } else if (data.error) {
                            console.error("Server error:", data.error);
                            botMessageElement.innerHTML = `Error: ${data.error}`;
                        } else if (data.text) {
                            fullMessage += data.text;
                            const sanitizedHtml = DOMPurify.sanitize(marked.parse(fullMessage));
                            botMessageElement.innerHTML = sanitizedHtml;
                            botMessageElement.querySelectorAll('pre code').forEach((block) => {
                                hljs.highlightBlock(block);
                                addCopyButton(block.parentNode, block);
                            });
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                        } else if (data.type === 'token_usage') {
                            tokenUsage = data.usage;
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

function displayTokenUsage(messageElement, usage) {
    const usageElement = document.createElement('div');
    usageElement.className = 'token-usage text-xs text-gray-500 mt-2 p-2 border-t border-gray-200';
    
    const formattedUsage = `
        <div class="font-semibold mb-1">Token Usage:</div>
        <div class="grid grid-cols-2 gap-1">
            <span>Input Tokens:</span> <span class="text-right">${usage.inputTokens}</span>
            <span>Output Tokens:</span> <span class="text-right">${usage.outputTokens}</span>
            <span class="font-semibold">Total Tokens:</span> <span class="text-right font-semibold">${usage.totalTokens}</span>
        </div>
    `;
    
    usageElement.innerHTML = formattedUsage;
    messageElement.appendChild(usageElement);
}

function displayTokenUsage(messageElement, usage) {
    const usageElement = document.createElement('div');
    usageElement.className = 'token-usage text-xs text-gray-500 mt-2';
    usageElement.textContent = `Token usage: ${JSON.stringify(usage)}`;
    messageElement.appendChild(usageElement);
}

function startNewChat() {
    currentConversationId = generateUUID();
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
        body: JSON.stringify({conversation_id: currentConversationId})
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            console.log('New chat started:', data.message);
            loadConversationHistory(); // Reload the conversation list
        } else {
            console.error('Error starting new chat:', data.message);
        }
    })
    .catch(error => {
        console.error('Error starting new chat:', error);
    });

    if (window.innerWidth < 768) {
        sidebar.classList.add('-translate-x-full');
        adjustLayout();
    }
}

// Add this function to load chat history
function loadChatHistory(conversationId) {
    fetch(`/get_history?conversation_id=${conversationId}`)
        .then(response => response.json())
        .then(history => {
            chatContainer.innerHTML = '';
            history.forEach(([timestamp, sender, message]) => {
                appendMessage(sender, message);
            });
        })
        .catch(error => console.error('Error loading chat history:', error));
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
fileUpload.addEventListener('change', handleFileSelect);

chatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const message = userInput.value.trim();
    if (message || attachedFiles.length > 0) {
        appendMessage('user', message, null, attachedFiles);
        fetchBotResponse(message);
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

let documentCounter = 0;

function handleLargeContent(content) {
    if (content.length >= 1000) {
        documentCounter++;
        const timestamp = Date.now();
        const fileName = `large_content_${timestamp}_${documentCounter}.txt`;
        currentFileData = btoa(content);
        currentFileType = 'document';
        displayFilePreview(fileName, 'document');
        return fileName;
    }
    return false;
}

function handlePaste(e) {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.length >= 1000) {
        if (attachedFiles.length >= 5) {
            alert('Maximum of 5 files allowed.');
            return;
        }
        e.preventDefault();
        const fileName = `pasted_text_${Date.now()}.txt`;
        attachedFiles.push({
            name: fileName,
            data: btoa(pastedText),
            type: 'document'
        });
        updateFilePreview();
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}


function updateFilePreview() {
    const previewElement = document.getElementById('file-preview');
    const previewContent = previewElement.querySelector('.preview-content');
    previewContent.innerHTML = '';

    attachedFiles.forEach((file, index) => {
        const filePreview = document.createElement('div');
        filePreview.className = 'file-preview-item';
        if (file.type === 'image') {
            filePreview.innerHTML = `
                <img src="data:image/jpeg;base64,${file.data}" alt="Uploaded image" class="preview-image">
                <span>${file.name}</span>
                <button class="remove-file" data-index="${index}">&times;</button>
            `;
        } else {
            filePreview.innerHTML = `
                <div class="preview-document">${file.name}</div>
                <button class="remove-file" data-index="${index}">&times;</button>
            `;
        }
        previewContent.appendChild(filePreview);
    });

    previewElement.style.display = attachedFiles.length > 0 ? 'flex' : 'none';

    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-file').forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            attachedFiles.splice(index, 1);
            updateFilePreview();
        });
    });
}



let currentPage = 1;
let totalPages = 1;

function loadConversationHistory(page = 1) {
    console.log("Loading conversation history...");
    fetch(`/get_all_conversations?page=${page}`)
        .then(response => response.json())
        .then(data => {
            console.log("Received conversations:", data);
            const conversationList = document.getElementById('conversation-list');
            conversationList.innerHTML = '';
            
            data.conversations.forEach(([conversationId, lastUpdate]) => {
                const li = document.createElement('li');
                li.className = 'cursor-pointer hover:bg-gray-700 p-2 rounded flex justify-between items-center relative';
                
                const date = new Date(lastUpdate);
                const formattedDate = date.toLocaleDateString(undefined, { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
                const formattedTime = date.toLocaleTimeString(undefined, { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                li.innerHTML = `
                <div class="flex flex-col">
                    <span class="text-sm">Conversation ${conversationId.substr(0, 8)}...</span>
                    <span class="text-xs text-gray-400">${formattedDate} ${formattedTime}</span>
                </div>
                <button class="delete-conversation text-red-500 hover:text-red-700 absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 transition-opacity duration-200">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            `;
            li.dataset.conversationId = conversationId;
                
            // Add event listeners here
            li.addEventListener('mouseenter', () => {
                li.querySelector('.delete-conversation').style.opacity = '1';
            });

            li.addEventListener('mouseleave', () => {
                li.querySelector('.delete-conversation').style.opacity = '0';
            });

            li.querySelector('.delete-conversation').onclick = (e) => {
                e.stopPropagation();
                deleteConversation(conversationId);
            };

            li.onclick = (e) => {
                if (!e.target.closest('.delete-conversation')) {
                    loadConversation(conversationId);
                }
            };
            
            if (conversationId === currentConversationId) {
                li.classList.add('bg-gray-700');
            }
            
            conversationList.appendChild(li);
        });
            
            currentPage = data.current_page;
            totalPages = data.total_pages;
            updatePaginationControls();
            
            console.log("Conversation history loaded and displayed");
        })
        .catch(error => console.error('Error loading conversation history:', error));
}

function deleteConversation(conversationId) {
    if (confirm('Are you sure you want to delete this conversation?')) {
        fetch(`/delete_conversation?conversation_id=${conversationId}`, { method: 'DELETE' })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    loadConversationHistory(currentPage);
                    if (currentConversationId === conversationId) {
                        chatContainer.innerHTML = '';
                        currentConversationId = null;
                    }
                } else {
                    console.error('Error deleting conversation:', data.message);
                }
            })
            .catch(error => console.error('Error deleting conversation:', error));
    }
}

function updatePaginationControls() {
    const paginationControls = document.getElementById('pagination-controls');
    paginationControls.innerHTML = `
        <button id="prev-page" class="px-2 py-1 bg-gray-700 rounded" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
        <span class="px-2">${currentPage} / ${totalPages}</span>
        <button id="next-page" class="px-2 py-1 bg-gray-700 rounded" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;
    
    document.getElementById('prev-page').onclick = () => {
        if (currentPage > 1) loadConversationHistory(currentPage - 1);
    };
    
    document.getElementById('next-page').onclick = () => {
        if (currentPage < totalPages) loadConversationHistory(currentPage + 1);
    };
}


function loadConversation(conversationId) {
    currentConversationId = conversationId;
    fetch(`/get_history?conversation_id=${conversationId}`)
        .then(response => response.json())
        .then(history => {
            chatContainer.innerHTML = '';
            history.forEach(({timestamp, sender, message, fileData, fileType}) => {
                appendMessage(sender, message, timestamp, fileData, fileType);
            });
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            // Highlight the active conversation in the sidebar
            document.querySelectorAll('#conversation-list li').forEach(li => {
                li.classList.remove('bg-gray-700');
                if (li.dataset.conversationId === conversationId) {
                    li.classList.add('bg-gray-700');
                }
            });
        })
        .catch(error => console.error('Error loading conversation:', error));
}

window.addEventListener('load', () => {
    console.log("Window loaded");
    adjustLayout();
    currentConversationId = generateUUID();
    loadConversationHistory();
});

// Initial setup
setupClosePreview();
adjustLayout();