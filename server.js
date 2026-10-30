const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./config/db');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname,'public')));
app.get('/favicon.ico', (req, res) => res.status(204).end());


app.post('/api/register', async (req, res) => {
    try {
        const { fullName, mobileNumber, bankName, vpaHandle, upiPin } = req.body;

        if (!fullName || !mobileNumber || !vpaHandle || !upiPin) {
            return res.status(400).json({ success: false, error: "All fields are required." });
        }

        const rawHandle = vpaHandle.trim().toLowerCase();
        const cleanHandle = rawHandle.includes("@") ? rawHandle.split("@")[0] : rawHandle;
        const vpa = `${cleanHandle}@arthasanchar`;
        const cleanMobile = mobileNumber.trim();

        const accountCheck = await db.query('SELECT vpa FROM accounts WHERE vpa = $1', [vpa]);
        if (accountCheck.rows.length > 0) {
            return res.status(400).json({ success: false, error: "VPA already registered." });
        }

        const userCheck = await db.query('SELECT id FROM users WHERE mobile_number = $1', [cleanMobile]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: "MOBILE NUMBER IS ALREADY REGISTERED" });
        }

        const pinHash = await bcrypt.hash(upiPin.toString().trim(), 10);
        const randomAccountNo = Math.floor(1000 + Math.random() * 9000).toString();

        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');

            const userInsertResult = await client.query(
                `INSERT INTO users (full_name, mobile_number) VALUES ($1, $2) RETURNING id`,
                [fullName.trim(), cleanMobile]
            );
            const newUserId = userInsertResult.rows[0].id;

            await client.query(
                `INSERT INTO accounts (vpa, user_id, bank_name, account_no, pin_hash, balance)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [vpa, newUserId, bankName, randomAccountNo, pinHash, 10000.00]
            );

            await client.query('COMMIT');

            res.status(201).json({
                success: true,
                message: "Registration successful!",
                vpa: vpa,
                user: {
                    fullName: fullName.trim(),
                    vpa: vpa,
                    bankName: bankName,
                    balance: 10000.00
                }
            });
        } catch (txnError) {
            await client.query('ROLLBACK');
            throw txnError;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error("Registration error: ", err);
        res.status(500).json({ success: false, error: "Server error! Registration Failed." });
    }
});


app.post('/api/login', async (req, res) => {
    try {
        let { loginId, upiPin } = req.body;
        if (!loginId || !upiPin) {
            return res.status(400).json({ success: false, message: "Please enter Login ID and PIN" });
        }

        loginId = loginId.trim();
        let targetVpa = loginId;
        if (!loginId.includes('@') && isNaN(loginId)) {
            targetVpa = `${loginId}@arthasanchar`;
        }

        const queryText = `
            SELECT a.vpa, a.pin_hash, a.bank_name, a.balance, u.full_name
            FROM accounts a
            JOIN users u ON a.user_id = u.id
            WHERE a.vpa = $1 OR u.mobile_number = $1
            LIMIT 1
        `;
        const result = await db.query(queryText, [targetVpa]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Account not found." });
        }

        const account = result.rows[0];

        const isValidPin = await bcrypt.compare(upiPin.toString().trim(), account.pin_hash);
        if (!isValidPin) {
            return res.status(401).json({ success: false, error: "Invalid UPI PIN." });
        }

        res.json({
            message: "Login successful",
            success: true,
            user: {
                fullName: account.full_name,
                vpa: account.vpa,
                bankName: account.bank_name,
                balance: parseFloat(account.balance)
            }
        });
    } catch (err) {
        console.error("Login error: ", err);
        return res.status(500).json({ success: false, message: "Server Error during login" });
    }
});

app.get('/api/dashboard', async (req, res) => {
    try {
        const { vpa } = req.query;
        if (!vpa) {
            return res.status(400).json({ success: false, message: "VPA is required" });
        }

        // Fetch User and Account Info
        const accResult = await db.query(
            `SELECT a.vpa, a.bank_name, a.account_no, a.balance, u.full_name
             FROM accounts a
             JOIN users u ON a.user_id = u.id
             WHERE a.vpa = $1`,
            [vpa]
        );

        if (accResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Account Not Found" });
        }

        const account = accResult.rows[0];

        // Fetch Transactions history
        const txnResult = await db.query(
            `SELECT id, sender_vpa AS "senderVpa", payee_vpa AS "payeeVpa", 
                    amount, created_at AS "timestamp"
             FROM transactions
             WHERE sender_vpa = $1 OR payee_vpa = $1
             ORDER BY created_at DESC`,
            [vpa]
        );

        // Fetch Pending Collect Requests
        const reqResult = await db.query(
            `SELECT id, requester_vpa AS "requesterVpa", payee_vpa AS "payeeVpa", 
                    amount, status, created_at AS "date"
             FROM payment_requests
             WHERE payee_vpa = $1 AND status = 'PENDING'
             ORDER BY created_at DESC`,
            [vpa]
        );

        res.json({
            success: true,
            user: {
                fullName: account.full_name,
                vpa: account.vpa,
                bankName: account.bank_name,
                accountNo: account.account_no,
                balance: parseFloat(account.balance)
            },
            transactions: txnResult.rows,
            pendingRequests: reqResult.rows
        });
    } catch (err) {
        console.error("Dashboard error: ", err);
        res.status(500).json({ success: false, message: "Dashboard loading failed" });
    }
});

// ==========================================
// 4. DIRECT TRANSFER ENDPOINT (ATOMIC TRANSACTION)
// ==========================================
app.post('/api/transfer', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { senderVpa, payeeVpa, amount, upiPin } = req.body;
        const transferAmount = parseFloat(amount);

        if (!senderVpa || !payeeVpa || !amount || transferAmount <= 0 || !upiPin) {
            return res.status(400).json({ success: false, message: "Please fill required details." });
        }
        if (senderVpa.toLowerCase() === payeeVpa.toLowerCase()) {
            return res.status(400).json({ success: false, message: "Cannot send money to yourself." });
        }

        await client.query('BEGIN');

        // Lock Sender Account Row for Update (Prevents Race Conditions/Double Spending)
        const senderRes = await client.query(
            `SELECT vpa, balance, pin_hash, bank_name, account_no, user_id FROM accounts WHERE vpa = $1 FOR UPDATE`,
            [senderVpa]
        );

        if (senderRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Sender account not found." });
        }
        const senderAccount = senderRes.rows[0];

        // Lock Payee Account Row
        const payeeRes = await client.query(
            `SELECT vpa, balance FROM accounts WHERE vpa = $1 FOR UPDATE`,
            [payeeVpa]
        );

        if (payeeRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: "Receiver account not found in database." });
        }

        // Verify PIN
        const isValidPin = await bcrypt.compare(upiPin.toString().trim(), senderAccount.pin_hash);
        if (!isValidPin) {
            await client.query('ROLLBACK');
            return res.status(401).json({ success: false, message: "Incorrect UPI PIN." });
        }

        // Check Balance
        if (parseFloat(senderAccount.balance) < transferAmount) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: "Insufficient Funds in sender account." });
        }

        // Update Balances
        await client.query(
            `UPDATE accounts SET balance = balance - $1 WHERE vpa = $2`,
            [transferAmount, senderVpa]
        );
        await client.query(
            `UPDATE accounts SET balance = balance + $1 WHERE vpa = $2`,
            [transferAmount, payeeVpa]
        );

        // Record Transaction
        const txnId = `TXN${Date.now()}`;
        await client.query(
            `INSERT INTO transactions (id, sender_vpa, payee_vpa, amount, status)
             VALUES ($1, $2, $3, $4, 'SUCCESS')`,
            [txnId, senderVpa, payeeVpa, transferAmount]
        );

        await client.query('COMMIT');

        // Fetch User Full Name for Response payload
        const userRes = await db.query(
            `SELECT u.full_name FROM users u JOIN accounts a ON u.id = a.user_id WHERE a.vpa = $1`,
            [senderVpa]
        );

        // Fetch Updated History
        const updatedTxns = await db.query(
            `SELECT id, sender_vpa AS "senderVpa", payee_vpa AS "payeeVpa", amount, created_at AS "timestamp"
             FROM transactions WHERE sender_vpa = $1 OR payee_vpa = $1 ORDER BY created_at DESC`,
            [senderVpa]
        );

        res.json({
            success: true,
            message: `Transferred ₹${transferAmount.toFixed(2)} to ${payeeVpa}`,
            user: {
                fullName: userRes.rows[0]?.full_name || "USER",
                vpa: senderVpa,
                bankName: senderAccount.bank_name,
                accountNo: senderAccount.account_no,
                balance: parseFloat(senderAccount.balance) - transferAmount
            },
            transactions: updatedTxns.rows
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Transfer error: ", err);
        res.status(500).json({ success: false, message: "TRANSACTION FAILED" });
    } finally {
        client.release();
    }
});

// ==========================================
// 5. REQUEST MONEY ENDPOINT
// ==========================================
app.post('/api/request-money', async (req, res) => {
    try {
        const { requesterVpa, payeeVpa, amount } = req.body;
        if (!requesterVpa || !payeeVpa || !amount) {
            return res.status(400).json({ success: false, message: "Fill the required details" });
        }

        const reqAmount = parseFloat(amount);
        if (isNaN(reqAmount) || reqAmount <= 0) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        const cleanPayee = payeeVpa.trim().toLowerCase();
        const fullPayeeVpa = cleanPayee.includes("@") ? cleanPayee : `${cleanPayee}@arthasanchar`;

        const cleanRequester = requesterVpa.trim().toLowerCase();
        const fullRequesterVpa = cleanRequester.includes("@") ? cleanRequester : `${cleanRequester}@arthasanchar`;

        if (fullRequesterVpa === fullPayeeVpa) {
            return res.status(400).json({ success: false, message: "Cannot request money from yourself." });
        }

        // Verify target account exists
        const payeeCheck = await db.query('SELECT vpa FROM accounts WHERE vpa = $1', [fullPayeeVpa]);
        if (payeeCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Target account not found." });
        }

        const reqId = `REQ${Date.now()}`;
        await db.query(
            `INSERT INTO payment_requests (id, requester_vpa, payee_vpa, amount, status)
             VALUES ($1, $2, $3, $4, 'PENDING')`,
            [reqId, fullRequesterVpa, fullPayeeVpa, reqAmount]
        );

        return res.json({
            success: true,
            message: `Request of ₹${reqAmount} sent to ${fullPayeeVpa}`
        });
    } catch (err) {
        console.error("Request money error: ", err);
        return res.status(500).json({ success: false, message: "Failed to send request." });
    }
});

// ==========================================
// 6. RESPOND TO REQUEST ENDPOINT
// ==========================================
app.post('/api/respond-request', async (req, res) => {
    const client = await db.pool.connect();
    try {
        const { requestId, action, upiPin } = req.body;

        const reqCheck = await client.query(
            `SELECT id, requester_vpa, payee_vpa, amount, status FROM payment_requests WHERE id = $1`,
            [requestId]
        );

        if (reqCheck.rows.length === 0 || reqCheck.rows[0].status !== 'PENDING') {
            return res.status(400).json({ success: false, message: "Request not found or already processed." });
        }

        const request = reqCheck.rows[0];
        const normalizedAction = String(action).toUpperCase();

        if (normalizedAction === "DECLINE") {
            await db.query(`UPDATE payment_requests SET status = 'DECLINED' WHERE id = $1`, [requestId]);
            return res.json({ success: true, message: "Request declined." });
        }

        if (normalizedAction === "APPROVE") {
            await client.query('BEGIN');

            // Lock Payer Account Row (payee_vpa in payment_request is the person paying)
            const payerRes = await client.query(
                `SELECT vpa, balance, pin_hash FROM accounts WHERE vpa = $1 FOR UPDATE`,
                [request.payee_vpa]
            );

            const requesterRes = await client.query(
                `SELECT vpa, balance FROM accounts WHERE vpa = $1 FOR UPDATE`,
                [request.requester_vpa]
            );

            if (payerRes.rows.length === 0 || requesterRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: "Accounts mismatch." });
            }

            const payerAccount = payerRes.rows[0];

            // PIN Verification
            const isValidPin = await bcrypt.compare(upiPin.toString(), payerAccount.pin_hash);
            if (!isValidPin) {
                await client.query('ROLLBACK');
                return res.status(401).json({ success: false, message: "Incorrect UPI PIN." });
            }

            const reqAmount = parseFloat(request.amount);
            if (parseFloat(payerAccount.balance) < reqAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: "Insufficient balance." });
            }

            // Execute Balances Update
            await client.query(`UPDATE accounts SET balance = balance - $1 WHERE vpa = $2`, [reqAmount, request.payee_vpa]);
            await client.query(`UPDATE accounts SET balance = balance + $1 WHERE vpa = $2`, [reqAmount, request.requester_vpa]);

            // Add Transaction Record
            const txnId = `TXN${Date.now()}`;
            await client.query(
                `INSERT INTO transactions (id, sender_vpa, payee_vpa, amount, status)
                 VALUES ($1, $2, $3, $4, 'SUCCESS')`,
                [txnId, request.payee_vpa, request.requester_vpa, reqAmount]
            );

            // Update Request Status
            await client.query(`UPDATE payment_requests SET status = 'APPROVED' WHERE id = $1`, [requestId]);

            await client.query('COMMIT');
            return res.json({ success: true, message: "Payment approved and sent!" });
        }
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Respond request error: ", err);
        return res.status(500).json({ success: false, message: "Error processing request response." });
    } finally {
        client.release();
    }
});

// HTML Page Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname,'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname,'public', 'dashboard.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname,'public', 'index.html')));

const PORT = process.env.PORT || 2823;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));