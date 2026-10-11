-- Database Creation
CREATE DATABASE IF NOT EXISTS fastpay_upi;
USE fastpay_upi;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
    account_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    bank_name VARCHAR(50) NOT NULL,
    vpa_handle VARCHAR(50) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    balance DECIMAL(12, 2) DEFAULT 0.00,
    account_number VARCHAR(20) NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id VARCHAR(36) PRIMARY KEY, -- Uses UUID
    sender_vpa VARCHAR(50) NOT NULL,
    receiver_vpa VARCHAR(50) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    status ENUM('SUCCESS', 'FAILED', 'PENDING') DEFAULT 'SUCCESS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_vpa) REFERENCES accounts(vpa_handle)
);

-- Indexing for fast lookups during transfer checks
CREATE INDEX idx_mobile ON users(mobile_number);
CREATE INDEX idx_vpa ON accounts(vpa_handle);