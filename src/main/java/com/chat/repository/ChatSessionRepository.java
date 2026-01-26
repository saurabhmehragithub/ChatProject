package com.chat.repository;

import com.chat.model.ChatSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {
    
    @Query("SELECT cs FROM ChatSession cs WHERE cs.endedAt IS NULL ORDER BY cs.createdAt DESC")
    Optional<ChatSession> findActiveSession();
}
