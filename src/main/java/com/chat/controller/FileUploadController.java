package com.chat.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/files")
public class FileUploadController {
    
    private static final Logger logger = LoggerFactory.getLogger(FileUploadController.class);
    
    // In-memory storage for uploaded files (for demo purposes)
    // In production, use database or cloud storage
    private final Map<String, FileData> fileStore = new ConcurrentHashMap<>();
    
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
            }
            
            // Generate unique file ID
            String fileId = UUID.randomUUID().toString();
            
            // Store file data
            FileData fileData = new FileData(
                file.getOriginalFilename(),
                file.getContentType(),
                file.getBytes()
            );
            fileStore.put(fileId, fileData);
            
            logger.info("File uploaded successfully: {} (ID: {})", file.getOriginalFilename(), fileId);
            
            // Return file ID and URL
            Map<String, String> response = new HashMap<>();
            response.put("fileId", fileId);
            response.put("fileName", file.getOriginalFilename());
            response.put("fileType", file.getContentType());
            response.put("fileUrl", "/api/files/" + fileId);
            
            return ResponseEntity.ok(response);
            
        } catch (IOException e) {
            logger.error("Error uploading file", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to upload file: " + e.getMessage()));
        }
    }
    
    @GetMapping("/{fileId}")
    public ResponseEntity<byte[]> getFile(@PathVariable String fileId) {
        FileData fileData = fileStore.get(fileId);
        
        if (fileData == null) {
            return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(fileData.contentType))
                .header("Content-Disposition", "inline; filename=\"" + fileData.fileName + "\"")
                .body(fileData.data);
    }
    
    // Inner class to store file data
    private static class FileData {
        private final String fileName;
        private final String contentType;
        private final byte[] data;
        
        public FileData(String fileName, String contentType, byte[] data) {
            this.fileName = fileName;
            this.contentType = contentType;
            this.data = data;
        }
    }
}
