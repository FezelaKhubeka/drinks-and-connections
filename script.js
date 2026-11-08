
// ============================================
// DRINKS & CONNECTIONS
// Complete application JavaScript
// ============================================

// 1. SUPABASE CONFIGURATION

const SUPABASE_URL = "https://xnmvqjbquibqcjryxpge.supabase.co";

const SUPABASE_KEY = "sb_publishable_7YtYRhqp0walmpQX22pYCg_kdt45GEf";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const PHOTO_BUCKET = "profile-photos";

let currentUser = null;
let currentProfile = null;
let allMembers = [];
let nearbyMembers = [];
let activeChatUser = null;
let dashboardLoading = false;


// ============================================
// 2. HELPER FUNCTIONS
// ============================================

function el(id) {
    return document.getElementById(id);
}

function setMessage(message, type = "info") {
    const box = el("message");
    if (!box) return;

    box.textContent = message;
    box.dataset.type = type;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getInitials(name) {
    return String(name || "Member")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("");
}

function addListener(id, event, callback) {
    const element = el(id);
    if (element) {
        element.addEventListener(event, callback);
    }
}


// ============================================
// 3. DASHBOARD VISIBILITY - IMPORTANT FIX
// ============================================

function showDashboard(show) {
    const auth = el("authSection");
    const dashboard = el("dashboard");

    if (auth) {
        auth.hidden = show;
        auth.style.display = show ? "none" : "";
    }

    if (dashboard) {
        dashboard.hidden = !show;
        dashboard.style.display = show ? "block" : "none";
    }
}


// ============================================
// 4. REGISTRATION
// ============================================

async function registerUser(event) {
    event.preventDefault();

    const name = el("registerName")?.value.trim();
    const dob = el("registerDob")?.value;
    const email = el("registerEmail")?.value.trim();
    const password = el("registerPassword")?.value;
    const ageConfirmed = el("ageConfirm")?.checked;

    if (!name || !dob || !email || !password) {
        return setMessage("Please complete all fields.", "error");
    }

    if (!ageConfirmed) {
        return setMessage("Please confirm that you are 18 or older.", "error");
    }

    const birthDate = new Date(dob + "T00:00:00");
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    if (
        today.getMonth() < birthDate.getMonth() ||
        (
            today.getMonth() === birthDate.getMonth() &&
            today.getDate() < birthDate.getDate()
        )
    ) {
        age--;
    }

    if (age < 18) {
        return setMessage("You must be at least 18 to join.", "error");
    }

    if (password.length < 6) {
        return setMessage("Password must be at least 6 characters.", "error");
    }

    setMessage("Creating your account...");

    try {
        const { data, error } = await db.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: name,
                    date_of_birth: dob
                }
            }
        });

        if (error) throw error;

        if (data.session && data.user) {
            const { error: profileError } = await db
                .from("profiles")
                .upsert({
                    id: data.user.id,
                    display_name: name,
                    location_sharing_enabled: false
                });

            if (profileError) throw profileError;

            await loadDashboard();
        } else {
            setMessage(
                "Account created! Check your email to confirm your account, then log in.",
                "success"
            );
        }

    } catch (error) {
        console.error("Registration error:", error);
        setMessage(error.message, "error");
    }
}


// ============================================
// 5. LOGIN
// ============================================

async function loginUser(event) {
    event.preventDefault();

    const email = el("loginEmail")?.value.trim();
    const password = el("loginPassword")?.value;

    if (!email || !password) {
        return setMessage("Enter your email and password.", "error");
    }

    setMessage("Logging in...");

    try {
        const { data, error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentUser = data.user;

        await loadDashboard();

    } catch (error) {
        console.error("Login error:", error);
        setMessage(error.message, "error");
    }
}


// ============================================
// 6. LOAD DASHBOARD
// ============================================

async function loadDashboard() {
    if (dashboardLoading) return;

    dashboardLoading = true;
    setMessage("Loading your account...");

    try {
        const { data, error } = await db.auth.getUser();

        if (error) throw error;

        if (!data.user) {
            currentUser = null;
            showDashboard(false);
            setMessage("Please log in.");
            return;
        }

        currentUser = data.user;

        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
            const { data: newProfile, error: createError } = await db
                .from("profiles")
                .insert({
                    id: currentUser.id,
                    display_name:
                        currentUser.user_metadata?.display_name || "New Member",
                    location_sharing_enabled: false
                })
                .select()
                .single();

            if (createError) throw createError;

            currentProfile = newProfile;
        } else {
            currentProfile = profile;
        }

        // Reveal dashboard only after account data has loaded.
        showDashboard(true);

        if (el("profileEmail")) {
            el("profileEmail").textContent = currentUser.email || "";
        }

        loadProfileForm();

        await loadMembers();
        await loadConnections();

        setMessage(
            "Welcome back, " +
            (currentProfile.display_name || "Member") + "!",
            "success"
        );

    } catch (error) {
        console.error("Dashboard error:", error);

        showDashboard(false);

        setMessage(
            "We recognised your account, but could not load your dashboard: " +
            error.message,
            "error"
        );

    } finally {
        dashboardLoading = false;
    }
}


// ============================================
// 7. PROFILE
// ============================================

function loadProfileForm() {
    if (!currentProfile) return;

    if (el("displayName")) {
        el("displayName").value = currentProfile.display_name || "";
    }

    if (el("bio")) {
        el("bio").value = currentProfile.bio || "";
    }

    if (el("gender")) {
        el("gender").value = currentProfile.gender || "";
    }

    if (el("city")) {
        el("city").value = currentProfile.city || "";
    }

    if (currentProfile.avatar_url) {
        if (el("profilePhotoPreview")) {
            el("profilePhotoPreview").src = currentProfile.avatar_url;
            el("profilePhotoPreview").style.display = "block";
        }

        if (el("profilePhotoPlaceholder")) {
            el("profilePhotoPlaceholder").style.display = "none";
        }
    }
}


async function saveProfile(event) {
    event.preventDefault();

    if (!currentUser) return;

    const updates = {
        id: currentUser.id,
        display_name: el("displayName")?.value.trim() || "",
        bio: el("bio")?.value.trim() || "",
        gender: el("gender")?.value || "",
        city: el("city")?.value.trim() || ""
    };

    try {
        const { data, error } = await db
            .from("profiles")
            .upsert(updates)
            .select()
            .single();

        if (error) throw error;

        currentProfile = {
            ...currentProfile,
            ...data
        };

        setMessage("Your profile has been saved!", "success");

        await loadMembers();

    } catch (error) {
        console.error("Profile error:", error);
        setMessage("Profile could not be saved: " + error.message, "error");
    }
}


// ============================================
// 8. PROFILE PHOTO UPLOAD
// ============================================

async function uploadProfilePhoto() {
    if (!currentUser) {
        return setMessage("Please log in first.", "error");
    }

    const file = el("profilePhotoInput")?.files?.[0];

    if (!file) {
        return setMessage("Choose a photo first.", "error");
    }

    if (!file.type.startsWith("image/")) {
        return setMessage("Please select an image.", "error");
    }

    if (file.size > 5 * 1024 * 1024) {
        return setMessage("Photo must be smaller than 5 MB.", "error");
    }

    const extension = file.name.split(".").pop().toLowerCase();
    const path = `${currentUser.id}/${Date.now()}.${extension}`;

    try {
        if (el("photoMessage")) {
            el("photoMessage").textContent = "Uploading photo...";
        }

        const { error: uploadError } = await db.storage
            .from(PHOTO_BUCKET)
            .upload(path, file, {
                upsert: true,
                contentType: file.type
            });

        if (uploadError) throw uploadError;

        const { data: urlData } = db.storage
            .from(PHOTO_BUCKET)
            .getPublicUrl(path);

        const photoURL = urlData.publicUrl;

        const { error: updateError } = await db
            .from("profiles")
            .update({
                avatar_url: photoURL,
                avatar_path: path
            })
            .eq("id", currentUser.id);

        if (updateError) throw updateError;

        currentProfile.avatar_url = photoURL;
        currentProfile.avatar_path = path;

        el("profilePhotoPreview").src = photoURL;
        el("profilePhotoPreview").style.display = "block";

        el("profilePhotoPlaceholder").style.display = "none";

        el("photoMessage").textContent = "Photo uploaded successfully!";

        await loadMembers();

    } catch (error) {
        console.error("Photo upload error:", error);

        if (el("photoMessage")) {
            el("photoMessage").textContent = error.message;
        }
    }
}


// ============================================
// 9. MEMBER CARDS
// ============================================

function createMemberCard(member, showDistance = false) {
    const card = document.createElement("article");
    card.className = "member-card";

    const name = escapeHTML(member.display_name || "Member");
    const city = escapeHTML(member.city || "City not provided");
    const bio = escapeHTML(member.bio || "No bio added yet.");
    const gender = escapeHTML(member.gender || "");

    const avatar = member.avatar_url
        ? `<img class="member-avatar" src="${escapeHTML(member.avatar_url)}" alt="${name}">`
        : `<div class="member-avatar-placeholder">${escapeHTML(getInitials(member.display_name))}</div>`;

    let distanceHTML = "";

    if (
        showDistance &&
        Number.isFinite(Number(member.distance_km))
    ) {
        distanceHTML =
            `<p class="member-distance">📍 Approximately ${Number(member.distance_km).toFixed(1)} km away</p>`;
    }

    card.innerHTML = `
        <div>${avatar}</div>
        <div class="member-details">
            <h3>${name}</h3>
            <p>${city}</p>
            <p>${gender}</p>
            <p>${bio}</p>
            ${distanceHTML}
            <button type="button" class="like-member">❤️ Connect</button>
            <button type="button" class="message-member">💬 Message</button>
        </div>
    `;

    card.querySelector(".like-member").addEventListener("click", () => {
        likeMember(member.id);
    });

    card.querySelector(".message-member").addEventListener("click", () => {
        openConversation(member);
    });

    return card;
}


// ============================================
// 10. DISCOVER MEMBERS
// ============================================

async function loadMembers() {
    if (!currentUser) return;

    try {
        const { data, error } = await db
            .from("profiles")
            .select("id, display_name, bio, gender, city, avatar_url")
            .neq("id", currentUser.id)
            .order("display_name");

        if (error) throw error;

        allMembers = data || [];

        displayMembers(allMembers);

    } catch (error) {
        console.error("Members error:", error);
        setMessage("Could not load members: " + error.message, "error");
    }
}


function displayMembers(members) {
    const container = el("memberResults");
    if (!container) return;

    container.innerHTML = "";

    if (!members.length) {
        container.textContent = "No members found yet.";
        return;
    }

    members.forEach(member => {
        container.appendChild(createMemberCard(member));
    });
}


function searchMembers() {
    const search =
        el("memberSearch")?.value.trim().toLowerCase() || "";

    const gender = el("genderFilter")?.value || "";

    const filtered = allMembers.filter(member => {
        const searchable = [
            member.display_name,
            member.city,
            member.bio
        ].join(" ").toLowerCase();

        return (
            (!search || searchable.includes(search)) &&
            (!gender || member.gender === gender)
        );
    });

    displayMembers(filtered);
}


// ============================================
// 11. CONNECTIONS
// ============================================

async function likeMember(memberId) {
    if (!currentUser || memberId === currentUser.id) return;

    try {
        const { error } = await db
            .from("connections")
            .upsert(
                {
                    user_id: currentUser.id,
                    liked_user_id: memberId
                },
                {
                    onConflict: "user_id,liked_user_id",
                    ignoreDuplicates: true
                }
            );

        if (error) throw error;

        const { data: reverseLike, error: checkError } = await db
            .from("connections")
            .select("user_id")
            .eq("user_id", memberId)
            .eq("liked_user_id", currentUser.id)
            .maybeSingle();

        if (checkError) throw checkError;

        if (reverseLike) {
            setMessage("It's a match! You are now connected! ❤️", "success");
            await loadConnections();
        } else {
            setMessage("Connection request sent!", "success");
        }

    } catch (error) {
        console.error("Connection error:", error);
        setMessage("Could not connect: " + error.message, "error");
    }
}


async function loadConnections() {
    if (!currentUser) return;

    try {
        const { data: outgoing, error: outError } = await db
            .from("connections")
            .select("liked_user_id")
            .eq("user_id", currentUser.id);

        if (outError) throw outError;

        const { data: incoming, error: inError } = await db
            .from("connections")
            .select("user_id")
            .eq("liked_user_id", currentUser.id);

        if (inError) throw inError;

        const outgoingIds = new Set(
            (outgoing || []).map(item => item.liked_user_id)
        );

        const mutualIds = (incoming || [])
            .map(item => item.user_id)
            .filter(id => outgoingIds.has(id));

        const container = el("connectionResults");
        const contacts = el("chatContacts");

        if (container) container.innerHTML = "";
        if (contacts) contacts.innerHTML = "";

        if (!mutualIds.length) {
            if (container) {
                container.textContent = "No mutual connections yet.";
            }

            if (contacts) {
                contacts.textContent = "Your chat contacts will appear here.";
            }

            return;
        }

        const { data: profiles, error: profilesError } = await db
            .from("profiles")
            .select("id, display_name, bio, gender, city, avatar_url")
            .in("id", mutualIds);

        if (profilesError) throw profilesError;

        (profiles || []).forEach(member => {
            container?.appendChild(createMemberCard(member));

            if (contacts) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "chat-contact";
                button.textContent = member.display_name || "Member";

                button.addEventListener("click", () => {
                    openConversation(member);
                });

                contacts.appendChild(button);
            }
        });

    } catch (error) {
        console.error("Connections error:", error);
        setMessage("Could not load connections: " + error.message, "error");
    }
}


// ============================================
// 12. PRIVATE CHAT
// ============================================

async function openConversation(member) {
    if (!currentUser || !member?.id) return;

    activeChatUser = member;

    if (el("chatWindow")) {
        el("chatWindow").style.display = "block";
    }

    if (el("chatTitle")) {
        el("chatTitle").textContent =
            "Chat with " + (member.display_name || "Member");
    }

    await loadMessages();

    el("chatWindow")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


async function loadMessages() {
    if (!currentUser || !activeChatUser) return;

    try {
        const { data, error } = await db
            .from("messages")
            .select("*")
            .or(
                `and(sender_id.eq.${currentUser.id},recipient_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},recipient_id.eq.${currentUser.id})`
            )
            .order("created_at", { ascending: true });

        if (error) throw error;

        const container = el("chatMessages");
        if (!container) return;

        container.innerHTML = "";

        (data || []).forEach(message => {
            const bubble = document.createElement("div");

            bubble.className =
                message.sender_id === currentUser.id
                    ? "message sent"
                    : "message received";

            bubble.textContent = message.content;

            container.appendChild(bubble);
        });

        container.scrollTop = container.scrollHeight;

    } catch (error) {
        console.error("Chat error:", error);
        setMessage("Could not load messages: " + error.message, "error");
    }
}


async function sendMessage(event) {
    event.preventDefault();

    if (!currentUser || !activeChatUser) {
        return setMessage("Select a connection before sending a message.", "error");
    }

    const content = el("messageInput")?.value.trim();

    if (!content) return;

    try {
        const { error } = await db
            .from("messages")
            .insert({
                sender_id: currentUser.id,
                recipient_id: activeChatUser.id,
                content
            });

        if (error) throw error;

        el("messageInput").value = "";

        await loadMessages();

    } catch (error) {
        console.error("Send message error:", error);
        setMessage("Message could not be sent: " + error.message, "error");
    }
}


// ============================================
// 13. GPS LOCATION
// ============================================

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("GPS is not supported by this browser."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            reject,
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            }
        );
    });
}


function setGpsStatus(message) {
    if (el("gpsStatus")) {
        el("gpsStatus").textContent = message;
    }
}


function showGpsScanner(show) {
    if (el("gpsScanner")) {
        el("gpsScanner").style.display = show ? "block" : "none";
    }
}


async function findNearbyMembers() {
    if (!currentUser) {
        return setGpsStatus("Please log in first.");
    }

    const button = el("findNearbyButton");

    if (button) button.disabled = true;

    showGpsScanner(true);
    setGpsStatus("Requesting your location...");

    try {
        const position = await getUserLocation();

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setGpsStatus("Location found. Searching nearby...");

        const { error: updateError } = await db
            .from("profiles")
            .update({
                latitude: latitude,
                longitude: longitude,
                location_sharing_enabled: true,
                location_updated_at: new Date().toISOString()
            })
            .eq("id", currentUser.id);

        if (updateError) throw updateError;

        const distance = Number(el("distanceFilter")?.value || 25);

        const { data, error } = await db.rpc(
            "find_nearby_members",
            {
                search_lat: latitude,
                search_lon: longitude,
                max_distance_km: distance
            }
        );

        if (error) throw error;

        nearbyMembers = (data || []).map(member => ({
            ...member,
            id: member.member_id
        }));

        displayNearbyMembers();

        if (nearbyMembers.length === 0) {
            setGpsStatus("No nearby members found. Try a wider search distance.");
        } else {
            setGpsStatus(
                `${nearbyMembers.length} nearby member(s) found!`
            );
        }

    } catch (error) {
        console.error("GPS error:", error);

        let message = error.message || "GPS search failed.";

        if (error.code === 1) {
            message = "Location permission denied. Allow location access in your browser.";
        } else if (error.code === 2) {
            message = "Your location could not be determined. Try again.";
        } else if (error.code === 3) {
            message = "GPS timed out. Please try again.";
        }

        setGpsStatus(message);

    } finally {
        showGpsScanner(false);

        if (button) button.disabled = false;
    }
}


function displayNearbyMembers() {
    const container = el("nearbyResults");
    if (!container) return;

    container.innerHTML = "";

    if (!nearbyMembers.length) {
        container.textContent = "No nearby members found.";
        return;
    }

    nearbyMembers.forEach(member => {
        container.appendChild(createMemberCard(member, true));
    });
}


// ============================================
// 14. TURN OFF LOCATION SHARING
// ============================================

async function disableLocationSharing() {
    if (!currentUser) return;

    try {
        const { error } = await db
            .from("profiles")
            .update({
                latitude: null,
                longitude: null,
                location_sharing_enabled: false,
                location_updated_at: null
            })
            .eq("id", currentUser.id);

        if (error) throw error;

        nearbyMembers = [];

        if (el("nearbyResults")) {
            el("nearbyResults").innerHTML = "";
        }

        setGpsStatus("Location sharing has been turned off.");

    } catch (error) {
        console.error("Location sharing error:", error);
        setGpsStatus("Could not turn off location sharing: " + error.message);
    }
}


// ============================================
// 15. LOGOUT
// ============================================

async function logoutUser() {
    try {
        const { error } = await db.auth.signOut();

        if (error) throw error;

        currentUser = null;
        currentProfile = null;
        allMembers = [];
        nearbyMembers = [];
        activeChatUser = null;

        showDashboard(false);
        setMessage("You have logged out.");

    } catch (error) {
        console.error("Logout error:", error);
        setMessage(error.message, "error");
    }
}


// ============================================
// 16. APPLICATION STARTUP
// ============================================

function setupApp() {
    addListener("registerForm", "submit", registerUser);
    addListener("loginForm", "submit", loginUser);
    addListener("logoutButton", "click", logoutUser);

    addListener("profileForm", "submit", saveProfile);
    addListener("uploadPhotoButton", "click", uploadProfilePhoto);

    addListener("searchMembers", "click", searchMembers);
    addListener("memberSearch", "input", searchMembers);
    addListener("genderFilter", "change", searchMembers);

    addListener("findNearbyButton", "click", findNearbyMembers);
    addListener("disableLocationButton", "click", disableLocationSharing);

    addListener("messageForm", "submit", sendMessage);
    addListener("refreshChat", "click", loadMessages);

    addListener("closeChat", "click", () => {
        if (el("chatWindow")) {
            el("chatWindow").style.display = "none";
        }

        activeChatUser = null;
    });

    // Listen for sign-in and sign-out events.
    db.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
            currentUser = null;
            currentProfile = null;
            showDashboard(false);
        }

        if (event === "SIGNED_IN" && session?.user) {
            currentUser = session.user;

            // Allow the login handler to load the dashboard itself.
            if (!dashboardLoading) {
                setTimeout(() => loadDashboard(), 0);
            }
        }
    });
}


// ============================================
// 17. INITIALISE THE APP
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
    setupApp();

    showDashboard(false);
    setMessage("Checking your account...");

    try {
        const { data, error } = await db.auth.getSession();

        if (error) throw error;

        if (data.session?.user) {
            await loadDashboard();
        } else {
            showDashboard(false);
            setMessage("Welcome to Drinks & Connections!");
        }

    } catch (error) {
        console.error("Startup error:", error);
        showDashboard(false);

        setMessage(
            "Could not start the app: " + error.message,
            "error"
        );
    }
});
