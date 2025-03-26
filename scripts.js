document.addEventListener("DOMContentLoaded", function () {
    const tableBody = document.getElementById("projectTable");
    const projectCount = document.getElementById("project-count");
    const fileInput = document.getElementById("fileInput");
    const dropdownBtn = document.querySelector(".dropdown-btn");
    const dropdownMenu = document.querySelector(".dropdown-menu");
    const docPreview = document.getElementById("docPreview");
    const closePreviewBtn = document.getElementById("closePreview");
    const encryptionMethodInput = document.getElementById("encryptionMethod");
    const welcomeMessage = document.getElementById("welcomeMessage");

    let loggedInUser = localStorage.getItem("loggedInUser");
    if (!loggedInUser) {
        window.location.href = "login.html";
        return;
    }

    let formattedUsername = loggedInUser.charAt(0).toUpperCase() + loggedInUser.slice(1);
    if (welcomeMessage) {
        welcomeMessage.textContent = `Welcome, ${formattedUsername}`;
    }

    // IndexedDB setup
    const dbName = "ProjectPortalDB";
    const dbVersion = 1;
    let db;

    const request = indexedDB.open(dbName, dbVersion);

    request.onerror = function(event) {
        console.error("Database error: " + event.target.errorCode);
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        initializeApp();
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains("projects")) {
            db.createObjectStore("projects", { keyPath: "projectID" });
        }
        if (!db.objectStoreNames.contains("users")) {
            db.createObjectStore("users", { keyPath: "username" });
        }
    };

    function initializeApp() {
        const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", function () {
                localStorage.removeItem("loggedInUser");
                alert("You have been logged out.");
                window.location.href = "login.html";
            });
        }
        checkUserAndRender();
    }

    function getUser(username) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["users"], "readonly");
            const store = transaction.objectStore("users");
            const request = store.get(username);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function getAllProjects() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["projects"], "readonly");
            const store = transaction.objectStore("projects");
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    function saveProject(project) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["projects"], "readwrite");
            const store = transaction.objectStore("projects");
            const request = store.put(project);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function deleteProject(projectID) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["projects"], "readwrite");
            const store = transaction.objectStore("projects");
            const request = store.delete(projectID);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async function checkUserAndRender() {
        const user = await getUser(loggedInUser);
        if (!user) {
            localStorage.removeItem("loggedInUser");
            window.location.href = "login.html";
            return;
        }
        renderProjects();
    }

    async function generateProjectID(username) {
        // Ensure username is a string and not empty
        if (!username || typeof username !== "string" || username.trim() === "") {
            throw new Error("Invalid username");
        }

        // Get the first letter of the username (uppercase for consistency)
        const firstLetter = username.trim().charAt(0).toUpperCase();

        // Get all users from the database
        const users = await getAllUsers();

        // Filter users whose names start with the same first letter (case-insensitive)
        const matchingUsers = users
            .filter(user => user.username && user.username.trim().charAt(0).toUpperCase() === firstLetter)
            .map(user => user.username);

        // Sort the matching users alphabetically (case-insensitive)
        matchingUsers.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        // Find the position of the username in the sorted list (1-based index)
        let position = matchingUsers.indexOf(username) + 1;

        // If the username is not in the list, add them and re-sort to get the correct position
        if (position === 0) {
            matchingUsers.push(username);
            matchingUsers.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
            position = matchingUsers.indexOf(username) + 1;
        }

        // Generate a random number (e.g., between 1000 and 9999 for simplicity)
        const randomNumber = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;

        // Generate the project ID in the format [FirstLetter][Position]-[RandomNumber]
        let projectID = `${firstLetter}${position}-${randomNumber}`;

        // Check if the project ID already exists (to avoid duplicates)
        const existingProjects = await getAllProjects();
        let isUnique = !existingProjects.some(project => project.projectID === projectID);

        // If the project ID is not unique, generate a new random number and try again
        let attempts = 0;
        while (!isUnique && attempts < 10) {
            const newRandomNumber = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000;
            projectID = `${firstLetter}${position}-${newRandomNumber}`;
            isUnique = !existingProjects.some(project => project.projectID === projectID);
            attempts++;
        }

        if (!isUnique) {
            throw new Error("Unable to generate a unique project ID after multiple attempts");
        }

        return projectID;
    }

    // Helper function to get all users (used by generateProjectID)
    async function getAllUsers() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["users"], "readonly");
            const store = transaction.objectStore("users");
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async function renderProjects() {
        const projects = await getAllProjects();
        tableBody.innerHTML = "";
        for (const project of projects) {
            // Fetch the uploader's password from the users store
            const uploader = await getUser(project.uploader);
            const uploaderPassword = uploader ? uploader.password : ""; // Fallback to empty string if user not found
            console.log(`Uploader: ${project.uploader}, Password: ${uploaderPassword}`);
            console.log('Project File in renderProjects:', project.file.substring(0, 50) + '...'); // Debug log
            const newRow = document.createElement("tr");
            newRow.innerHTML = `
                <td>${project.projectID}</td>
                <td>${project.date}</td>
                <td data-title="${project.encryptedName}">${project.encryptedName}</td>
                <td><button class="view-btn" data-file="${encodeURIComponent(project.file)}" data-file-type="${project.fileType}" data-password="${uploaderPassword}">📄 View Report</button></td>
                <td><button class="view-encrypted-file-btn" data-content="${encodeURIComponent(project.fullContent || 'No content available')}" data-method="${project.encryptionMethod}" data-uploader-password="${uploaderPassword}">🔒 View Encrypted File</button></td>
                <td><button class="delete-btn" data-id="${project.projectID}">🗑 Delete</button></td>
            `;
            tableBody.appendChild(newRow);
        }

        updateProjectCount(projects.length);

        document.querySelectorAll(".delete-btn").forEach(button => {
            button.addEventListener("click", async function () {
                const projectID = this.getAttribute("data-id");
                const project = projects.find(p => p.projectID === projectID);
                if (project.uploader === loggedInUser) {
                    await deleteProject(projectID);
                    renderProjects();
                } else {
                    alert("❌ You can only delete your own projects!");
                }
            });
        });

        document.querySelectorAll(".view-btn").forEach(button => {
            button.addEventListener("click", function () {
                const fileData = decodeURIComponent(this.getAttribute("data-file"));
                const fileType = this.getAttribute("data-file-type");
                const filePassword = this.getAttribute("data-password");
                showPasswordPrompt(fileData, fileType, filePassword);
            });
        });

        document.querySelectorAll(".view-encrypted-file-btn").forEach(button => {
            button.addEventListener("click", function () {
                const encodedContent = this.getAttribute("data-content");
                const content = decodeURIComponent(encodedContent);
                const encryptionMethod = this.getAttribute("data-method");
                const uploaderPassword = this.getAttribute("data-uploader-password");
                console.log(`Passing to showEncryptedFile - Uploader Password: ${uploaderPassword}`); // Debug log
                showEncryptedFile(content, encryptionMethod, uploaderPassword);
            });
        });
    }

    function showContentInNewPage(content) {
        const newWindow = window.open("", "_blank");
        newWindow.document.write(`
            <html>
            <head>
                <title>Project Content</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    }
                    body {
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container {
                        background: #fff;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                        padding: 30px;
                        width: 100%;
                        max-width: 800px;
                        text-align: center;
                        transition: transform 0.3s ease;
                    }
                    .container:hover {
                        transform: translateY(-5px);
                    }
                    h1 {
                        font-size: 28px;
                        color: #2c3e50;
                        margin-bottom: 20px;
                        font-weight: 600;
                    }
                    pre {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        font-size: 15px;
                        color: #34495e;
                        text-align: left;
                        overflow-x: auto;
                        max-height: 500px;
                        border-left: 4px solid #ff758c;
                        line-height: 1.6;
                    }
                    .back-btn {
                        display: inline-block;
                        margin-top: 20px;
                        padding: 12px 30px;
                        border-radius: 8px;
                        background: #ff758c;
                        color: white;
                        text-decoration: none;
                        font-size: 16px;
                        font-weight: 500;
                        transition: background 0.3s ease, transform 0.2s ease;
                    }
                    .back-btn:hover {
                        background: #ff5e62;
                        transform: scale(1.05);
                    }
                    @media (max-width: 480px) {
                        .container {
                            padding: 20px;
                            max-width: 90%;
                        }
                        h1 {
                            font-size: 24px;
                        }
                        pre {
                            font-size: 13px;
                            padding: 15px;
                        }
                        .back-btn {
                            padding: 10px 20px;
                            font-size: 14px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Project Content</h1>
                    <pre>${content}</pre>
                    <a href="javascript:window.close()" class="back-btn">Close</a>
                </div>
            </body>
            </html>
        `);
        newWindow.document.close();
    }
    function showEncryptedFile(content, method, uploaderPassword) {
        // Encrypt the full content using the selected method
        let encryptedContent;
        switch (method) {
            case "aes":
                encryptedContent = CryptoJS.AES.encrypt(content, "secret_key").toString();
                break;
            case "triple_des":
                encryptedContent = CryptoJS.TripleDES.encrypt(content, "secret_key").toString();
                break;
            case "rc4":
                encryptedContent = CryptoJS.RC4.encrypt(content, "secret_key").toString();
                break;
            case "sha256":
                const shaHash = CryptoJS.SHA256(content).toString();
                const repeatCount = Math.ceil(content.length / shaHash.length);
                let longString = "";
                for (let i = 0; i < repeatCount; i++) {
                    longString += shaHash;
                }
                encryptedContent = btoa(longString);
                break;
            case "base64":
                encryptedContent = btoa(content);
                break;
            default:
                encryptedContent = content;
        }
    
        // Escape the content to handle special characters
        const escapedContent = content.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n");
    
        // Split the encrypted content into chunks (e.g., 500 characters per page)
        const charsPerPage = 500;
        const pages = [];
        for (let i = 0; i < encryptedContent.length; i += charsPerPage) {
            pages.push(encryptedContent.substring(i, i + charsPerPage));
        }
    
        const newWindow = window.open("", "_blank");
        newWindow.document.write(`
            <html>
            <head>
                <title>Encrypted File Content</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    }
                    body {
                        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container {
                        background: #fff;
                        border-radius: 15px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                        padding: 30px;
                        width: 100%;
                        max-width: 600px;
                        text-align: center;
                        transition: transform 0.3s ease;
                    }
                    .container:hover {
                        transform: translateY(-5px);
                    }
                    h1 {
                        font-size: 28px;
                        color: #2c3e50;
                        margin-bottom: 15px;
                        font-weight: 600;
                    }
                    .encryption-method {
                        font-size: 16px;
                        color: #7f8c8d;
                        margin-bottom: 20px;
                        background: #ecf0f1;
                        padding: 8px 15px;
                        border-radius: 20px;
                        display: inline-block;
                    }
                    .content-wrapper {
                        position: relative;
                        margin-bottom: 25px;
                    }
                    pre {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        font-size: 14px;
                        color: #34495e;
                        text-align: left;
                        overflow-x: auto;
                        max-height: 300px;
                        border-left: 4px solid #ff758c;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }
                    .pagination {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 10px;
                    }
                    .pagination button {
                        padding: 8px 15px;
                        border-radius: 8px;
                        background: #dfe6e9;
                        color: #2c3e50;
                        border: none;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 500;
                        transition: background 0.3s ease, transform 0.2s ease;
                    }
                    .pagination button:disabled {
                        background: #f1f3f5;
                        cursor: not-allowed;
                        color: #b2bec3;
                    }
                    .pagination button:not(:disabled):hover {
                        background: #ff758c;
                        color: white;
                        transform: scale(1.05);
                    }
                    .page-info {
                        font-size: 14px;
                        color: #7f8c8d;
                    }
                    .password-prompt {
                        text-align: center;
                    }
                    .password-prompt input {
                        padding: 12px;
                        margin: 10px 0;
                        border-radius: 8px;
                        border: 1px solid #dfe6e9;
                        width: 100%;
                        max-width: 300px;
                        font-size: 16px;
                        text-align: center;
                        outline: none;
                        transition: border-color 0.3s ease;
                    }
                    .password-prompt input:focus {
                        border-color: #ff758c;
                    }
                    .password-prompt input::placeholder {
                        color: #b2bec3;
                    }
                    .password-prompt button {
                        padding: 12px 30px;
                        border-radius: 8px;
                        background: #ff758c;
                        color: white;
                        border: none;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: 500;
                        transition: background 0.3s ease, transform 0.2s ease;
                    }
                    .password-prompt button:hover {
                        background: #ff5e62;
                        transform: scale(1.05);
                    }
                    .error-message {
                        color: #ff758c;
                        margin-top: 10px;
                        font-size: 14px;
                        display: none;
                        font-weight: 500;
                    }
                    @media (max-width: 480px) {
                        .container {
                            padding: 20px;
                            max-width: 90%;
                        }
                        h1 {
                            font-size: 24px;
                        }
                        pre {
                            font-size: 12px;
                            padding: 15px;
                        }
                        .password-prompt input {
                            max-width: 100%;
                        }
                        .pagination button {
                            padding: 6px 12px;
                            font-size: 12px;
                        }
                        .page-info {
                            font-size: 12px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Encrypted File Content</h1>
                    <div class="content-wrapper">
                        <pre id="encryptedContent">${pages[0] || 'No content available'}</pre>
                        <div class="pagination">
                            <button id="prevBtn" disabled>Previous</button>
                            <span class="page-info" id="pageInfo">Page 1 of ${pages.length}</span>
                            <button id="nextBtn" ${pages.length <= 1 ? 'disabled' : ''}>Next</button>
                        </div>
                    </div>
                    <div id="passwordPrompt" class="password-prompt">
                        <input type="password" id="passwordInput" placeholder="Enter password">
                        <br>
                        <button id="submitBtn">Submit</button>
                        <p id="errorMessage" class="error-message">❌ Incorrect password!</p>
                    </div>
                </div>
                <script>
                    const pages = ${JSON.stringify(pages)};
                    let currentPage = 0;
    
                    const contentElement = document.getElementById('encryptedContent');
                    const prevBtn = document.getElementById('prevBtn');
                    const nextBtn = document.getElementById('nextBtn');
                    const pageInfo = document.getElementById('pageInfo');
    
                    function updateContent() {
                        contentElement.textContent = pages[currentPage] || 'No content available';
                        pageInfo.textContent = \`Page \${currentPage + 1} of \${pages.length}\`;
                        prevBtn.disabled = currentPage === 0;
                        nextBtn.disabled = currentPage === pages.length - 1;
                    }
    
                    prevBtn.addEventListener('click', () => {
                        if (currentPage > 0) {
                            currentPage--;
                            updateContent();
                        }
                    });
    
                    nextBtn.addEventListener('click', () => {
                        if (currentPage < pages.length - 1) {
                            currentPage++;
                            updateContent();
                        }
                    });
    
                    document.getElementById('submitBtn').addEventListener('click', function() {
                        const enteredPassword = document.getElementById('passwordInput').value;
                        const errorMessage = document.getElementById('errorMessage');
                        if (enteredPassword === '${atob(uploaderPassword)}') {
                            const contentWindow = window.open('', '_blank');
                            contentWindow.document.write(\`
                                <html>
                                <head>
                                    <title>Project Content</title>
                                    <style>
                                        * {
                                            margin: 0;
                                            padding: 0;
                                            box-sizing: border-box;
                                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                        }
                                        body {
                                            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                                            display: flex;
                                            justify-content: center;
                                            align-items: center;
                                            min-height: 100vh;
                                            padding: 20px;
                                        }
                                        .container {
                                            background: #fff;
                                            border-radius: 15px;
                                            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
                                            padding: 30px;
                                            width: 100%;
                                            max-width: 800px;
                                            text-align: center;
                                            transition: transform 0.3s ease;
                                        }
                                        .container:hover {
                                            transform: translateY(-5px);
                                        }
                                        h1 {
                                            font-size: 28px;
                                            color: #2c3e50;
                                            margin-bottom: 20px;
                                            font-weight: 600;
                                        }
                                        pre {
                                            background: #f8f9fa;
                                            padding: 20px;
                                            border-radius: 10px;
                                            font-size: 15px;
                                            color: #34495e;
                                            text-align: left;
                                            overflow-x: auto;
                                            max-height: 500px;
                                            border-left: 4px solid #ff758c;
                                            line-height: 1.6;
                                        }
                                        .back-btn {
                                            display: inline-block;
                                            margin-top: 20px;
                                            padding: 12px 30px;
                                            border-radius: 8px;
                                            background: #ff758c;
                                            color: white;
                                            text-decoration: none;
                                            font-size: 16px;
                                            font-weight: 500;
                                            transition: background 0.3s ease, transform 0.2s ease;
                                        }
                                        .back-btn:hover {
                                            background: #ff5e62;
                                            transform: scale(1.05);
                                        }
                                        @media (max-width: 480px) {
                                            .container {
                                                padding: 20px;
                                                max-width: 90%;
                                            }
                                            h1 {
                                                font-size: 24px;
                                            }
                                            pre {
                                                font-size: 13px;
                                                padding: 15px;
                                            }
                                            .back-btn {
                                                padding: 10px 20px;
                                                font-size: 14px;
                                            }
                                        }
                                    </style>
                                </head>
                                <body>
                                    <div class="container">
                                        <h1>Project Content</h1>
                                        <pre>${escapedContent}</pre>
                                        <a href="javascript:window.close()" class="back-btn">Close</a>
                                    </div>
                                </body>
                                </html>
                            \`);
                            contentWindow.document.close();
                            window.close();
                        } else {
                            errorMessage.style.display = 'block';
                        }
                    });
                </script>
            </body>
            </html>
        `);
        newWindow.document.close();
    }
    function showPasswordPrompt(fileData, fileType, uploaderPassword) {
        const displayContent = fileData && fileData.trim() !== "" ? fileData : "No document uploaded";

        // Debug: Log the fileData to ensure it's correct
        console.log('File Data in showPasswordPrompt:', displayContent);
        console.log('File Type:', fileType);
        console.log('Uploader Password:', uploaderPassword);

        // Check if the fileData is a valid base64 data URL
        if (!displayContent.startsWith('data:application/pdf;base64,')) {
            docPreview.srcdoc = `
                <html>
                <body style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
                    <p style="color: red;">Error: Invalid file data. Please re-upload the project.</p>
                </body>
                </html>
            `;
            return;
        }

        docPreview.srcdoc = `
            <html>
            <head>
                <title>View Report</title>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js"></script>
                <script>
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
                </script>
                <style>
                    * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        background: #f5f5f5; 
                        padding: 20px; 
                    }
                    .password-prompt {
                        background: #fff;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
                        text-align: center;
                        width: 100%;
                        max-width: 350px;
                    }
                    .password-prompt h3 { 
                        margin-bottom: 15px; 
                        font-size: 18px; 
                        color: #333; 
                        font-weight: bold; 
                    }
                    .password-prompt input {
                        width: 100%;
                        padding: 10px;
                        margin-bottom: 15px;
                        border-radius: 5px;
                        border: 1px solid #ccc;
                        font-size: 14px;
                        text-align: center;
                        outline: none;
                    }
                    .password-prompt input::placeholder { 
                        color: #999; 
                    }
                    .password-prompt button {
                        width: 100%;
                        padding: 10px;
                        background: #ff758c;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: bold;
                        transition: background 0.3s ease;
                    }
                    .password-prompt button:hover { 
                        background: #ff5e62; 
                    }
                    .error-message {
                        color: #ff758c;
                        margin-top: 10px;
                        font-size: 14px;
                        display: none;
                    }
                    .content-display {
                        display: none;
                        width: 100%;
                        height: 100%;
                        overflow: auto;
                    }
                    canvas {
                        width: 100%;
                        border: 1px solid #ccc;
                    }
                </style>
            </head>
            <body>
                <div id="passwordPrompt" class="password-prompt">
                    <h3>Enter Password</h3>
                    <input type="password" id="passwordInput" placeholder="Enter password">
                    <button onclick="verifyPassword()">Submit</button>
                    <p id="errorMessage" class="error-message">❌ Incorrect password!</p>
                </div>
                <div id="contentDisplay" class="content-display">
                    <canvas id="pdfCanvas"></canvas>
                </div>
                <script>
                    async function verifyPassword() {
                        const enteredPassword = document.getElementById('passwordInput').value;
                        const decodedUploaderPassword = atob('${uploaderPassword}');
                        const errorMessage = document.getElementById('errorMessage');
                        const contentDisplay = document.getElementById('contentDisplay');
                        const passwordPrompt = document.getElementById('passwordPrompt');

                        if (enteredPassword === decodedUploaderPassword) {
                            passwordPrompt.style.display = 'none';
                            contentDisplay.style.display = 'block';
                            renderPDF('${displayContent}');
                        } else {
                            errorMessage.style.display = 'block';
                        }
                    }

                    async function renderPDF(base64Data) {
                        try {
                            if (!base64Data || !base64Data.startsWith('data:application/pdf;base64,')) {
                                throw new Error('Invalid base64 data URL');
                            }

                            const base64String = base64Data.split(',')[1];
                            if (!base64String) {
                                throw new Error('Base64 string is empty after splitting');
                            }

                            const binaryString = atob(base64String);
                            const len = binaryString.length;
                            const bytes = new Uint8Array(len);
                            for (let i = 0; i < len; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }

                            const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
                            const canvas = document.getElementById('pdfCanvas');
                            const context = canvas.getContext('2d');

                            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                                const page = await pdf.getPage(pageNum);
                                const viewport = page.getViewport({ scale: 1.0 });

                                const pageCanvas = document.createElement('canvas');
                                pageCanvas.width = viewport.width;
                                pageCanvas.height = viewport.height;
                                pageCanvas.style.border = '1px solid #ccc';
                                pageCanvas.style.marginBottom = '10px';
                                document.getElementById('contentDisplay').appendChild(pageCanvas);

                                const pageContext = pageCanvas.getContext('2d');
                                const renderContext = {
                                    canvasContext: pageContext,
                                    viewport: viewport
                                };
                                await page.render(renderContext).promise;
                            }

                            canvas.remove();
                        } catch (error) {
                            console.error('Error rendering PDF:', error);
                            document.getElementById('contentDisplay').innerHTML = '<p>Error loading PDF: ' + error.message + '</p>';
                        }
                    }
                </script>
            </body>
            </html>
        `;
    }

    function encryptTitle(title, method) {
        console.log(`Encrypting title "${title}" with method: ${method}`);
        let encryptedTitle;
        switch (method) {
            case "aes":
                encryptedTitle = CryptoJS.AES.encrypt(title, "secret_key").toString();
                break;
            case "triple_des":
                encryptedTitle = CryptoJS.TripleDES.encrypt(title, "secret_key").toString();
                break;
            case "rc4":
                encryptedTitle = CryptoJS.RC4.encrypt(title, "secret_key").toString();
                break;
            case "sha256":
                encryptedTitle = CryptoJS.SHA256(title).toString();
                break;
            case "base64":
                encryptedTitle = btoa(title);
                break;
            default:
                encryptedTitle = title;
                console.warn(`Unknown encryption method: ${method}. Using plain text as fallback.`);
        }
        console.log(`Encrypted title: ${encryptedTitle}`);
        return encryptedTitle;
    }

    async function addProject(encryptionMethod) {
        if (!loggedInUser) {
            alert("⚠ You must be logged in to upload a project.");
            return;
        }

        const file = fileInput.files[0];
        if (!file) {
            alert("⚠ Please select a file before choosing an encryption method!");
            return;
        }

        const user = await getUser(loggedInUser);
        if (!user?.password) {
            alert("⚠ Something went wrong. Please log in again.");
            return;
        }

        try {
            // Read the file as a base64 string
            const base64Promise = new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error("Failed to read file as base64"));
                reader.readAsDataURL(file);
            });

            // Read the file as an ArrayBuffer for content extraction
            const arrayBufferPromise = new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(new Error("Failed to read file as ArrayBuffer"));
                reader.readAsArrayBuffer(file);
            });

            // Wait for both promises to resolve
            const [fileBase64, arrayBuffer] = await Promise.all([base64Promise, arrayBufferPromise]);

            console.log('File Base64 in addProject:', fileBase64.substring(0, 50) + '...'); // Debug log

            const encryptedTitle = encryptTitle(file.name, encryptionMethod);
            const projectID = await generateProjectID(loggedInUser);
            let fullContent = "";
            if (file.type === "application/pdf") {
                fullContent = await extractPdfContent(arrayBuffer);
            } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                fullContent = await extractDocxContent(arrayBuffer);
            } else {
                alert("⚠ Unsupported file type. Please upload a PDF or DOCX file.");
                return;
            }

            const newProject = {
                projectID: projectID,
                date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
                uploader: loggedInUser,
                encryptedName: encryptedTitle,
                password: user.password,
                file: fileBase64,
                fullContent: fullContent,
                encryptionMethod: encryptionMethod,
                fileType: file.type
            };

            await saveProject(newProject);
            renderProjects();
            alert("✅ Project added successfully!");
        } catch (error) {
            console.error("Error adding project:", error);
            alert("❌ Failed to add project: " + error.message);
        }
    }

    async function extractPdfContent(data) {
        try {
            const pdfData = new Uint8Array(data);
            const loadingTask = pdfjsLib.getDocument({ data: pdfData });
            const pdf = await loadingTask.promise;
            let content = [];

            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join("\n");
                content.push(`--- Page ${pageNum} ---\n${pageText}`);
            }
            return content.join("\n\n");
        } catch (error) {
            console.error("Error extracting PDF content:", error);
            throw new Error("Failed to extract PDF content");
        }
    }

    async function extractDocxContent(data) {
        try {
            const arrayBuffer = data;
            const result = await mammoth.extractRawText({ arrayBuffer });
            return result.value;
        } catch (error) {
            console.error("Error extracting DOCX content:", error);
            throw new Error("Failed to extract DOCX content");
        }
    }

    function updateProjectCount(count) {
        projectCount.innerHTML = `${count} active projects`;
    }

    dropdownBtn.addEventListener("click", () => {
        dropdownMenu.classList.toggle("active");
    });

    dropdownMenu.querySelectorAll("li").forEach(item => {
        item.addEventListener("click", function () {
            const selectedMethod = this.getAttribute("data-value");
            encryptionMethodInput.value = selectedMethod;
            dropdownBtn.innerHTML = `🔒 Selected: ${this.innerText} ▼`;
            dropdownMenu.classList.remove("active");

            if (!fileInput.files[0]) {
                alert("⚠ Please select a file before encrypting!");
                return;
            }
            addProject(selectedMethod);
        });
    });

    document.addEventListener("click", function (e) {
        if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove("active");
        }
    });

    closePreviewBtn.addEventListener("click", function () {
        docPreview.srcdoc = "";
    });
});