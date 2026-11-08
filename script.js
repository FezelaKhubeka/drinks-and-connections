
"use strict";

/* ===================================
   DRINKS & CONNECTIONS
   SUPABASE CONFIGURATION
=================================== */

const SUPABASE_URL =
  "https://xnmvqjbquibqcjryxpge.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_7YtYRhqp0walmpQX22pYCg_kdt45GEf";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const el = id => document.getElementById(id);

let currentMember = null;
let activeChatUser = null;
let memberLikes = [];
let mutualMembers = [];
let allMembers = [];
let messageSubscription = null;

/* ===================================
   GENERAL FUNCTIONS
=================================== */

function showMessage(message, success = false) {
  el("message").textContent = message;
  el("message").style.color =
    success ? "#77d99a" : "#ff9999";
}

function safeText(value) {
  return String(value || "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
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
  ) age--;

  return age;
}

/* ===================================
   AUTHENTICATION
=================================== */

function showLogin() {
  el("registerPanel").classList.add("hidden");
  el("loginPanel").classList.remove("hidden");
  showMessage("");
}

function showRegister() {
  el("loginPanel").classList.add("hidden");
  el("registerPanel").classList.remove("hidden");
  showMessage("");
}

el("showLogin").addEventListener("click", showLogin);
el("showRegister").addEventListener("click", showRegister);

/* REGISTER */

el("registerForm").addEventListener("submit", async event => {
  event.preventDefault();

  const name = el("regName").value.trim();
  const dob = el("regDob").value;
  const email = el("regEmail").value.trim();
  const password = el("regPassword").value;

  if (!name || !dob || !email || password.length < 8) {
    showMessage("Please complete all fields correctly.");
    return;
  }

  if (calculateAge(dob) < 18) {
    showMessage("D&C is only available to people aged 18 and older.");
    return;
  }

  const button = el("registerButton");
  button.disabled = true;
  button.textContent = "Creating account...";

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

    if (data.session && data.user) {
      await loadProfile(data.user);
    } else {
      showMessage(
        "Registration successful! Check your email to verify your account.",
        true
      );
    }

  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Create Account";
  }
});

/* LOGIN */

el("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = el("loginButton");
  button.disabled = true;
  button.textContent = "Logging in...";

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: el("loginEmail").value.trim(),
      password: el("loginPassword").value
    });

    if (error) throw error;

    await loadProfile(data.user);

  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Log In";
  }
});

/* ===================================
   MEMBER PROFILE
=================================== */

async function loadProfile(user) {
  try {
    currentMember = user;

    const { data, error } = await db
      .from("profiles")
      .select("id,display_name,bio,gender,city")
      .eq("id", user.id)
      .single();

    if (error) throw error;

    el("authSection").classList.add("hidden");
    el("dashboard").classList.remove("hidden");

    el("profileName").textContent =
      data.display_name || "D&C Member";

    el("profileEmail").textContent = user.email || "";

    el("bio").value = data.bio || "";
    el("gender").value = data.gender || "";
    el("city").value = data.city || "";

    await loadSocialFeatures(user);

    showMessage("Welcome to Drinks & Connections!", true);

  } catch (error) {
    showMessage("Profile loading error: " + error.message);
  }
}

/* SAVE PROFILE */

el("profileForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = el("saveButton");
  button.disabled = true;

  try {
    const { data: { user }, error: authError } =
      await db.auth.getUser();

    if (authError) throw authError;
    if (!user) throw new Error("Please log in again.");

    const { error } = await db
      .from("profiles")
      .update({
        bio: el("bio").value.trim(),
        gender: el("gender").value,
        city: el("city").value.trim()
      })
      .eq("id", user.id);

    if (error) throw error;

    showMessage("Your profile has been saved!", true);
    await loadMembers();

  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
  }
});

/* ===================================
   SOCIAL FEATURES
=================================== */

async function loadSocialFeatures(user) {
  currentMember = user;

  await loadLikes();
  await loadMembers();
  await loadMutualConnections();
}

/* LOAD MEMBERS */

async function loadMembers() {
  const results = el("memberResults");
  results.textContent = "Loading members...";

  try {
    const { data, error } = await db
      .from("profiles")
      .select("id,display_name,bio,gender,city")
      .neq("id", currentMember.id)
      .limit(100);

    if (error) throw error;

    allMembers = data || [];
    displayMembers(allMembers);

  } catch (error) {
    results.textContent = error.message;
  }
}

/* DISPLAY MEMBERS */

function displayMembers(members) {
  const results = el("memberResults");
  results.innerHTML = "";

  if (!members.length) {
    results.textContent = "No members found.";
    return;
  }

  members.forEach(member => {
    const name = safeText(member.display_name || "D&C Member");

    const card = document.createElement("div");
    card.className = "member-card";

    const avatar = document.createElement("div");
    avatar.className = "member-avatar";
    avatar.textContent = name.charAt(0).toUpperCase();

    const heading = document.createElement("h3");
    heading.textContent = member.display_name || "D&C Member";

    const city = document.createElement("p");
    city.textContent = member.city || "Location not specified";

    const gender = document.createElement("p");
    gender.textContent = member.gender || "Gender not specified";

    const bio = document.createElement("p");
    bio.textContent = member.bio || "No biography yet.";

    card.append(avatar, heading, city, gender, bio);

    if (mutualMembers.includes(member.id)) {
      const button = document.createElement("button");
      button.textContent = "Message 💬";
      button.addEventListener("click", () =>
        openConversation(member.id)
      );
      card.appendChild(button);

    } else if (memberLikes.includes(member.id)) {
      const button = document.createElement("button");
      button.disabled = true;
      button.textContent = "Like Sent ❤️";
      card.appendChild(button);

    } else {
      const button = document.createElement("button");
      button.textContent = "Like ❤️";
      button.addEventListener("click", () =>
        likeMember(member.id)
      );
      card.appendChild(button);
    }

    results.appendChild(card);
  });
}

/* SEARCH */

el("searchMembers").addEventListener("click", () => {
  const term = el("memberSearch").value.trim().toLowerCase();
  const gender = el("genderFilter").value;

  const filtered = allMembers.filter(member => {
    const search =
      !term ||
      (member.display_name || "").toLowerCase().includes(term) ||
      (member.city || "").toLowerCase().includes(term) ||
      (member.bio || "").toLowerCase().includes(term);

    return search && (!gender || member.gender === gender);
  });

  displayMembers(filtered);
});

/* LOAD LIKES */

async function loadLikes() {
  const { data, error } = await db
    .from("connections")
    .select("liked_user_id")
    .eq("user_id", currentMember.id);

  if (error) throw error;

  memberLikes = (data || []).map(item => item.liked_user_id);
}

/* LIKE MEMBER */

async function likeMember(memberId) {
  try {
    const { error } = await db
      .from("connections")
      .insert({
        user_id: currentMember.id,
        liked_user_id: memberId
      });

    if (error) throw error;

    showMessage("Your like has been sent! ❤️", true);

    await loadSocialFeatures(currentMember);

  } catch (error) {
    showMessage(error.message);
  }
}

/* MUTUAL CONNECTIONS */

async function loadMutualConnections() {
  const { data: outgoing, error: firstError } = await db
    .from("connections")
    .select("liked_user_id")
    .eq("user_id", currentMember.id);

  if (firstError) throw firstError;

  const { data: incoming, error: secondError } = await db
    .from("connections")
    .select("user_id")
    .eq("liked_user_id", currentMember.id);

  if (secondError) throw secondError;

  const incomingIds = new Set(
    (incoming || []).map(item => item.user_id)
  );

  mutualMembers = (outgoing || [])
    .map(item => item.liked_user_id)
    .filter(id => incomingIds.has(id));

  const contacts = el("chatContacts");
  contacts.innerHTML = "";

  if (!mutualMembers.length) {
    contacts.textContent = "No mutual connections yet.";
  }

  mutualMembers.forEach(id => {
    const member = allMembers.find(person => person.id === id);

    if (!member) return;

    const item = document.createElement("div");
    item.className = "connection-item";

    const title = document.createElement("strong");
    title.textContent =
      (member.display_name || "Member") + " ❤️";

    const button = document.createElement("button");
    button.textContent = "Open Chat 💬";
    button.addEventListener("click", () => openConversation(id));

    item.append(title, button);
    contacts.appendChild(item);
  });

  displayMembers(allMembers);
}

/* ===================================
   PRIVATE MESSAGING
=================================== */

async function openConversation(memberId) {
  if (!mutualMembers.includes(memberId)) {
    showMessage("You need a mutual connection first.");
    return;
  }

  activeChatUser = memberId;

  const member = allMembers.find(person => person.id === memberId);

  el("chatTitle").textContent =
    "Chat with " + (member?.display_name || "Member");

  el("chatWindow").classList.remove("hidden");

  await loadMessages();
}

/* LOAD MESSAGES */

async function loadMessages() {
  if (!activeChatUser) return;

  const chat = el("chatMessages");
  chat.textContent = "Loading messages...";

  try {
    const { data, error } = await db
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${currentMember.id},recipient_id.eq.${activeChatUser}),and(sender_id.eq.${activeChatUser},recipient_id.eq.${currentMember.id})`
      )
      .order("created_at", { ascending: true });

    if (error) throw error;

    chat.innerHTML = "";

    if (!data.length) {
      chat.textContent = "Say hello and start chatting!";
    }

    data.forEach(message => {
      const bubble = document.createElement("div");

      bubble.className =
        "chat-bubble" +
        (message.sender_id === currentMember.id ? " mine" : "");

      const content = document.createElement("span");
      content.textContent = message.content;

      const time = document.createElement("small");
      time.textContent =
        new Date(message.created_at).toLocaleString();

      bubble.append(content, time);
      chat.appendChild(bubble);
    });

    chat.scrollTop = chat.scrollHeight;

  } catch (error) {
    chat.textContent = "Unable to load messages.";
    showMessage(error.message);
  }
}

/* SEND MESSAGE */

el("messageForm").addEventListener("submit", async event => {
  event.preventDefault();

  const content = el("messageInput").value.trim();

  if (!content || !activeChatUser) return;

  const button = event.submitter;
  if (button) button.disabled = true;

  try {
    const { error } = await db
      .from("messages")
      .insert({
        sender_id: currentMember.id,
        recipient_id: activeChatUser,
        content
      });

    if (error) throw error;

    el("messageInput").value = "";
    await loadMessages();

  } catch (error) {
    showMessage("Message failed: " + error.message);
  } finally {
    if (button) button.disabled = false;
  }
});

/* CLOSE CHAT */

el("closeChat").addEventListener("click", () => {
  activeChatUser = null;
  el("chatWindow").classList.add("hidden");
});

/* MANUAL REFRESH */

const refreshButton = document.createElement("button");
refreshButton.className = "secondary";
refreshButton.textContent = "Refresh Messages";
refreshButton.type = "button";
refreshButton.addEventListener("click", loadMessages);
el("chatWindow").appendChild(refreshButton);

/* ===================================
   LOGOUT AND SESSION RESTORE
=================================== */

el("logoutButton").addEventListener("click", async () => {
  try {
    const { error } = await db.auth.signOut();

    if (error) throw error;

    currentMember = null;
    activeChatUser = null;
    memberLikes = [];
    mutualMembers = [];
    allMembers = [];

    el("dashboard").classList.add("hidden");
    el("authSection").classList.remove("hidden");

    el("loginForm").reset();
    showLogin();

    showMessage("You have logged out.", true);

  } catch (error) {
    showMessage(error.message);
  }
});

/* RESTORE SESSION */

async function restoreSession() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    showMessage(error.message);
    return;
  }

  if (data.session) {
    await loadProfile(data.session.user);
  }
}

restoreSession();

/* AUTH STATE CHANGES */

db.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    currentMember = null;
    activeChatUser = null;

    el("dashboard").classList.add("hidden");
    el("authSection").classList.remove("hidden");
  }
});
