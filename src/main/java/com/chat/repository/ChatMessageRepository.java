package com.chat.repository;

import com.chat.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    
    // Find all messages ordered by timestamp
    List<ChatMessage> findAllByOrderByTimestampAsc();
    
    // Find messages by sender
    List<ChatMessage> findBySenderOrderByTimestampAsc(String sender);
    
    // Find messages from last week (ordered by newest first)
    @Query("SELECT m FROM ChatMessage m WHERE m.timestamp >= :startDate ORDER BY m.timestamp DESC")
    List<ChatMessage> findMessagesSince(@Param("startDate") LocalDateTime startDate);
}
