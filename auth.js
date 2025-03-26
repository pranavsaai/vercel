document.addEventListener("DOMContentLoaded", function () {
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
        setupEventListeners();
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains("users")) {
            db.createObjectStore("users", { keyPath: "username" });
        }
        if (!db.objectStoreNames.contains("projects")) {
            db.createObjectStore("projects", { keyPath: "projectID" });
        }
    };

    // Helper functions for IndexedDB
    function getUser(username) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["users"], "readonly");
            const store = transaction.objectStore("users");
            const request = store.get(username);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function saveUser(user) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["users"], "readwrite");
            const store = transaction.objectStore("users");
            const request = store.put(user);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    function setupEventListeners() {
        // Login
        if (document.getElementById("loginForm")) {
            document.getElementById("loginForm").addEventListener("submit", async function (event) {
                event.preventDefault();
                const username = document.getElementById("username").value.trim();
                const password = document.getElementById("password").value;

                try {
                    const user = await getUser(username);
                    if (user && user.password === btoa(password)) {
                        localStorage.setItem("loggedInUser", username);
                        window.location.href = "index.html"; // Matches your original redirect
                    } else {
                        const loginError = document.getElementById("loginError");
                        if (loginError) {
                            loginError.textContent = "Invalid username or password.";
                        } else {
                            alert("Invalid username or password.");
                        }
                    }
                } catch (error) {
                    console.error("Login error:", error);
                    alert("An error occurred during login.");
                }
            });
        }

        // Registration
        if (document.getElementById("registerForm")) {
            document.getElementById("registerForm").addEventListener("submit", async function (event) {
                event.preventDefault();
                const regUsername = document.getElementById("regUsername").value.trim();
                const regPassword = document.getElementById("regPassword").value;
                const confirmPassword = document.getElementById("confirmPassword").value;

                try {
                    const existingUser = await getUser(regUsername);
                    if (existingUser) {
                        const registerError = document.getElementById("registerError");
                        if (registerError) {
                            registerError.textContent = "Username already exists.";
                        } else {
                            alert("Username already exists.");
                        }
                        return;
                    }

                    if (regPassword !== confirmPassword) {
                        const registerError = document.getElementById("registerError");
                        if (registerError) {
                            registerError.textContent = "Passwords do not match.";
                        } else {
                            alert("Passwords do not match.");
                        }
                        return;
                    }

                    const newUser = { username: regUsername, password: btoa(regPassword) };
                    await saveUser(newUser);
                    alert("Registration successful! Redirecting to login.");
                    window.location.href = "login.html";
                } catch (error) {
                    console.error("Registration error:", error);
                    alert("An error occurred during registration.");
                }
            });
        }

        // Reset Password
        if (document.getElementById("resetPasswordForm")) {
            document.getElementById("resetPasswordForm").addEventListener("submit", async function (event) {
                event.preventDefault();
                const resetUsername = document.getElementById("resetUsername").value.trim();
                const newPassword = document.getElementById("newPassword").value;
                const confirmNewPassword = document.getElementById("confirmNewPassword").value;

                try {
                    const user = await getUser(resetUsername);
                    if (!user) {
                        const resetError = document.getElementById("resetError");
                        if (resetError) {
                            resetError.textContent = "Username not found.";
                        } else {
                            alert("Username not found.");
                        }
                        return;
                    }

                    if (newPassword !== confirmNewPassword) {
                        const resetError = document.getElementById("resetError");
                        if (resetError) {
                            resetError.textContent = "Passwords do not match.";
                        } else {
                            alert("Passwords do not match.");
                        }
                        return;
                    }

                    user.password = btoa(newPassword);
                    await saveUser(user);
                    alert("Password reset successful! Redirecting to login.");
                    window.location.href = "login.html";
                } catch (error) {
                    console.error("Reset password error:", error);
                    alert("An error occurred during password reset.");
                }
            });
        }
    }
});
