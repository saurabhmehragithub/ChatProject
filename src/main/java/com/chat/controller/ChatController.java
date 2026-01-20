package com.chat.controller;

import com.chat.model.ChatMessage;
import com.chat.config.WebSocketEventListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@Controller
public class ChatController {
    
    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);
    
    @Autowired
    private WebSocketEventListener webSocketEventListener;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        logger.info("Received message from {}: {}", chatMessage.getSender(), chatMessage.getContent());
        if (chatMessage.getFileName() != null) {
            logger.info("Message has file attachment: {} (URL: {})", chatMessage.getFileName(), chatMessage.getFileUrl());
        }
        return chatMessage;
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage, 
                                SimpMessageHeaderAccessor headerAccessor) {
        // Add username in web socket session
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        
        // Get list of existing users before adding the new user
        List<String> existingUsers = webSocketEventListener.getActiveUsers();
        
        // Send join messages for existing users to the new user
        if (!existingUsers.isEmpty()) {
            for (String existingUser : existingUsers) {
                ChatMessage existingUserMsg = new ChatMessage();
                existingUserMsg.setType(ChatMessage.MessageType.JOIN);
                existingUserMsg.setSender(existingUser);
                existingUserMsg.setContent(existingUser + " joined!");
                
                // Send to the specific new user's session
                messagingTemplate.convertAndSendToUser(
                    headerAccessor.getSessionId(),
                    "/queue/messages",
                    existingUserMsg
                );
            }
            logger.info("Sent {} existing user(s) info to new user: {}", existingUsers.size(), chatMessage.getSender());
        }
        
        // Add user to active users list
        webSocketEventListener.addUser(headerAccessor.getSessionId(), chatMessage.getSender());
        
        logger.info("User joined: {}", chatMessage.getSender());
        return chatMessage;
    }
}
