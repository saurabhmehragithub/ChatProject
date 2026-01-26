package com.chat.controller;

import com.chat.model.ChatMessage;
import com.chat.model.ChatSession;
import com.chat.model.User;
import com.chat.config.WebSocketEventListener;
import com.chat.repository.ChatMessageRepository;
import com.chat.repository.ChatSessionRepository;
import com.chat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Controller
public class ChatController {
    
    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);
    
    @Autowired
    private WebSocketEventListener webSocketEventListener;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    
    @Autowired
    private ChatMessageRepository chatMessageRepository;
    
    @Autowired
    private ChatSessionRepository chatSessionRepository;
    
    @Autowired
    private UserRepository userRepository;
    
    private ChatSession currentSession;

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        logger.info("Received message from {}: {}", chatMessage.getSender(), chatMessage.getContent());
        if (chatMessage.getFileName() != null) {
            logger.info("Message has file attachment: {} (URL: {})", chatMessage.getFileName(), chatMessage.getFileUrl());
        }
        
        // Get or create current session
        if (currentSession == null) {
            currentSession = getOrCreateActiveSession();
        }
        
        // Associate message with current session
        chatMessage.setSession(currentSession);
        
        // Save message to database
        chatMessageRepository.save(chatMessage);
        logger.info("Message saved to database with ID: {} for session: {}", chatMessage.getId(), currentSession.getId());
        
        return chatMessage;
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    @Transactional
    public ChatMessage addUser(@Payload ChatMessage chatMessage, 
                                SimpMessageHeaderAccessor headerAccessor) {
        // Add username in web socket session
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        
        // Get or create current session
        if (currentSession == null) {
            currentSession = getOrCreateActiveSession();
        }
        
        // Add user to session participants (only if not already a participant)
        Optional<User> userOpt = userRepository.findByUsername(chatMessage.getSender());
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (!currentSession.getParticipants().contains(user)) {
                currentSession.addParticipant(user);
                chatSessionRepository.save(currentSession);
                logger.info("Added user {} to session {}", chatMessage.getSender(), currentSession.getId());
            } else {
                logger.info("User {} is already a participant of session {}", chatMessage.getSender(), currentSession.getId());
            }
        }
        
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
        
        // Associate JOIN message with current session
        chatMessage.setSession(currentSession);
        
        // Save JOIN message to database
        chatMessageRepository.save(chatMessage);
        
        logger.info("User joined: {}", chatMessage.getSender());
        return chatMessage;
    }
    
    @GetMapping("/api/messages")
    @ResponseBody
    public List<ChatMessage> getAllMessages() {
        return chatMessageRepository.findAllByOrderByTimestampAsc();
    }
    
    @GetMapping("/api/messages/lastweek")
    @ResponseBody
    public List<ChatMessage> getLastWeekMessages(@RequestParam String username) {
        LocalDateTime oneWeekAgo = LocalDateTime.now().minusWeeks(1);
        return chatMessageRepository.findMessagesSinceForUser(oneWeekAgo, username);
    }
    
    private ChatSession getOrCreateActiveSession() {
        Optional<ChatSession> activeSession = chatSessionRepository.findActiveSession();
        if (activeSession.isPresent()) {
            logger.info("Using existing active session: {}", activeSession.get().getId());
            return activeSession.get();
        } else {
            ChatSession newSession = new ChatSession();
            chatSessionRepository.save(newSession);
            logger.info("Created new session: {}", newSession.getId());
            return newSession;
        }
    }
    
    public void endCurrentSession() {
        if (currentSession != null) {
            currentSession.setEndedAt(LocalDateTime.now());
            chatSessionRepository.save(currentSession);
            logger.info("Ended session: {}", currentSession.getId());
            currentSession = null;
        }
    }
}
