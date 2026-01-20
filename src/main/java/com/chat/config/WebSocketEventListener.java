package com.chat.config;

import com.chat.model.ChatMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class WebSocketEventListener {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketEventListener.class);

    @Autowired
    private SimpMessageSendingOperations messagingTemplate;

    // Map to store sessionId -> username
    private Map<String, String> activeUsers = new ConcurrentHashMap<>();

    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        logger.info("Received a new web socket connection");
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());

        String username = (String) headerAccessor.getSessionAttributes().get("username");
        if(username != null) {
            logger.info("User Disconnected : " + username);

            // Remove user from active users
            activeUsers.remove(headerAccessor.getSessionId());

            // Send LEAVE message
            ChatMessage chatMessage = new ChatMessage();
            chatMessage.setType(ChatMessage.MessageType.LEAVE);
            chatMessage.setSender(username);
            chatMessage.setContent(username + " left!");
            
            messagingTemplate.convertAndSend("/topic/public", chatMessage);
            
            // Broadcast updated user list
            broadcastUserList();
        }
    }

    public void addUser(String sessionId, String username) {
        activeUsers.put(sessionId, username);
        broadcastUserList();
    }

    public void broadcastUserList() {
        List<String> users = new ArrayList<>(new HashSet<>(activeUsers.values()));
        Collections.sort(users);
        
        Map<String, Object> userListMessage = new HashMap<>();
        userListMessage.put("type", "USER_LIST");
        userListMessage.put("users", users);
        
        logger.info("Broadcasting user list: {}", users);
        messagingTemplate.convertAndSend("/topic/public", userListMessage);
    }

    public List<String> getActiveUsers() {
        return new ArrayList<>(new HashSet<>(activeUsers.values()));
    }
}
