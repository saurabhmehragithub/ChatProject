-- Database Setup Script for Chat Application
-- Run this script in your local PostgreSQL installation

-- Create the database (if it doesn't exist)
-- Note: You need to run this command separately as a superuser or use pgAdmin
-- CREATE DATABASE chatdb;

-- Connect to the chatdb database before running the following commands
-- \c chatdb

-- Create the chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    content TEXT,
    file_id VARCHAR(255),
    file_name VARCHAR(255),
    file_type VARCHAR(255),
    file_url VARCHAR(255),
    sender VARCHAR(255),
    timestamp TIMESTAMP(6) NOT NULL,
    type VARCHAR(255),
    CONSTRAINT chat_messages_type_check CHECK (type IN ('CHAT', 'JOIN', 'LEAVE'))
);

-- Create index on timestamp for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_timestamp ON chat_messages(timestamp DESC);

-- Create index on sender for better query performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender);

-- Create the users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Insert default users
INSERT INTO users (username, password) VALUES ('Saurabh', 'saurabh')
ON CONFLICT (username) DO NOTHING;

INSERT INTO users (username, password) VALUES ('Neha', 'neha')
ON CONFLICT (username) DO NOTHING;

-- Create index on username for better query performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Verify table creation
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('chat_messages', 'users')
ORDER BY table_name, ordinal_position;
