const express = require('express');
const path=require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config;
const app = express();
app.use(express.json());//middleware which converts the incoming JSON text format data into actual usable format and JS reconstructs the structure into req.body
app.use(cors());
app.use(express.static(path.join(__dirname),)); //static files like images,css files,stylesheets and the basic frontned local storage JS that i wrote un sab ko handle karne ke liye
app.get('/favicon.ico', (req, res) => res.status(204).end());

// });
// In-Memory Database Simulation for testing backend logic
// const db = {
//     users: [
//         //{id:101,fullName:"Aditya",mobileNumber:"7355134769"}
//     ],//if user enters through mobiles number we just search db.users.find((num)=>{return num==number we get user id through this} and extract the id from the array then use the id as access key for account)
//     accounts: {
//         "adi@arthasanchar": {
//             userId: 101,
//             bankName: "HDFC Bank",
//             vpa: "adi@arthasanchar",
//             //pre hashed bcrypt pin for default pin 1234
//             pinHash:"$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW", 
//             balance: 45230.50,
//             accountNo: "8912"
//         }
//     },
//     transactions: [
//         { 
//             id: "TXN1001",
//              title: "Paid to Merchant Store",
//               type: "debit", 
//               amount: 450.00, 
//               date: "Today, 2:30 PM", 
//               senderVpa: "adi@arthasanchar", 
//               payeeVpa: "merchant@arthasanchar" 
//             },
//         { 
//             id: "TXN1000", 
//             title: "Received from VEDL", 
//             type: "credit",
//              amount: 1200.00, 
//              date: "Yesterday, 6:15 PM",
//               senderVpa: "vedl@arthasanchar", 
//               payeeVpa: "adi@arthasanchar" 
//             }
//     ],
//     requests:[

//     ]
// };
const db=require('./config/db');

// ==========================================
// 1. REGISTER ENDPOINT
// ==========================================
app.post('/api/register',async(req,res)=>{
    try {
        const { fullName, mobileNumber, bankName, vpaHandle, upiPin } = req.body;

        if (!fullName || !mobileNumber || !vpaHandle || !upiPin) {
            return res.status(400).json({success:false ,error: "All fields are not filled." });//however this won't execute ever as I have already specified required in each input field of html form but malicious users or tools like postman can bypass HTML form completely and send raw json requests directly to api/register so backend validation is the final line of defense in that case;
        }
        const rawHandle=vpaHandle.trim().toLowerCase();//just like pythons strip we have trim to remove whitespaces and convert tolowercase to avoid case sensitivity
        const cleanHandle=rawHandle.includes("@")?rawHandle.split("@")[0]:rawHandle;//checks if it includes @ if yes then divide the string with dividing comparator as @ and only get the first element of that split list or array means only string before @is retrieved in clean handle and that clean handle is used to build our vpa with @arthasanchar  as suffix;
        const vpa = `${cleanHandle}@arthasanchar`;

        // agar already exist karta hai wo user then he can't register with that vpa
        if (db.accounts[vpa]) {
            return res.status(400).json({ 
                success:false,
                error: "VPA already registered." 
            });
        }
        const cleanMobile=mobileNumber.trim();//check if number is already registered or not;
        const existingMobile=db.users.find(u=>u.mobileNumber===cleanMobile);
        if(existingMobile){
            return res.status(400).json({
                success:false,
                message:"MOBILE NUMBER IS ALREADY REGISTERED"
            });
        }

        // Hash PIN for security
        //bycrypt requires string inputs for its methods and it also helps in preserving pin with initial as 0
        const pinHash = await bcrypt.hash(upiPin.toString().trim(), 10);//it is an asynchronous operation so we have to ensure that hashing is complete thus await pausses the surrounding async functions until this operation returns the hashed value,hashed varibale is stored in pin hash and then only below code starts execution else below code won't work normally for pin
        //pin hash will contain a the complete hash string that comes when the promise is resolved,without awit it would contain an unresolved promise object which will lead to error in storing that as a object instaed of hash string and break comparison as well;
        const id=Date.now();
        //shorthand syntax
        const newUser = { id,
             fullName, 
             mobileNumber:cleanMobile };
        const newAccount = {
            userId: newUser.id,//or id
            bankName,
            vpa,
            pinHash,
            balance: 10000.00,
            accountNo: Math.floor(1000 + Math.random() * 9000).toString()
        };

        db.users.push(newUser);//push another object with id,name,number inside users array
        db.accounts[vpa] = newAccount; //made a new key value pair with vpa or upiId to access all the account details;
        res.status(201).json({ 
            success:true,
            message: "Registration successful!",
            vpa:newAccount.vpa, 
            user:{
                  fullName:newUser.fullName,
                  vpa:newAccount.vpa,
                  bankName:newAccount.bankName,
                  balance:newAccount.balance
                      }
            });//this response will only be send upon succesful registration of user
    } catch (err) {
        console.log("registration error: ",err);
        res.status(500).json({ 
            success:false,
            error: "server error!!Registration Failed-Please Try Again" 
        });
    }
});

// ==========================================
// 2. LOGIN ENDPOINT
// ==========================================
app.post('/api/login', async (req, res) => {
  try{//let instead of const as we have to trim these id's without generating new object 
    let { loginId, upiPin } = req.body;//this syntax is basically destructuring object so instead of doing const loginId=req.body.loginId we can directly access it in this manner
       if (!loginId || !upiPin) {
        return res.status(400).json({ success: false, 
            message: "Please enter Login ID and PIN" });
    }
    loginId=loginId.trim();
    let targetVpa=loginId;
    if(!loginId.includes('@')&&isNaN(loginId)){
        targetVpa=`${loginId}@arthasanchar`;
    }
    // Search account by VPA or Mobile
    let account = db.accounts[targetVpa]||db.accounts[loginId];
    if (!account) {
        account = Object.values(db.accounts).find(acc => {
            const user = db.users.find(u => u.id === acc.userId);
            //Object.values() function-as the named suggest it extracts the values of any object in form of objects stored inside an array and doesn't include keys so that find is applied across the values stored as object inside the array and find is used to search across each objects inside the array untill the value becomes true;
            //2nd find function it to search in users array to find if user id of any object in users array matched with the account.userId and returns true at last if userid matches and mobile number matches with login ID
            return user && user.mobileNumber === loginId;
            //unlike cpp here it returns only if the value is truth of the extracted account array ends;
        });
    }

    if (!account) {
        return res.status(404).json({ 
            success:false,
            error: "Account not found."
         });
    }

    const isValidPin = await bcrypt.compare(upiPin.toString().trim(), account.pinHash);
    if (!isValidPin) {
        return res.status(401).json({ 
            success:false,
            error: "Invalid UPI PIN."
         });
    }

    const user = db.users.find(u => u.id === account.userId);
    if (!user) {
    return res.status(404).json({
        success: false,
        error: "User associated with this account was not found."
    });
}

    res.json({
        message: "Login successful",
        success:true,
        user: {
            fullName: user.fullName,
            vpa: account.vpa,
            bankName: account.bankName,
            balance: account.balance
        }
    });
}catch(err){
    console.error("Login error: ",err);
    return res.status(500).json({
        success:false,
        message:"Server ERROR DURING LOGIN"
    });
}

});
//Dashboard api endpoint
app.get('/api/dashboard',(req,res)=>{
    try{
    //at first fetch the required info of the user through his/hers vpa id as it ws the key in our accounts object which had a parent object db;
    const {vpa}=req.query;//||"adi@arthaSanchaar";
    if(!vpa){
        return res.status(400).json({
            success:false,
            message:"VPA IS REQURIED"
        })
    }
    const account=db.accounts[vpa];//db-grandparent,account-parent key-primary vpa-child key with all info
    if(!account){//c++ mein false true pe chalta tha here it means null,undefined or false all equate to falsy values
        return res.status(404).json({//without specifying the status the response will be send but status will be 200-ok even though account wasn't found
            //http status codes help in debugging when we scale up project as testing tools like POSTMAN and front end code can use status codes to identify what error happened
            success:false,
            message:"Account Not Found"
        });
    }
        const user=db.users.find((u)=>{
          return  u.id===account.userId;
        });//user was an array which served as an key inside db object and since we already checked the existence of user in db with primaryVpa so no need to check again with user that if(!user)return res.json error type code
        const userTransactions=db.transactions.filter(
            t=> t.senderVpa.toLowerCase()===vpa || t.payeeVpa.toLowerCase()===vpa
        ).reverse();
        const pendingRequests=db.requests.filter(//the request is only visible to the payee who has to pay so we filter it and search for the payee vpa in request array,when the object matches with the account and status verifies we store that in pending request and send it as a response therough json;
            r=>r.payeeVpa.toLowerCase()===vpa && r.status==="PENDING"
        );
        res.json({
            success:true,
            user:{
                fullName:user?user.fullName:"Aditya",
                vpa:account.vpa,
                bankName:account.bankName,
                accountNo:account.accountNo,
                balance:account.balance
            },
            // we have to filter transactions where the logged in user is either sender or reciever otherwise directlty returning db.transactions will give all the transactions of database of all users
            transactions:userTransactions,
            pendingRequests
        });
    }
        catch(err){
       console.error("DASHBOARD API ENDPOINT ERROR",err);
       res.status(500).json({
        success:false,
        message:"DASHBOARD LOADING FAILED"
       });
       }

    });
//transferring without request
app.post('/api/transfer', async (req, res) => {
    try{
    const { senderVpa, payeeVpa, amount, upiPin } = req.body;
        const transferAmount = parseFloat(amount);
      if(!senderVpa||!payeeVpa||!amount||transferAmount<=0||!upiPin){
        return res.status(400).json({
            success:false,
            message:"Please fill the required details to initiate transaction"
        });
      }
      if(senderVpa.toLowerCase()===payeeVpa.toLowerCase()){
        return res.status(400).json({
            success:false,
            message:"Can't send money to the same account holder"
        });
      }

    const senderAccount = db.accounts[senderVpa];
    const payeeAccount=db.accounts[payeeVpa];

    if (!senderAccount) {
        return res.status(404).json({ success:false,message: "Sender account not found." });
    }
    if(!payeeAccount){
        return res.status(404).json({
            success:false,
            message:"Receiver account not found in database"
        });
    }
    const isValidPin = await bcrypt.compare(upiPin.toString().trim(), senderAccount.pinHash);
    if (!isValidPin) {
        return res.status(401).json({ success:false,message: "Incorrect UPI PIN." });
    }
    if (senderAccount.balance < transferAmount) {
        return res.status(400).json({ 
            success:false,
            message: "Insufficient Funds in senders account" });
    }
    senderAccount.balance -= transferAmount;
    payeeAccount.balance+=transferAmount;
    // if (db.accounts[payeeVpa]) {
    //     db.accounts[payeeVpa].balance += transferAmount;
    // }
    const transaction = {
        id: `TXN${Date.now()}`,
        senderVpa,
        payeeVpa,
       //title:`paid to ${payeeAccount.vpa}`,
        amount: transferAmount,
       // type:"debit",
        timestamp: new Date().toISOString(),
        status: "SUCCESS"
    };
    db.transactions.push(transaction);

    const senderUser=db.users.find(u=>u.id===senderAccount.userId);

    const updatedTxn=db.transactions.filter(
        t=>t.senderVpa===senderVpa||t.payeeVpa===senderVpa).reverse();
    res.json({
        success:true,
        message: `Transferred funds:${transferAmount.toFixed(2)}\n
                  from : ${senderAccount.vpa} to : ${payeeAccount.vpa}
        `,
        user:{
         fullName:senderUser?senderUser.fullName:"USER",
         vpa:senderVpa,
         bankName:senderAccount.bankName,
         accountNo:senderAccount.accountNo,
         balance:senderAccount.balance
        },
        transactions:updatedTxn
       
    });
    }catch(err){
        console.error("TRANSACTION FAILED",err);
        res.status(500).json({
            success:false,
            message:"TRANSACTION FAILED"
        })
    }
});
//transaction requests from another user in databse;
app.post('/api/request-money', (req,res)=>{
    try {
        const { requesterVpa, payeeVpa, amount } = req.body;

        if (!requesterVpa || !payeeVpa || !amount) {
            return res.status(400).json({ success: false, message: "Fill the required details" });
        }
        const reqAmount = parseFloat(amount);//form se input aata hai string ke form mein basically JSON text format se as we send using JSON.stringify() so we have to convert it intoFloat to make it numerical with preserving decimals as well
        if (isNaN(reqAmount) || reqAmount <= 0){
            return res.status(400).json({ success: false, 
                message: "Invalid amount" });
        }
        //NORMALISING PAYEE AND REQUESTER VPA TO MAKE SURE THEY DON'T GO UNDEFINED AND REQUEST DOESN'T GOES ON TO A NON EXISTING USER IN DATABASE;
        const cleanPayee=payeeVpa.trim().toLowerCase();
        const fullpayeeVpa=cleanPayee.includes("@")?cleanPayee:`${cleanPayee}@arthasanchar`;

        const cleanRequester=requesterVpa.trim().toLowerCase();
        const fullrequesterVpa=cleanRequester.includes("@") ? cleanRequester : `${cleanRequester}@arthasanchar`;
        

        if (fullrequesterVpa===fullpayeeVpa){
            return res.status(400).json({ 
                success: false, 
                message: "Cannot request money from yourself."
             });
        }

        if (!db.accounts[fullpayeeVpa]) {
            return res.status(404).json({ success: false, message: "Target account not found." });
        }
        // const exisintingVpas=Object.keys(db.accounts).map(v=>v.toLowerCase());
        // const payeeExists=exisintingVpas.includes(fullpayeeVpa);
        // if(!payeeExists){
        //     return res.status(404).json({
        //         success:false,
        //         message:"can't request money from an non existing user in databse"
        //     });
        // }
        //    const accountKeys=Object.keys(db.accounts);
        //    const targetAccountKey=accountKeys.find(key=>key&&key.toLowerCase()===fullpayeeVpa);
        //    if (!targetAccountKey || !db.accounts[targetAccountKey]) {
        //     return res.status(404).json({
        //         success: false,
        //         message: "Cannot request money from a non-existing user in database."
        //     });
        // }
        const newRequest = {
            id: `REQ${Date.now()}`,
            requesterVpa:fullrequesterVpa,
            payeeVpa:fullpayeeVpa,
            amount: reqAmount,
            status: "PENDING",
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        db.requests.push(newRequest);//array that stores objects and requests array serves as a key;
console.log("CURRENT PENDING REQUESTS: ",db.requests);
        return res.json({
            success: true,
            message: `Request of ₹${reqAmount} sent to ${fullrequesterVpa}`
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to send request." });
    }
});


app.post('/api/respond-request', async (req, res) => {
    try {
        const { requestId, action, upiPin } = req.body;

        const request = db.requests.find(r => r.id === requestId);
        if (!request || request.status !== "PENDING") {
            return res.status(400).json({ success: false, message: "Request not found or already processed." });
        }
          const normalisedAction=String(action).toUpperCase();
        if (normalisedAction === "DECLINE") {
            request.status = "DECLINED";
            return res.json({ success: true, message: "Request declined." });
        }

        if (normalisedAction === "APPROVE") {
            //ab basically fetch both the accounts then agar koi exist nhi kiya to return error else agar account match kar gaya but but pin nhi then uska error ya bhi balance check error
            const payerAccount = db.accounts[request.payeeVpa];
            const requesterAccount = db.accounts[request.requesterVpa];

            if (!payerAccount || !requesterAccount) {
                return res.status(404).json({ success: false, message: "Accounts mismatch." });
            }

            const isValidPin = await bcrypt.compare(upiPin.toString(), payerAccount.pinHash);
            if (!isValidPin) {
                return res.status(401).json({ success: false, message: "Incorrect UPI PIN." });
            }

            if (payerAccount.balance < request.amount) {
                return res.status(400).json({ success: false, message: "Insufficient balance." });
            }

            payerAccount.balance -= request.amount;
            requesterAccount.balance += request.amount;

            db.transactions.push({
                id: `TXN${Date.now()}`,
                senderVpa: request.payeeVpa,
                payeeVpa: request.requesterVpa,
                amount: request.amount,
                date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: "SUCCESS"
            });

            request.status = "APPROVED";
            return res.json({ success: true, message: "Payment approved and sent!" });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: "Error processing request response." });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT=2814;
const server=app.listen(PORT,()=>{
    console.log(`Running on ${PORT}`);
});
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already busy. Please close the running server instance or kill port ${PORT}.`);
    } else {
        console.error("Server error:", err);
    }
});