// ==========================================
// DRINKS & CONNECTIONS
// Main JavaScript - Supabase
// ==========================================

// 1. SUPABASE CONNECTION
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


// ==========================================
// 2. HELPER FUNCTIONS
// ==========================================

function el(id) {
    return document.getElementById(id);
}

function setMessage(message, type = "info") {
    const box = el("message");
    if (!box) return;

    box.textContent = message;
    box.className = type;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function getInitials(name) {
    return String(name || "Member")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0].toUpperCase())
        .join("");
}

function showDashboard(show) {
    if (el("authSection")) {
        el("authSection").style.display = show ? "none" : "block";
    }

    if (el("dashboard")) {
        el("dashboard").style.display = show ? "block" : "none";
    }
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


// ==========================================
// 3. AUTHENTICATION
// ==========================================

async function registerUser(event) {
    event.preventDefault();

    const name = el("registerName")?.value.trim();
    const dob = el("registerDob")?.value;
    const email = el("registerEmail")?.value.trim();
    const password = el("registerPassword")?.value;
    const ageConfirmed = el("ageConfirm")?.checked;

    if (!name || !dob || !email || !password) {
        return setMessage("Please complete all registration fields.", "error");
    }

    if (!ageConfirmed) {
        return setMessage("You must confirm that you are 18 or older.", "error");
    }

    const birthDate = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const birthdayNotReached =
        today.getMonth() < birthDate.getMonth() ||
        (
            today.getMonth() === birthDate.getMonth() &&
            today.getDate() < birthDate.getDate()
        );

    if (birthdayNotReached) age--;

    if (age < 18) {
        return setMessage("You must be at least 18 to join.", "error");
    }

    if (password.length < 6) {
        return setMessage("Your password must be at least 6 characters.", "error");
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

        if (data.user) {
            const { error: profileError } = await db
                .from("profiles")
                .upsert({
                    id: data.user.id,
                    display_name: name,
                    bio: "",
                    city: "",
                    gender: "",
                    location_sharing_enabled: false
                });

            if (profileError) {
                console.error(profileError);
                return setMessage(
                    "Your account was created, but your profile needs attention: " +
                    profileError.message,
                    "error"
                );
            }
        }

        if (!data.session) {
            setMessage(
                "Account created! Please check your email to confirm your account before logging in.",
                "success"
            );
        } else {
            setMessage("Welcome to Drinks & Connections!", "success");
        }

    } catch (error) {
        console.error(error);
        setMessage(error.message, "error");
    }
}


async function loginUser(event) {
    event.preventDefault();

    const email = el("loginEmail")?.value.trim();
    const password = el("loginPassword")?.value;

    if (!email || !password) {
        return setMessage("Enter your email and password.", "error");
    }

    setMessage("Logging in...");

    try {
        const { error } = await db.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        await loadDashboard();

    } catch (error) {
        console.error(error);
        setMessage(error.message, "error");
    }
}


async function logoutUser() {
    const { error } = await db.auth.signOut();

    if (error) {
        return setMessage(error.message, "error");
    }

    currentUser = null;
    currentProfile = null;
    allMembers = [];
    nearbyMembers = [];
    activeChatUser = null;

    showDashboard(false);
    setMessage("You have logged out.");
}


// ==========================================
// 4. LOAD USER DASHBOARD
// ==========================================

async function loadDashboard() {
    const { data: userData, error: userError } =
        await db.auth.getUser();

    if (userError || !userData.user) {
        currentUser = null;
        showDashboard(false);
        return;
    }

    currentUser = userData.user;

    const { data: profile, error } = await db
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (error) {
        console.error(error);
        setMessage("Could not load your profile: " + error.message, "error");
        return;
    }

    currentProfile = profile;

    if (!currentProfile) {
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

        if (createError) {
            console.error(createError);
            setMessage(createError.message, "error");
            return;
        }

        currentProfile = newProfile;
    }

    showDashboard(true);

    if (el("profileEmail")) {
        el("profileEmail").textContent = currentUser.email;
    }

    loadProfileForm();
    await loadMembers();
    await loadConnections();

    setMessage("Welcome back!", "success");
}


// ==========================================
// 5. PROFILE
// ==========================================

function loadProfileForm() {
    if (!currentProfile) return;

    if (el("displayName")) {
        el("displayName").value =
            currentProfile.display_name || "";
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

    const photo = currentProfile.avatar_url;

    if (photo) {
        if (el("profilePhotoPreview")) {
            el("profilePhotoPreview").src = photo;
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

        setMessage("Your profile has been updated!", "success");

    } catch (error) {
        console.error(error);
        setMessage("Profile update failed: " + error.message, "error");
    }
}


// ==========================================
// 6. PROFILE PHOTO UPLOAD
// ==========================================

async function uploadProfilePhoto() {
    if (!currentUser) {
        return setMessage("Please log in first.", "error");
    }

    const file = el("profilePhotoInput")?.files?.[0];

    if (!file) {
        return setMessage("Please choose a photo first.", "error");
    }

    if (!file.type.startsWith("image/")) {
        return setMessage("Please select an image file.", "error");
    }

    if (file.size > 5 * 1024 * 1024) {
        return setMessage("Your photo must be smaller than 5 MB.", "error");
    }

    const extension = file.name.split(".").pop().toLowerCase();
    const filePath = `${currentUser.id}/${Date.now()}.${extension}`;

    try {
        if (el("photoMessage")) {
            el("photoMessage").textContent = "Uploading photo...";
        }

        const { error: uploadError } = await db.storage
            .from(PHOTO_BUCKET)
            .upload(filePath, file, {
                upsert: true,
                contentType: file.type
            });

        if (uploadError) throw uploadError;

        const { data: urlData } = db.storage
            .from(PHOTO_BUCKET)
            .getPublicUrl(filePath);

        const photoURL = urlData.publicUrl;

        const { error: updateError } = await db
            .from("profiles")
            .update({
                avatar_url: photoURL,
                avatar_path: filePath
            })
            .eq("id", currentUser.id);

        if (updateError) throw updateError;

        currentProfile.avatar_url = photoURL;
        currentProfile.avatar_path = filePath;

        if (el("profilePhotoPreview")) {
            el("profilePhotoPreview").src = photoURL;
            el("profilePhotoPreview").style.display = "block";
        }

        if (el("profilePhotoPlaceholder")) {
            el("profilePhotoPlaceholder").style.display = "none";
        }

        if (el("photoMessage")) {
            el("photoMessage").textContent = "Photo uploaded successfully!";
        }

        await loadMembers();

    } catch (error) {
        console.error(error);

        if (el("photoMessage")) {
            el("photoMessage").textContent = error.message;
        }
    }
}


// ==========================================
// 7. MEMBER CARDS
// ==========================================

function createMemberCard(member, showDistance = false) {
    const card = document.createElement("div");
    card.className = "member-card";

    const name = escapeHTML(member.display_name || "Member");
    const bio = escapeHTML(member.bio || "No bio available yet.");
    const city = escapeHTML(member.city || "Location not provided");
    const gender = escapeHTML(member.gender || "");
    const photo = member.avatar_url;

    const avatar = photo
        ? `<img src="${escapeHTML(photo)}" alt="${name}" class="member-avatar">`
        : `<div class="member-avatar-placeholder">${escapeHTML(getInitials(member.display_name))}</div>`;

    const distance = showDistance && Number.isFinite(Number(member.distance_km))
        ? `<p class="member-distance">📍 Approximately ${Number(member.distance_km).toFixed(1)} km away</p>`
        : "";

    card.innerHTML = `
        <div class="member-photo">${avatar}</div>
        <div class="member-details">
            <h3>${name}</h3>
            <p>${city}</p>
            <p>${gender}</p>
            <p>${bio}</p>
            ${distance}
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


// ==========================================
// 8. DISCOVER MEMBERS
// ==========================================

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
        console.error(error);
        setMessage("Could not load members: " + error.message, "error");
    }
}


function displayMembers(members) {
    const container = el("memberResults");
    if (!container) return;

    container.innerHTML = "";

    if (!members.length) {
        container.textContent = "No members found.";
        return;
    }

    members.forEach(member => {
        container.appendChild(createMemberCard(member));
    });
}


async function searchMembers() {
    if (!currentUser) return;

    const search = el("memberSearch")?.value.trim().toLowerCase() || "";
    const gender = el("genderFilter")?.value || "";

    const filtered = allMembers.filter(member => {
        const text = [
            member.display_name,
            member.city,
            member.bio
        ].join(" ").toLowerCase();

        const matchesSearch = !search || text.includes(search);
        const matchesGender = !gender || member.gender === gender;

        return matchesSearch && matchesGender;
    });

    displayMembers(filtered);
}


// ==========================================
// 9. CONNECTIONS / LIKES
// ==========================================

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
            .select("id")
            .eq("user_id", memberId)
            .eq("liked_user_id", currentUser.id)
            .maybeSingle();

        if (checkError) throw checkError;

        if (reverseLike) {
            setMessage("It's a match! You are now connected ❤️", "success");
            await loadConnections();
        } else {
            setMessage("Connection request sent!", "success");
        }

    } catch (error) {
        console.error(error);
        setMessage("Could not send connection: " + error.message, "error");
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
            if (container) container.textContent = "No mutual connections yet.";
            if (contacts) contacts.textContent = "Your connections will appear here.";
            return;
        }

        const { data: profiles, error: profileError } = await db
            .from("profiles")
            .select("id, display_name, bio, gender, city, avatar_url")
            .in("id", mutualIds);

        if (profileError) throw profileError;

        profiles.forEach(member => {
            if (container) {
                container.appendChild(createMemberCard(member));
            }

            if (contacts) {
                const contact = document.createElement("button");
                contact.type = "button";
                contact.className = "chat-contact";
                contact.textContent = member.display_name || "Member";
                contact.addEventListener("click", () => openConversation(member));
                contacts.appendChild(contact);
            }
        });

    } catch (error) {
        console.error(error);
        setMessage("Could not load connections: " + error.message, "error");
    }
}


// ==========================================
// 10. PRIVATE MESSAGING
// ==========================================

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
        console.error(error);
        setMessage("Could not load messages: " + error.message, "error");
    }
}


async function sendMessage(event) {
    event.preventDefault();

    if (!currentUser || !activeChatUser) {
        return setMessage("Open a conversation first.", "error");
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
        console.error(error);
        setMessage("Message could not be sent: " + error.message, "error");
    }
}


// ==========================================
// 11. GPS - FIND PEOPLE NEAR ME
// ==========================================

function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Your browser does not support GPS."));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            position => resolve(position),
            error => reject(error),
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            }
        );
    });
}


async function findNearbyMembers() {
    if (!currentUser) {
        return setGpsStatus("Please log in first.");
    }

    if (!navigator.geolocation) {
        return setGpsStatus("GPS is not supported by this browser.");
    }

    const button = el("findNearbyButton");

    if (button) button.disabled = true;

    showGpsScanner(true);
    setGpsStatus("Searching for your location...");

    try {
        // Only obtains location after the member clicks the button.
        const position = await getUserLocation();

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        setGpsStatus("Location found. Finding nearby members...");

        // Save location only to the signed-in member's own profile.
        const { error: updateError } = await db
            .from("profiles")
            .update({
                latitude,
                longitude,
                location_sharing_enabled: true,
                location_updated_at: new Date().toISOString()
            })
            .eq("id", currentUser.id);

        if (updateError) throw updateError;

        const maxDistance = Number(el("distanceFilter")?.value || 25);

        const { data, error } = await db.rpc(
            "find_nearby_members",
            {
                search_lat: latitude,
                search_lon: longitude,
                max_distance_km: maxDistance
            }
        );

        if (error) throw error;

        nearbyMembers = (data || []).map(member => ({
            ...member,
            id: member.member_id
        }));

        displayNearbyMembers();

        if (!nearbyMembers.length) {
            setGpsStatus("No nearby members found. Try a larger distance.");
        } else {
            setGpsStatus(
                `${nearbyMembers.length} nearby member(s) found!`
            );
        }

    } catch (error) {
        console.error(error);

        let message = error.message || "Could not search for nearby members.";

        if (error.code === 1) {
            message = "Location permission was denied. Please allow location access in your browser.";
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
        container.textContent = "No nearby members to display.";
        return;
    }

    nearbyMembers.forEach(member => {
        container.appendChild(createMemberCard(member, true));
    });
}


// ==========================================
// 12. DISABLE LOCATION SHARING
// ==========================================

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
            el("nearbyResults").innerHTML =
                "Location sharing has been disabled.";
        }

        setGpsStatus("Your location is no longer being shared.");

    } catch (error) {
        console.error(error);
        setGpsStatus("Could not disable location sharing: " + error.message);
    }
}


// ==========================================
// 13. BUTTONS AND EVENT LISTENERS
// ==========================================

function addListener(id, event, callback) {
    const element = el(id);

    if (element) {
        element.addEventListener(event, callback);
    }
}

function setupApp() {

    // Authentication
    addListener("registerForm", "submit", registerUser);
    addListener("loginForm", "submit", loginUser);
    addListener("logoutButton", "click", logoutUser);

    // Profile
    addListener("profileForm", "submit", saveProfile);
    addListener("uploadPhotoButton", "click", uploadProfilePhoto);

    // Member search
    addListener("searchMembers", "click", searchMembers);

    addListener("memberSearch", "input", searchMembers);
    addListener("genderFilter", "change", searchMembers);

    // Messaging
    addListener("messageForm", "submit", sendMessage);
    addListener("refreshChat", "click", loadMessages);

    addListener("closeChat", "click", () => {
        if (el("chatWindow")) {
            el("chatWindow").style.display = "none";
        }

        activeChatUser = null;
    });

    // GPS
    addListener("findNearbyButton", "click", findNearbyMembers);
    addListener("disableLocationButton", "click", disableLocationSharing);

    // Restore login session
    db.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
            setTimeout(() => loadDashboard(), 0);
        } else {
            currentUser = null;
            currentProfile = null;
            showDashboard(false);
        }
    });
}


// ==========================================
// 14. START APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    setupApp();

    const { data } = await db.auth.getSession();

    if (data.session?.user) {
        await loadDashboard();
    } else {
        showDashboard(false);
    }
});