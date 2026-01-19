package com.chat.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable a simple memory-based message broker to send messages to clients
        // on destinations prefixed with "/topic"
        config.enableSimpleBroker("/topic");
        
        // Designate the "/app" prefix for messages that are bound for methods
        // annotated with @MessageMapping
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Register the "/ws" endpoint, enabling SockJS fallback options
        // so that alternate transports may be used if WebSocket is not available
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }
    
    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        // Increase message size limit to 10MB to support file attachments
        registration.setMessageSizeLimit(10 * 1024 * 1024); // 10MB
        registration.setSendBufferSizeLimit(10 * 1024 * 1024); // 10MB  
        registration.setSendTimeLimit(20000); // 20 seconds
        registration.setTimeToFirstMessage(30000); // 30 seconds
    }
}
