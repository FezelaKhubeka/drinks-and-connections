/* ==========================================
   DRINKS & CONNECTIONS
   COMPLETE WEBSITE JAVASCRIPT
========================================== */

/* SUPABASE CONFIGURATION */

const SUPABASE_URL =
  "https://xnmvqjbquibqcjryxpge.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_7YtYRhqp0walmpQX22pYCg_kdt45GEf";

const PHOTO_BUCKET = "profile-photos";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

/* APPLICATION STATE */

let currentMember = null;
let activeChatUser = null;

let allMembers = [];
let memberLikes = [];
let mutualMembers = [];

/* ==========================================
   GENERAL FUNCTIONS
========================================== */

function el(id) {
  return document.getElementById(id);
}

function showMessage(message, type = "success") {
  const box = el("message");

  box.textContent = message;
  box.className = "message show " + type;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function setPhotoMessage(message, color = "") {
  const box = el("photoMessage");
  box.textContent = message;

  if (color) {
    box.style.color = color;
  }
}

function calculateAge(dateString) {
  const birth = new Date(dateString + "T00:00:00");
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();

  if (
    today.getMonth() < birth.getMonth() ||
    (
      today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate()
    )
  ) {
    age--;
  }

  return age;
}

function setButtonLoading(button, loading, originalText) {
  button.disabled = loading;
  button.textContent = loading ? "Please wait..." : originalText;
}

/* ==========================================
   REGISTRATION
========================================== */

el("registerForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = event.submitter;

  const name = el("registerName").value.trim();
  const dob = el("registerDob").value;
  const email = el("registerEmail").value.trim();
  const password = el("registerPassword").value;

  if (!name || !dob || !email || !password) {
    showMessage("Please complete all fields.", "error");
    return;
  }

  if (!el("ageConfirm").checked) {
    showMessage("Please confirm that you are 18 or older.", "error");
    return;
  }

  if (new Date(dob) > new Date()) {
    showMessage("Please enter a valid date of birth.", "error");
    return;
  }

  if (calculateAge(dob) < 18) {
    showMessage("You must be at least 18 years old.", "error");
    return;
  }

  if (password.length < 8) {
    showMessage("Password must be at least 8 characters.", "error");
    return;
  }

  setButtonLoading(button, true, "Create Account");

  try {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          birth_date: dob
        }
      }
    });

    if (error) throw error;

    el("registerForm").reset();

    if (data.session && data.user) {
      await loadDashboard(data.user);
      showMessage("Welcome to Drinks & Connections! 🥂");
    } else {
      showMessage(
        "Your account has been created. Please check your email to verify your account."
      );
    }

  } catch (error) {
    showMessage("Registration failed: " + error.message, "error");
  } finally {
    setButtonLoading(button, false, "Create Account");
  }
});

/* ==========================================
   LOGIN
========================================== */

el("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = event.submitter;

  const email = el("loginEmail").value.trim();
  const password = el("loginPassword").value;

  setButtonLoading(button, true, "Log In");

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    el("loginForm").reset();

    await loadDashboard(data.user);

    showMessage("Welcome back! 🥂");

  } catch (error) {
    showMessage("Login failed: " + error.message, "error");
  } finally {
    setButtonLoading(button, false, "Log In");
  }
});

/* ==========================================
   LOAD DASHBOARD
========================================== */

async function loadDashboard(user) {
  currentMember = user;

  el("authSection").classList.add("hidden");
  el("dashboard").classList.remove("hidden");

  el("profileEmail").textContent = user.email || "";

  await loadProfile();
  await loadSocialFeatures();
}

/* ==========================================
   LOAD PROFILE
========================================== */

async function loadProfile() {
  if (!currentMember) return;

  const { data, error } = await db
    .from("profiles")
    .select("id,display_name,bio,gender,city,avatar_url,avatar_path")
    .eq("id", currentMember.id)
    .maybeSingle();

  if (error) {
    showMessage("Profile error: " + error.message, "error");
    return;
  }

  if (!data) {
    const metadata = currentMember.user_metadata || {};

    el("displayName").value = metadata.display_name || "";

    showMessage(
      "Your profile record is missing. Check your Supabase profile creation trigger.",
      "error"
    );

    return;
  }

  el("displayName").value = data.display_name || "";
  el("bio").value = data.bio || "";
  el("gender").value = data.gender || "";
  el("city").value = data.city || "";

  if (data.avatar_url) {
    el("profilePhotoPreview").src = data.avatar_url;
    el("profilePhotoPreview").classList.remove("hidden");
    el("profilePhotoPlaceholder").classList.add("hidden");
  } else {
    el("profilePhotoPreview").classList.add("hidden");
    el("profilePhotoPlaceholder").classList.remove("hidden");
  }
}

/* ==========================================
   SAVE PROFILE
========================================== */

el("profileForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentMember) return;

  const button = event.submitter;

  setButtonLoading(button, true, "Save Profile");

  try {
    const updates = {
      display_name: el("displayName").value.trim(),
      bio: el("bio").value.trim(),
      gender: el("gender").value,
      city: el("city").value.trim()
    };

    const { error } = await db
      .from("profiles")
      .update(updates)
      .eq("id", currentMember.id);

    if (error) throw error;

    showMessage("Your profile has been saved successfully! 🥂");

    await loadMembers();

  } catch (error) {
    showMessage("Could not save profile: " + error.message, "error");
  } finally {
    setButtonLoading(button, false, "Save Profile");
  }
});

/* ==========================================
   PROFILE PHOTO PREVIEW
========================================== */

el("profilePhotoInput").addEventListener("change", event => {
  const file = event.target.files[0];

  if (!file) return;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp"
  ];

  if (!allowedTypes.includes(file.type)) {
    setPhotoMessage("Please select a JPG, PNG or WEBP image.", "#ff7777");
    event.target.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    setPhotoMessage("Image must be smaller than 5 MB.", "#ff7777");
    event.target.value = "";
    return;
  }

  const preview = el("profilePhotoPreview");

  if (preview.dataset.previewUrl) {
    URL.revokeObjectURL(preview.dataset.previewUrl);
  }

  const previewUrl = URL.createObjectURL(file);

  preview.dataset.previewUrl = previewUrl;
  preview.src = previewUrl;

  preview.classList.remove("hidden");
  el("profilePhotoPlaceholder").classList.add("hidden");

  setPhotoMessage(
    "Image ready. Click Upload Profile Picture.",
    "#d9ad62"
  );
});

/* ==========================================
   UPLOAD PROFILE PHOTO
========================================== */

el("uploadPhotoButton").addEventListener("click", async () => {
  if (!currentMember) {
    setPhotoMessage("Please log in first.", "#ff7777");
    return;
  }

  const button = el("uploadPhotoButton");
  const file = el("profilePhotoInput").files[0];

  if (!file) {
    setPhotoMessage("Please choose a picture first.", "#ff7777");
    return;
  }

  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  if (!extensions[file.type] || file.size > 5 * 1024 * 1024) {
    setPhotoMessage("Invalid image or image exceeds 5 MB.", "#ff7777");
    return;
  }

  button.disabled = true;
  button.textContent = "Uploading...";

  let newPath = null;
  let profileSaved = false;

  try {
    const { data: oldProfile, error: readError } = await db
      .from("profiles")
      .select("avatar_path")
      .eq("id", currentMember.id)
      .single();

    if (readError) throw readError;

    newPath =
      currentMember.id + "/" +
      Date.now() + "." + extensions[file.type];

    const { error: uploadError } = await db.storage
      .from(PHOTO_BUCKET)
      .upload(newPath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: publicData } = db.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(newPath);

    const imageUrl = publicData.publicUrl;

    const { error: updateError } = await db
      .from("profiles")
      .update({
        avatar_url: imageUrl,
        avatar_path: newPath
      })
      .eq("id", currentMember.id);

    if (updateError) throw updateError;

    profileSaved = true;

    const preview = el("profilePhotoPreview");

    preview.src = imageUrl + "?v=" + Date.now();
    preview.classList.remove("hidden");

    el("profilePhotoPlaceholder").classList.add("hidden");

    if (
      oldProfile.avatar_path &&
      oldProfile.avatar_path !== newPath
    ) {
      const { error: deleteError } = await db.storage
        .from(PHOTO_BUCKET)
        .remove([oldProfile.avatar_path]);

      if (deleteError) {
        console.warn("Old photo cleanup failed:", deleteError.message);
      }
    }

    el("profilePhotoInput").value = "";

    setPhotoMessage(
      "Your profile picture has been uploaded successfully! 🥂",
      "#70d49a"
    );

    await loadMembers();

  } catch (error) {

    if (newPath && !profileSaved) {
      await db.storage
        .from(PHOTO_BUCKET)
        .remove([newPath]);
    }

    setPhotoMessage("Upload failed: " + error.message, "#ff7777");

  } finally {
    button.disabled = false;
    button.textContent = "Upload Profile Picture 📸";
  }
});

/* ==========================================
   LOAD SOCIAL FEATURES
========================================== */

async function loadSocialFeatures() {
  await loadLikes();
  await loadMutualConnections();
  await loadMembers();
}

/* ==========================================
   LOAD MEMBERS
========================================== */

async function loadMembers() {
  if (!currentMember) return;

  const results = el("memberResults");

  results.textContent = "Loading members...";

  const { data, error } = await db
    .from("profiles")
    .select("id,display_name,bio,gender,city,avatar_url")
    .neq("id", currentMember.id)
    .limit(100);

  if (error) {
    results.textContent = "Could not load members: " + error.message;
    return;
  }

  allMembers = data || [];

  searchMembers();
}

/* ==========================================
   MEMBER SEARCH
========================================== */

function searchMembers() {
  const query = el("memberSearch").value.toLowerCase().trim();
  const gender = el("genderFilter").value;

  const filtered = allMembers.filter(member => {

    const searchable = [
      member.display_name,
      member.city,
      member.bio
    ].join(" ").toLowerCase();

    return (
      searchable.includes(query) &&
      (!gender || member.gender === gender)
    );
  });

  displayMembers(filtered);
}

el("searchMembers").addEventListener("click", searchMembers);
el("memberSearch").addEventListener("input", searchMembers);
el("genderFilter").addEventListener("change", searchMembers);

/* ==========================================
   DISPLAY MEMBER CARDS
========================================== */

function displayMembers(members) {
  const results = el("memberResults");

  results.innerHTML = "";

  if (!members.length) {
    results.textContent = "No members found.";
    return;
  }

  members.forEach(member => {

    const card = document.createElement("div");
    card.className = "member-card";

    const avatar = document.createElement("div");
    avatar.className = "member-avatar";

    if (member.avatar_url) {
      const image = document.createElement("img");

      image.src = member.avatar_url;
      image.alt = "Member profile picture";
      image.loading = "lazy";

      avatar.appendChild(image);

    } else {
      avatar.textContent =
        (member.display_name || "D").charAt(0).toUpperCase();
    }

    const heading = document.createElement("h3");
    heading.textContent = member.display_name || "D&C Member";

    const city = document.createElement("p");
    city.textContent = member.city || "Location not specified";

    const gender = document.createElement("p");
    gender.textContent = member.gender || "Not specified";

    const bio = document.createElement("p");
    bio.textContent = member.bio || "No biography yet.";

    card.append(avatar, heading, city, gender, bio);

    if (mutualMembers.includes(member.id)) {

      const button = document.createElement("button");
      button.textContent = "Message 💬";

      button.addEventListener("click", () => {
        openConversation(member.id);
      });

      card.appendChild(button);

    } else if (memberLikes.includes(member.id)) {

      const button = document.createElement("button");

      button.textContent = "Like Sent ❤️";
      button.disabled = true;

      card.appendChild(button);

    } else {

      const button = document.createElement("button");

      button.textContent = "Like ❤️";

      button.addEventListener("click", () => {
        likeMember(member.id);
      });

      card.appendChild(button);
    }

    results.appendChild(card);
  });
}

/* ==========================================
   LOAD OUTGOING LIKES
========================================== */

async function loadLikes() {
  if (!currentMember) return;

  const { data, error } = await db
    .from("connections")
    .select("liked_user_id")
    .eq("user_id", currentMember.id);

  if (error) {
    showMessage("Could not load likes: " + error.message, "error");
    return;
  }

  memberLikes = (data || []).map(item => item.liked_user_id);
}

/* ==========================================
   LIKE A MEMBER
========================================== */

async function likeMember(memberId) {
  if (!currentMember || memberId === currentMember.id) return;

  if (memberLikes.includes(memberId)) {
    showMessage("You have already liked this member.", "error");
    return;
  }

  try {
    const { error } = await db
      .from("connections")
      .insert({
        user_id: currentMember.id,
        liked_user_id: memberId
      });

    if (error) throw error;

    showMessage("Your like has been sent! ❤️");

    await loadLikes();
    await loadMutualConnections();

    searchMembers();

  } catch (error) {
    showMessage("Could not send like: " + error.message, "error");
  }
}

/* ==========================================
   LOAD MUTUAL CONNECTIONS
========================================== */

async function loadMutualConnections() {
  if (!currentMember) return;

  const [outgoingResult, incomingResult] = await Promise.all([

    db.from("connections")
      .select("liked_user_id")
      .eq("user_id", currentMember.id),

    db.from("connections")
      .select("user_id")
      .eq("liked_user_id", currentMember.id)

  ]);

  if (outgoingResult.error || incomingResult.error) {
    console.error(
      outgoingResult.error || incomingResult.error
    );

    return;
  }

  const outgoing = (outgoingResult.data || [])
    .map(item => item.liked_user_id);

  const incoming = (incomingResult.data || [])
    .map(item => item.user_id);

  mutualMembers = outgoing.filter(id => incoming.includes(id));

  const contacts = el("chatContacts");
  contacts.innerHTML = "";

  if (!mutualMembers.length) {
    contacts.textContent =
      "No mutual connections yet. Keep discovering! ❤️";

    return;
  }

  const { data, error } = await db
    .from("profiles")
    .select("id,display_name,avatar_url")
    .in("id", mutualMembers);

  if (error) {
    contacts.textContent =
      "Could not load connections: " + error.message;

    return;
  }

  (data || []).forEach(member => {

    const item = document.createElement("div");
    item.className = "contact-item";

    const name = document.createElement("span");

    name.textContent =
      "❤️ " + (member.display_name || "D&C Member");

    const button = document.createElement("button");

    button.textContent = "Chat 💬";

    button.addEventListener("click", () => {
      openConversation(member.id);
    });

    item.append(name, button);
    contacts.appendChild(item);
  });
}

/* ==========================================
   OPEN CHAT
========================================== */

async function openConversation(memberId) {
  if (!mutualMembers.includes(memberId)) {
    showMessage(
      "You need a mutual connection before messaging.",
      "error"
    );

    return;
  }

  activeChatUser = memberId;

  const member = allMembers.find(item => item.id === memberId);

  el("chatTitle").textContent =
    "Chat with " + (member?.display_name || "D&C Member");

  el("chatWindow").classList.remove("hidden");

  await loadMessages();

  el("chatWindow").scrollIntoView({
    behavior: "smooth"
  });
}

/* ==========================================
   LOAD CHAT MESSAGES
========================================== */

async function loadMessages() {
  if (!currentMember || !activeChatUser) return;

  if (!mutualMembers.includes(activeChatUser)) {
    el("chatMessages").textContent =
      "This connection is no longer available.";

    return;
  }

  const messagesBox = el("chatMessages");

  messagesBox.textContent = "Loading messages...";

  const myId = currentMember.id;
  const otherId = activeChatUser;

  const filter =
    "and(sender_id.eq." + myId +
    ",recipient_id.eq." + otherId + ")," +
    "and(sender_id.eq." + otherId +
    ",recipient_id.eq." + myId + ")";

  const { data, error } = await db
    .from("messages")
    .select("id,sender_id,recipient_id,content,created_at")
    .or(filter)
    .order("created_at", { ascending: true });

  if (error) {
    messagesBox.textContent =
      "Could not load messages: " + error.message;

    return;
  }

  messagesBox.innerHTML = "";

  if (!data || !data.length) {
    messagesBox.textContent =
      "Start your conversation! 🥂";

    return;
  }

  data.forEach(message => {

    const bubble = document.createElement("div");

    bubble.className =
      "chat-bubble " +
      (
        message.sender_id === myId
          ? "mine"
          : "theirs"
      );

    const content = document.createElement("span");

    content.textContent = message.content;

    const time = document.createElement("small");

    time.textContent =
      new Date(message.created_at).toLocaleString();

    bubble.append(content, time);

    messagesBox.appendChild(bubble);
  });

  messagesBox.scrollTop = messagesBox.scrollHeight;
}

/* ==========================================
   SEND MESSAGE
========================================== */

el("messageForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentMember || !activeChatUser) return;

  if (!mutualMembers.includes(activeChatUser)) {
    showMessage(
      "You can only message mutual connections.",
      "error"
    );

    return;
  }

  const input = el("messageInput");
  const button = event.submitter;

  const content = input.value.trim();

  if (!content) return;

  button.disabled = true;
  button.textContent = "Sending...";

  try {
    const { error } = await db
      .from("messages")
      .insert({
        sender_id: currentMember.id,
        recipient_id: activeChatUser,
        content: content
      });

    if (error) throw error;

    input.value = "";

    await loadMessages();

  } catch (error) {
    showMessage("Message failed: " + error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Send";
  }
});

/* REFRESH CHAT */

el("refreshChat").addEventListener("click", loadMessages);

/* CLOSE CHAT */

el("closeChat").addEventListener("click", () => {

  activeChatUser = null;

  el("chatWindow").classList.add("hidden");

  el("chatMessages").innerHTML = "";
});

/* ==========================================
   LOGOUT
========================================== */

el("logoutButton").addEventListener("click", async () => {

  const button = el("logoutButton");

  button.disabled = true;

  try {
    const { error } = await db.auth.signOut();

    if (error) throw error;

    currentMember = null;
    activeChatUser = null;

    allMembers = [];
    memberLikes = [];
    mutualMembers = [];

    el("dashboard").classList.add("hidden");
    el("authSection").classList.remove("hidden");
    el("chatWindow").classList.add("hidden");

    el("memberResults").innerHTML = "";
    el("chatContacts").innerHTML = "";

    showMessage("You have logged out successfully.");

  } catch (error) {
    showMessage("Logout failed: " + error.message, "error");
  } finally {
    button.disabled = false;
  }
});

/* ==========================================
   RESTORE LOGIN SESSION
========================================== */

async function restoreSession() {

  const { data, error } = await db.auth.getSession();

  if (error) {
    showMessage("Session error: " + error.message, "error");
    return;
  }

  if (data.session && data.session.user) {
    await loadDashboard(data.session.user);
  }
}

/* START APPLICATION */

restoreSession();