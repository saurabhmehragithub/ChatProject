'use strict';

var usernamePage = document.querySelector('#username-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');
var fileInput = document.querySelector('#fileInput');
var attachButton = document.querySelector('#attachButton');
var filePreview = document.querySelector('#filePreview');
var fileNameDisplay = document.querySelector('#fileName');
var removeFileButton = document.querySelector('#removeFile');
var userList = document.querySelector('#userList');
var userCount = document.querySelector('#userCount');
var loginError = document.querySelector('#login-error');

var stompClient = null;
var username = null;
var selectedFile = null;

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

function connect(event) {
    event.preventDefault();
    
    username = document.querySelector('#name').value.trim();
    var password = document.querySelector('#password').value;

    if(username && password) {
        // Hide any previous error
        loginError.classList.add('hidden');
        
        // Authenticate user
        fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Authentication successful, connect to WebSocket
                usernamePage.classList.add('hidden');
                chatPage.classList.remove('hidden');

                var socket = new SockJS('/ws');
                stompClient = Stomp.over(socket);

                stompClient.connect({}, onConnected, onError);
            } else {
                // Authentication failed
                showLoginError(data.message || 'Invalid username or password');
            }
        })
        .catch(error => {
            console.error('Login error:', error);
            showLoginError('Login failed. Please try again.');
        });
    }
}

function showLoginError(message) {
    loginError.textContent = message;
    loginError.classList.remove('hidden');
    
    // Auto-hide error after 5 seconds
    setTimeout(function() {
        loginError.classList.add('hidden');
    }, 5000);
}


function onConnected() {
    // Subscribe to the Public Topic
    stompClient.subscribe('/topic/public', onMessageReceived);
    
    // Subscribe to user-specific queue for existing user notifications
    stompClient.subscribe('/user/queue/messages', onMessageReceived);

    // Tell your username to the server
    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    )

    connectingElement.classList.add('hidden');
}


function onError(error) {
    connectingElement.textContent = 'Could not connect to WebSocket server. Please refresh this page to try again!';
    connectingElement.style.color = 'red';
}


function sendMessage(event) {
    event.preventDefault();
    
    var messageContent = messageInput.value.trim();
    
    // If there's a file selected, upload it first via HTTP
    if(selectedFile && stompClient) {
        uploadFileAndSendMessage(messageContent);
    } else if(messageContent && stompClient) {
        // Send text message only
        var chatMessage = {
            sender: username,
            content: messageContent,
            type: 'CHAT'
        };
        
        console.log('Sending text message:', chatMessage);
        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
        messageInput.value = '';
    }
}

// Upload file via HTTP, then send message with file reference via WebSocket
function uploadFileAndSendMessage(messageContent) {
    var formData = new FormData();
    
    // Convert base64 back to blob for HTTP upload
    var byteString = atob(selectedFile.content);
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    var blob = new Blob([ab], { type: selectedFile.type });
    formData.append('file', blob, selectedFile.name);
    
    console.log('Uploading file via HTTP:', selectedFile.name);
    
    // Upload file to server
    fetch('/api/files/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if(data.error) {
            alert('Error uploading file: ' + data.error);
            return;
        }
        
        console.log('File uploaded successfully:', data);
        
        // Send message with file reference via WebSocket
        var chatMessage = {
            sender: username,
            content: messageContent || 'Sent a file',
            type: 'CHAT',
            fileName: data.fileName,
            fileType: data.fileType,
            fileUrl: data.fileUrl,
            fileId: data.fileId
        };
        
        console.log('Sending message with file reference:', chatMessage);
        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
        messageInput.value = '';
        clearFileSelection();
    })
    .catch(error => {
        console.error('Error uploading file:', error);
        alert('Failed to upload file. Please try again.');
    });
}


function onMessageReceived(payload) {
    var message = JSON.parse(payload.body);
    console.log('Message received:', message);

    // Handle user list updates
    if(message.type === 'USER_LIST') {
        updateUserList(message.users);
        return;
    }

    var messageElement = document.createElement('li');

    if(message.type === 'JOIN') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' joined!';
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' left!';
    } else {
        messageElement.classList.add('chat-message');

        var avatarElement = document.createElement('i');
        var avatarText = document.createTextNode(message.sender[0]);
        avatarElement.appendChild(avatarText);
        avatarElement.style['background-color'] = getAvatarColor(message.sender);

        messageElement.appendChild(avatarElement);

        var usernameElement = document.createElement('span');
        var usernameText = document.createTextNode(message.sender);
        usernameElement.appendChild(usernameText);
        messageElement.appendChild(usernameElement);
    }

    var textElement = document.createElement('p');
    var messageText = document.createTextNode(message.content);
    textElement.appendChild(messageText);
    messageElement.appendChild(textElement);

    // Display file attachment if present
    if(message.fileName && message.fileUrl) {
        var attachmentElement = document.createElement('div');
        attachmentElement.classList.add('attachment');
        
        if(message.fileType && message.fileType.startsWith('image/')) {
            // Display image inline
            var img = document.createElement('img');
            img.src = message.fileUrl;
            img.classList.add('attachment-image');
            img.alt = message.fileName;
            img.onerror = function() {
                console.error('Failed to load image:', message.fileUrl);
                this.style.display = 'none';
                var errorText = document.createElement('span');
                errorText.textContent = '⚠️ Failed to load image';
                errorText.style.color = 'red';
                attachmentElement.appendChild(errorText);
            };
            attachmentElement.appendChild(img);
        } else {
            // Display PDF or other files as download link
            var fileIcon = document.createElement('span');
            fileIcon.classList.add('file-icon');
            fileIcon.textContent = '📄';
            attachmentElement.appendChild(fileIcon);
            
            var downloadLink = document.createElement('a');
            downloadLink.href = message.fileUrl;
            downloadLink.download = message.fileName;
            downloadLink.textContent = message.fileName;
            downloadLink.classList.add('file-link');
            downloadLink.target = '_blank';
            attachmentElement.appendChild(downloadLink);
        }
        
        messageElement.appendChild(attachmentElement);
    }

    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;
}


function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }
    var index = Math.abs(hash % colors.length);
    return colors[index];
}

// File handling functions
function handleFileSelect(event) {
    var file = event.target.files[0];
    if(file) {
        // Check file size (limit to 10MB for HTTP upload)
        if(file.size > 10 * 1024 * 1024) {
            alert('File size must be less than 10MB');
            fileInput.value = '';
            return;
        }
        
        // Check file type
        var allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        var fileExtension = file.name.split('.').pop().toLowerCase();
        var validExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
        
        if(!allowedTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
            alert('Only PDF, JPG, and JPEG files are allowed. File type detected: ' + file.type);
            console.log('File rejected - Type: ' + file.type + ', Name: ' + file.name);
            return;
        }
        
        console.log('File selected - Type: ' + file.type + ', Name: ' + file.name + ', Size: ' + file.size);
        
        var reader = new FileReader();
        reader.onload = function(e) {
            selectedFile = {
                name: file.name,
                type: file.type,
                content: e.target.result.split(',')[1] // Get base64 content without prefix
            };
            
            // Show file preview
            fileNameDisplay.textContent = file.name;
            filePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function clearFileSelection() {
    selectedFile = null;
    fileInput.value = '';
    filePreview.classList.add('hidden');
    fileNameDisplay.textContent = '';
}

attachButton.addEventListener('click', function() {
    fileInput.click();
});

fileInput.addEventListener('change', handleFileSelect);

removeFileButton.addEventListener('click', clearFileSelection);

usernameForm.addEventListener('submit', connect, true)
messageForm.addEventListener('submit', sendMessage, true)

// Logout button functionality
var logoutButton = document.querySelector('#logoutButton');
if (logoutButton) {
    logoutButton.addEventListener('click', function() {
        // Disconnect from WebSocket
        if (stompClient !== null) {
            stompClient.disconnect();
        }
        
        // Clear username
        username = null;
        
        // Hide chat page and show login page
        chatPage.classList.add('hidden');
        usernamePage.classList.remove('hidden');
        
        // Clear form fields
        document.querySelector('#name').value = '';
        document.querySelector('#password').value = '';
        messageInput.value = '';
        messageArea.innerHTML = '';
        userList.innerHTML = '';
        userCount.textContent = '0';
        
        // Hide any error messages
        if (loginError) {
            loginError.classList.add('hidden');
        }
        
        console.log('User logged out successfully');
    });
}

// Last Week Modal functionality
var lastWeekLink = document.querySelector('#viewLastWeekLink');
var lastWeekModal = document.querySelector('#lastWeekModal');
var closeModal = document.querySelector('.close-modal');
var lastWeekMessages = document.querySelector('#lastWeekMessages');

// Open modal when link is clicked
if (lastWeekLink) {
    lastWeekLink.addEventListener('click', function(event) {
        event.preventDefault();
        openLastWeekModal();
    });
}

// Close modal when X is clicked
if (closeModal) {
    closeModal.addEventListener('click', function() {
        lastWeekModal.classList.add('hidden');
    });
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    if (event.target === lastWeekModal) {
        lastWeekModal.classList.add('hidden');
    }
});

function openLastWeekModal() {
    lastWeekModal.classList.remove('hidden');
    lastWeekMessages.innerHTML = '<div class=\"loading\">Loading messages...</div>';
    
    // Fetch last week's messages
    fetch('/api/messages/lastweek')
        .then(response => response.json())
        .then(messages => {
            displayLastWeekMessages(messages);
        })
        .catch(error => {
            console.error('Error fetching last week messages:', error);
            lastWeekMessages.innerHTML = '<div class=\"error\">Failed to load messages. Please try again.</div>';
        });
}

function displayLastWeekMessages(messages) {
    lastWeekMessages.innerHTML = '';
    
    if (messages.length === 0) {
        lastWeekMessages.innerHTML = '<div class=\"no-messages\">No messages from the last week.</div>';
        return;
    }
    
    var messageList = document.createElement('ul');
    messageList.classList.add('modal-message-list');
    
    messages.forEach(function(message) {
        if (message.type === 'CHAT') {
            var messageElement = document.createElement('li');
            messageElement.classList.add('modal-message-item');
            
            var messageHeader = document.createElement('div');
            messageHeader.classList.add('modal-message-header');
            
            var senderElement = document.createElement('strong');
            senderElement.textContent = message.sender;
            senderElement.style.color = getAvatarColor(message.sender);
            
            var timeElement = document.createElement('span');
            timeElement.classList.add('modal-message-time');
            timeElement.textContent = formatTimestamp(message.timestamp);
            
            messageHeader.appendChild(senderElement);
            messageHeader.appendChild(timeElement);
            
            var contentElement = document.createElement('div');
            contentElement.classList.add('modal-message-content');
            contentElement.textContent = message.content || '';
            
            messageElement.appendChild(messageHeader);
            messageElement.appendChild(contentElement);
            
            // Add file info if present
            if (message.fileName) {
                var fileElement = document.createElement('div');
                fileElement.classList.add('modal-message-file');
                
                var fileIcon = document.createElement('span');
                fileIcon.textContent = '📎 ';
                
                if (message.fileUrl) {
                    var fileLink = document.createElement('a');
                    fileLink.href = message.fileUrl;
                    fileLink.textContent = message.fileName;
                    fileLink.target = '_blank';
                    fileElement.appendChild(fileIcon);
                    fileElement.appendChild(fileLink);
                } else {
                    fileElement.textContent = '📎 ' + message.fileName;
                }
                
                messageElement.appendChild(fileElement);
            }
            
            messageList.appendChild(messageElement);
        }
    });
    
    lastWeekMessages.appendChild(messageList);
}

function formatTimestamp(timestamp) {
    var date = new Date(timestamp);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    var timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    if (messageDate.getTime() === today.getTime()) {
        return 'Today at ' + timeStr;
    } else if (messageDate.getTime() === today.getTime() - 86400000) {
        return 'Yesterday at ' + timeStr;
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' at ' + timeStr;
    }
}

// Function to update the active users list
function updateUserList(users) {
    userList.innerHTML = '';
    userCount.textContent = users.length;
    
    users.forEach(function(user) {
        var userElement = document.createElement('li');
        userElement.classList.add('user-item');
        
        var avatar = document.createElement('span');
        avatar.classList.add('user-avatar');
        avatar.textContent = user[0].toUpperCase();
        avatar.style.backgroundColor = getAvatarColor(user);
        
        var userName = document.createElement('span');
        userName.classList.add('user-name');
        userName.textContent = user;
        
        // Highlight current user
        if(user === username) {
            userElement.classList.add('current-user');
            userName.textContent = user + ' (You)';
        }
        
        userElement.appendChild(avatar);
        userElement.appendChild(userName);
        userList.appendChild(userElement);
    });
}
