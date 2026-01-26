package com.chat.config;

import com.chat.model.User;
import com.chat.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Override
    public void run(String... args) throws Exception {
        // Check if users already exist
        if (userRepository.findByUsername("Saurabh").isEmpty()) {
            User user1 = new User("Saurabh", "saurabh");
            userRepository.save(user1);
            System.out.println("Created user: Saurabh");
        }

        if (userRepository.findByUsername("Neha").isEmpty()) {
            User user2 = new User("Neha", "neha");
            userRepository.save(user2);
            System.out.println("Created user: Neha");
        }

        if (userRepository.findByUsername("Rajiv").isEmpty()) {
            User user3 = new User("Rajiv", "rajiv");
            userRepository.save(user3);
            System.out.println("Created user: Rajiv");
        }

        if (userRepository.findByUsername("Pralhad").isEmpty()) {
            User user4 = new User("Pralhad", "pralhad");
            userRepository.save(user4);
            System.out.println("Created user: Pralhad");
        }
        
        System.out.println("Data initialization complete. Available users: Saurabh, Neha, Rajiv, Pralhad");
    }
}
