package com.chat.repository;

import com.chat.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    
    // Find all messages ordered by timestamp
    List<ChatMessage> findAllByOrderByTimestampAsc();
    
    // Find messages by sender
    List<ChatMessage> findBySenderOrderByTimestampAsc(String sender);
}
