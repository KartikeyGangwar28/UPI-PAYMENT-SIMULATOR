
//const apiBaseUrl="http://localhost:2823";//stores URL of backend API/server;
const apiBaseUrl = typeof window !== 'undefined' ? window.location.origin : '';
function getQueryParam(param){//takes a parameter that we will use to get info
    //URL SEARCH PARAMS IS builtin JS api that parses the query string retreived from location.search into a structure or better say object that allows us to search conveniently using object.methods/keys/properties etc
    const urlParams = new URLSearchParams(window.location.search);//location.search method extracts the query part from URL after ? symbol 
    return urlParams.get(param);//the get methods isn't inbuilt in JS but the URLSEACHParams provied the .get() method to the urlParams object;
    //way of accessing elements in this objected returned by URLSearchParams is nnot as same as a normal JS object;other common methods are .has(parameter) or .getALL(parameter) and the parameter are always text;
}
//REGISTRATION FORM;

//WHEN WE OPEN A URL OR START THE SITE ON LOCAL HOST OR ON SERVER THE BROWSER PARSES THE HTML AND BUILDS A DOM TREE AS SOON AS THE TREE IS BUILT COMPLETELY THE DOMContetnLoaded event is fired and browser signals that html parsing is completed and DOM is ready and then the callback function of eventlistener executes;
document.addEventListener("DOMContentLoaded",()=>{
if (document.getElementById("account-balance")){//null if not and in JS null/undefined equates to false  
    //id of the parent div/form or any container plays very important role here therefore so next time se be a bit more professional while choosing id and classes
        fetchDashboardData();
        setupDashboardForms();
        setupQuickActions();
        setupRequestForm();
        setupScanSimulator();
        setInterval(()=>{
            fetchDashboardData();
        },3000)
    }
    if (document.getElementById("login-form")) {
        setupLoginForm();
    }
    if (document.getElementById("registration-form")) {
        setupRegistrationForm();
    }
});
async function fetchDashboardData() {
    const userVpa=getQueryParam("vpa");//retrieved user vpa/upi id from this //can return false is the key doesn't exists in URLSearchParams object;
        if(!userVpa){
            alert("NO ACTIVE SESSION FOUND.REDIRECTING TO LOGIN");
            window.location.href="login.html";
            return;
        }
    try{
        const endpoint=userVpa
        ?`${apiBaseUrl}/api/dashboard?vpa=${encodeURIComponent(userVpa)}`
        :`${apiBaseUrl}/api/dashboard`;//end point remains the default else the encoder URI component -encodeURIComponent() safely encodes the value for inclusion in a URL component,     it percent-encodes characters that need encoding in a URL component; it doesn't remove them.;
        // http://localhost:2823/api/dashboard?vpa=aadi@upi or http://localhost:2823/api/dashboard if no query string
        //by default fetch sends get http request so no need to specify here
        const response=await fetch(endpoint);//the generated url is then sent to backend server;
        const data= await response.json(); //so returned data in json format is parsed into a js usebale value and "not necessarily a JS executable object-it does ";
        //Frontend sends the full URL as an HTTP request. Express matches the request using the HTTP method and URL path then routes it to the appropriate handler and Query parameters can be accessed using req.query while data sent in the request body can be accessed using req.body (with the appropriate middleware configured);.
        if(data.success&&response.ok){
            renderDashboard(data.user,data.transactions,data.pendingRequests);
        }
        else{
            alert(data.message||"FAILED TO LOAD DASHBOARD DATA");
        }
    }
    catch(err){
        console.log("ERROR CONNECTING TO SERVER: ",err);
        alert("UNABLE TO CONNCET TO SERVER AT SPECIFIED PORT");
    }
}
function renderDashboard(user, transactions=[],pendingRequests=[]) {
    const nameElem = document.getElementById("user-display-name");
    const vpaElem = document.getElementById("user-display-vpa");
    const balanceElem = document.getElementById("account-balance");
    const bankElem = document.getElementById("bank-name");

    if (nameElem) nameElem.textContent = user.fullName;
    if (vpaElem) vpaElem.textContent = user.vpa;
    if (balanceElem) balanceElem.textContent = `₹ ${parseFloat(user.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (bankElem) bankElem.textContent = `${user.bankName} Bank`;

    const reqList=document.getElementById("pending-requests");
    if(reqList){
        if(!pendingRequests||pendingRequests.length===0){
            reqList.innerHTML="";
        }
        else{
            reqList.innerHTML=pendingRequests.map(req=>`
                <div style="background: #fffaf0; border: 1px solid #feebc8; border-radius: 12px; padding: 14px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong style="display: block; font-size: 14px; color: #744210;">Payment Request</strong>
                        <span style="font-size: 13px; color: #975a16;">${req.requesterVpa} requested ₹${parseFloat(req.amount).toFixed(2)}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="approveRequest('${req.id}')" style="background: #38a169; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">Pay</button>
                        <button onclick="declineRequest('${req.id}')" style="background: #e53e3e; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer;">Decline</button>
                    </div>
                </div>
            `).join('');
        }
    }

    const txnList = document.getElementById("txn-history");
    if (!txnList) return;

    if (!transactions || transactions.length === 0) {
        txnList.innerHTML = `<div class="empty-state" style="padding: 15px; text-align: center; color: #718096;">No recent transactions.</div>`;
        return;
    }

    txnList.innerHTML = transactions.map(txn => {
        const isDebit = txn.senderVpa === user.vpa || txn.type === "debit";
        let displayTitle=txn.title;
        if(!displayTitle){
            displayTitle=isDebit?`Paid to ${txn.payeeVpa}`:`Received from ${txn.senderVpa}`
        }
        const displayDate=txn.date||txn.timestamp||"JUST NOW";
        const amountClass = isDebit ? "debit-amount" : "credit-amount";
        const prefix = isDebit ? "-" : "+";

        return `
            <div class="transaction-item" style="display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #edf2f7;">
                <div class="txn-details">
                    <strong class="txn-title" style="display: block; font-size: 14px;">${displayTitle}</strong>
                    <span class="txn-date" style="font-size: 12px; color: #718096;">${displayDate}</span>
                </div>
                <div class="txn-value ${amountClass}" style="font-weight: 600; color: ${isDebit ? '#e53e3e' : '#38a169'};">
                    ${prefix}₹${parseFloat(txn.amount).toFixed(2)}
                </div>
            </div>
        `;
    }).join('');
}
async function approveRequest(requestId){
    const upiPin=prompt("ENTER YOUR 4 DIGIT PIN TO CONFIRM THE PAYMENT: ");
    if(!upiPin)return;
    try{
        const res=await fetch("/api/respond-request",{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                requestId,
                action:'APPROVE',
                upiPin:upiPin.trim()
            })
        });
        const data=await res.json();
       if(!data.success)alert(data.message);
        if(data.success&&res.ok){//good industry level practice;
            alert(data.message);
            fetchDashboardData();
        }
    }
    catch(err){
        console.log("request approval failed: ",err);
        alert("Server error approving request");
    }
}
async function declineRequest(requestId){
  if(!confirm("Decline this payment request"))return;
  try{
    const res=await fetch('/api/respond-request',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
            requestId,action:'DECLINE'
        })
    });
    const data=await res.json();
    alert(data.message);
    if(data.success)fetchDashboardData();
  }catch(err){
    alert("server error in declining request");
  }
}

// function renderTransactions(transactions = []) {
//     const historyList = document.getElementById("txn-history") || document.getElementById("transaction-history");
//     if (!historyList) return;

//     historyList.innerHTML = "";
    
//     if (transactions.length === 0) {
//         historyList.innerHTML = "<p style='text-align:center; color:#a0aec0; font-size:12px;'>No recent transactions</p>";
//         return;
//     }

//     transactions.forEach(txn => {
//         const isDebit = txn.type === "debit";
//         const li = document.createElement("div");
//         li.className = "txn-item";
//         li.innerHTML = `
//             <div class="txn-details">
//                 <p class="txn-title">${txn.title}</p>
//                 <p class="txn-sub">ID: ${txn.id} | ${txn.date || 'Just now'}</p>
//             </div>
//             <div class="txn-amount ${isDebit ? 'debit' : 'credit'}">
//                 ${isDebit ? '-' : '+'} ₹ ${parseFloat(txn.amount).toFixed(2)}
//             </div>
//         `;
//         historyList.appendChild(li);
//     });
// }

// ==========================================
// 4. AUTH & REGISTRATION HANDLERS
// ==========================================
function setupLoginForm() {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const loginId = document.getElementById("login-id").value.trim();
        const upiPin = document.getElementById("login-pin").value.trim();
        if (!loginId||!upiPin) {
            alert("Please enter both Login ID and PIN.");
            return;
        }
        try {
            const response = await fetch(`${apiBaseUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },//request body contains JSON data 
                body: JSON.stringify({ loginId, upiPin })//shorthand syntax where we created a object,converted it to JSON text format sent it to backend to retrieve info
            });

            const data = await response.json();

            if (data.success&&response.ok) {
                alert("Login Successful!");
                // Redirect to dashboard with the logged-in user's VPA in URL
                window.location.href = `dashboard.html?vpa=${encodeURIComponent(data.user.vpa)}`;
            } else {
                alert(data.message || data.error || "Invalid Credentials");
            }
        } catch (err) {
            alert("Unable to connect to Node.js backend server.");
        }
    });
}

function setupRegistrationForm() {
    const regForm = document.getElementById("registration-form");
    if (!regForm) return;

    regForm.addEventListener("submit", async (e) => {
        e.preventDefault();// e is a event object that can be passed as a parameter in a callback function of an event listener and .preventDefault() method is used to prevent the default behaviour of page like refreshing on each operation and all
        //e is an object automatically created by browser upon event and is passed to callback function as a parameter upon execution or triggering of the specified event and preventDefault methods prevent the html elements from performing their default browser behaviour like refreshing web page upon submission of form or blocking movement on clicking a anchor link
    
        const fullName = document.getElementById("full-name").value.trim();
        const mobileNumber = document.getElementById("mobile-number").value.trim();
        const bankName = document.getElementById("select-bank").value;
        const vpaRaw = document.getElementById("custom-vpa").value.trim().toLowerCase();
        const upiPin = document.getElementById("upi-pin").value.trim();
        const vpaHandle = vpaRaw.includes('@') ? vpaRaw.split('@')[0] : vpaRaw;

        if (!vpaHandle) {
            alert("Please enter a valid UPI handle.");
            return;
        }
        try {
            const response = await fetch(`${apiBaseUrl}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ //frontend to backend mein data transfer karte waqt we convert it into JSON text format and while retrieveing we parse it into JS object or executable format;
                    fullName, 
                    mobileNumber,
                     bankName, 
                    vpaHandle,
                     upiPin })
            });

            const data = await response.json();//

            if (data.success&&response.ok) {
                alert("Account Created Successfully! Redirecting to Dashboard...");
                const registeredVpa = data.vpa || (data.user && data.user.vpa) || `${vpaHandle}@arthasanchar`;
                window.location.href = `dashboard.html?vpa=${encodeURIComponent(registeredVpa)}`;
            } else {
                alert(data.message || data.error || "Registration Failed.");
            }
        } catch (err) {
            console.log("REGISTRATION FORM SUBMISSION ERROR",err);
            alert("Error connecting to registration server.");
        }
    });
}

// ==========================================
// 5. DASHBOARD ACTIONS & TRANSFER HANDLER
// ==========================================
function setupDashboardForms() {
    const transferForm = document.getElementById("transfer-form");
    if (!transferForm) return;

    transferForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payeeVpa = document.getElementById("payee-vpa").value.trim();
        const amount = document.getElementById("amount").value;
        const upiPin = document.getElementById("pin").value.trim();
        const senderVpa = getQueryParam("vpa");
        if (!payeeVpa || !amount || !upiPin) {
                alert("Please fill in all fields!");
                return;
            }

        try {
            const response = await fetch(`${apiBaseUrl}/api/transfer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderVpa, payeeVpa, amount, upiPin })
            });

            const data = await response.json();

            if (data.success&&response.ok) {
                transferForm.reset();
                alert(data.message);
                if(data.user&&data.transactions){
                    renderDashboard(data.user,data.transactions);
                }
                else{
                    await fetchDashboardData();
                }
            } else {
                alert(data.message || data.error||"FAILED TRANSACTION");
            }
        } catch (err) {
            console.log("transfer failed: ",err);
            alert("Transfer failed. Please check backend connection.");
        }
    });
}

function setupQuickActions(){
    const btnSend = document.getElementById("btn-send");
    const btnRequest = document.getElementById("btn-request");
    const btnScan = document.getElementById("btn-scan");
    const btnPassbook = document.getElementById("btn-passbook");

    const secSend = document.getElementById("section-send");
    const secRequest = document.getElementById("section-request");
    const secScan = document.getElementById("section-scan");
    const secPassbook = document.getElementById("section-passbook");

    function switchTab(activeBtn, activeSection) {
        [secSend, secRequest, secScan].forEach(sec => {
            if (sec) sec.classList.add("hidden");
        });
        [btnSend, btnRequest, btnScan, btnPassbook].forEach(btn => {
            if (btn) btn.classList.remove("active");
        });

        if (activeSection) activeSection.classList.remove("hidden");
        if (activeBtn) activeBtn.classList.add("active");
    }

    if (btnSend) btnSend.addEventListener("click", () => switchTab(btnSend, secSend));
    if (btnRequest) btnRequest.addEventListener("click", () => switchTab(btnRequest, secRequest));
    if (btnScan) btnScan.addEventListener("click", () => switchTab(btnScan, secScan));
    if (btnPassbook) btnPassbook.addEventListener("click", () => {
        switchTab(btnPassbook, secPassbook);
        if (secPassbook) secPassbook.scrollIntoView({ behavior: 'smooth' });
    });
}

function setupRequestForm(){
    const reqForm = document.getElementById("request-form");
    if (!reqForm) return;

    reqForm.addEventListener("submit", async(e) => {
        e.preventDefault();
       const payeeVpa=document.getElementById("req-vpa").value.trim();
       const amount=document.getElementById("req-amount").value.trim();
       const requesterVpa=getQueryParam("vpa");//logged in user vpa from url;
       if(!payeeVpa||!amount){
        alert("please enter valid payee vpa and amount");
        return;
       }
       try{
        const res=await fetch(`${apiBaseUrl}/api/request-money`,{
            method:"POST",
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
                requesterVpa,
                payeeVpa,
                amount
            })
        });
        const data=await res.json();
        if(data.success&&res.ok){
            alert(data.message);
            reqForm.reset();
            fetchDashboardData();
        }
        else{
            alert(data.message||"failed to send request");
        }
       }
       catch(err){
        console.error("request error: ",err);
        alert("error connecting to the server please try again");
       }
    });
}

function setupScanSimulator() {
    const simScanBtn = document.getElementById("sim-scan-btn");
    if (!simScanBtn) return;

    simScanBtn.addEventListener("click", () => {
        const btnSend = document.getElementById("btn-send");
        if (btnSend) btnSend.click();

        document.getElementById("payee-vpa").value = "merchant@arthasanchar";
        document.getElementById("amount").value = "250.00";
        alert("Merchant QR Scanned! Pre-filled details for merchant@arthasanchar.");
    });
}  