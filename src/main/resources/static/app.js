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

var stompClient = null;
var username = null;
var selectedFile = null;

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

function connect(event) {
    username = document.querySelector('#name').value.trim();

    if(username) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);

        stompClient.connect({}, onConnected, onError);
    }
    event.preventDefault();
}


function onConnected() {
    // Subscribe to the Public Topic
    stompClient.subscribe('/topic/public', onMessageReceived);

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
