-- =========================================================
-- ARTHA SANCHAR - PostgreSQL Database Schema
-- File: db/schema.sql
-- =========================================================

-- Clean up existing objects (optional, for reset scripts)
-- DROP TABLE IF EXISTS payment_requests CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS accounts CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TYPE IF EXISTS request_status_enum;
-- DROP TYPE IF EXISTS transaction_status_enum;

-- ---------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------
CREATE TYPE request_status_enum AS ENUM ('PENDING', 'APPROVED', 'DECLINED');
CREATE TYPE transaction_status_enum AS ENUM ('SUCCESS', 'FAILED');

-- ---------------------------------------------------------
-- 1. USERS TABLE
-- Stores user core identity and profile metadata
-- ---------------------------------------------------------
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for rapid mobile number lookup during login
CREATE INDEX idx_users_mobile ON users(mobile_number);

-- ---------------------------------------------------------
-- 2. ACCOUNTS TABLE
-- Primary ledger accounts linked via Virtual Payment Address (VPA)
-- ---------------------------------------------------------
CREATE TABLE accounts (
    vpa VARCHAR(255) PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_name VARCHAR(100) NOT NULL,
    account_no VARCHAR(20) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 10000.00 CHECK (balance >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for foreign key lookups linking users to accounts
CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- ---------------------------------------------------------
-- 3. TRANSACTIONS TABLE
-- Financial ledger capturing all direct money transfers
-- ---------------------------------------------------------
CREATE TABLE transactions (
    id VARCHAR(50) PRIMARY KEY,
    sender_vpa VARCHAR(255) NOT NULL REFERENCES accounts(vpa) ON DELETE RESTRICT,
    payee_vpa VARCHAR(255) NOT NULL REFERENCES accounts(vpa) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status transaction_status_enum NOT NULL DEFAULT 'SUCCESS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_different_accounts CHECK (sender_vpa <> payee_vpa)
);

-- Indexes for fast feed filtering on the dashboard passbook
CREATE INDEX idx_transactions_sender ON transactions(sender_vpa);
CREATE INDEX idx_transactions_payee ON transactions(payee_vpa);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- ---------------------------------------------------------
-- 4. PAYMENT REQUESTS TABLE
-- Tracks peer-to-peer collect/payment requests
-- ---------------------------------------------------------
CREATE TABLE payment_requests (
    id VARCHAR(50) PRIMARY KEY,
    requester_vpa VARCHAR(255) NOT NULL REFERENCES accounts(vpa) ON DELETE CASCADE,
    payee_vpa VARCHAR(255) NOT NULL REFERENCES accounts(vpa) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status request_status_enum NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_request_different_accounts CHECK (requester_vpa <> payee_vpa)
);

-- Composite index optimizing lookup of pending collect requests for dashboard banners
CREATE INDEX idx_payment_requests_payee_status ON payment_requests(payee_vpa, status);