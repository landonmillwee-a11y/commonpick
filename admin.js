// CommonPick admin dashboard. Admin permissions are enforced by Supabase RLS.
const SUPABASE_URL = "https://zrjqmcgulgypqgoygbvx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BRuQrQwfwlQhAXnx9uuabA_XPje_3Ew";
const ADMIN_EMAIL = "landonmillwee@gmail.com";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginPanel = document.getElementById("login-panel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const pollForm = document.getElementById("poll-form");
const choiceFields = document.getElementById("choice-fields");
const formMessage = document.getElementById("form-message");
const pollList = document.getElementById("admin-poll-list");
const signOut = document.getElementById("sign-out");
let editingPollId = null;

function addChoice(value = "") {
  if (choiceFields.children.length >= 40) {
    formMessage.textContent = "A poll can have up to 40 choices.";
    return;
  }
  const row = document.createElement("div");
  row.className = "choice-input-row";
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 90;
  input.placeholder = "Choice " + (choiceFields.children.length + 1);
  input.value = value;
  input.required = true;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove-choice";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    if (choiceFields.children.length <= 2) {
      formMessage.textContent = "Every poll needs at least two choices.";
      return;
    }
    row.remove();
  });
  row.append(input, remove);
  choiceFields.append(row);
}

function resetForm() {
  editingPollId = null;
  pollForm.reset();
  document.getElementById("poll-category").value = "COMMUNITY";
  choiceFields.innerHTML = "";
  addChoice();
  addChoice();
  document.getElementById("form-heading").textContent = "Create a poll.";
  document.getElementById("save-draft").textContent = "Save as draft";
  document.getElementById("publish-now").hidden = false;
  document.getElementById("cancel-edit").hidden = true;
  formMessage.textContent = "";
}

function slugify(text, index) {
  const slug = text.toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return (slug || "choice") + "-" + (index + 1);
}

async function loadAdminPolls() {
  const { data: polls, error } = await client.from("commonpick_polls")
    .select("id,title,category,status,created_at").order("created_at", { ascending: false });
  if (error) {
    pollList.textContent = "Could not load polls. Confirm that the database setup has been run.";
    console.error(error);
    return;
  }
  pollList.innerHTML = "";
  if (!polls.length) {
    pollList.textContent = "No polls created yet.";
    return;
  }
  polls.forEach(poll => {
    const row = document.createElement("article");
    row.className = "admin-poll-row";
    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = poll.title;
    const meta = document.createElement("p");
    meta.textContent = poll.category + " · " + poll.status.toUpperCase();
    details.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "admin-row-actions";
    const edit = document.createElement("button");
    edit.className = "results-button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editPoll(poll.id));
    actions.append(edit);
    if (poll.status !== "closed") {
      const toggle = document.createElement("button");
      toggle.className = "results-button";
      toggle.textContent = poll.status === "published" ? "Close voting" : "Publish";
      toggle.addEventListener("click", async () => {
        const next = poll.status === "published" ? "closed" : "published";
        const { error: updateError } = await client.from("commonpick_polls")
          .update({ status: next, updated_at: new Date().toISOString() }).eq("id", poll.id);
        if (updateError) alert("Could not update poll status: " + updateError.message);
        await loadAdminPolls();
      });
      actions.append(toggle);
    }
    row.append(details, actions);
    pollList.append(row);
  });
}

async function editPoll(id) {
  const { data: poll, error } = await client.from("commonpick_polls")
    .select("id,title,description,category,status").eq("id", id).single();
  if (error) { formMessage.textContent = error.message; return; }
  const { data: options, error: optionsError } = await client.from("commonpick_options")
    .select("option_id,label,position").eq("poll_id", id).order("position");
  if (optionsError) { formMessage.textContent = optionsError.message; return; }
  editingPollId = id;
  document.getElementById("poll-title").value = poll.title;
  document.getElementById("poll-description").value = poll.description || "";
  document.getElementById("poll-category").value = poll.category || "COMMUNITY";
  choiceFields.innerHTML = "";
  options.forEach(option => addChoice(option.label));
  document.getElementById("form-heading").textContent = "Edit poll.";
  document.getElementById("save-draft").textContent = "Save changes";
  document.getElementById("publish-now").hidden = true;
  document.getElementById("cancel-edit").hidden = false;
  formMessage.textContent = poll.status === "published"
    ? "Editing a published poll changes its choices. Existing votes are retained only for choices with the same names."
    : "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function savePoll(status) {
  const title = document.getElementById("poll-title").value.trim();
  const description = document.getElementById("poll-description").value.trim();
  const category = document.getElementById("poll-category").value.trim().toUpperCase();
  const labels = [...choiceFields.querySelectorAll("input")].map(input => input.value.trim()).filter(Boolean);
  if (labels.length < 2) { formMessage.textContent = "Add at least two choices."; return; }
  if (labels.length > 40) { formMessage.textContent = "A poll can have up to 40 choices."; return; }
  if (new Set(labels.map(x => x.toLowerCase())).size !== labels.length) {
    formMessage.textContent = "Each choice must be unique."; return;
  }
  formMessage.textContent = "Saving poll…";
  let pollId = editingPollId;
  if (editingPollId) {
    const { error } = await client.from("commonpick_polls").update({
      title, description, category, updated_at: new Date().toISOString()
    }).eq("id", editingPollId);
    if (error) { formMessage.textContent = error.message; return; }
    const { data: existing } = await client.from("commonpick_options")
      .select("option_id,label").eq("poll_id", editingPollId);
    const oldByLabel = new Map((existing || []).map(o => [o.label.toLowerCase(), o.option_id]));
    const { error: deleteError } = await client.from("commonpick_options")
      .delete().eq("poll_id", editingPollId);
    if (deleteError) { formMessage.textContent = deleteError.message; return; }
    const optionRows = labels.map((label, i) => ({
      poll_id: pollId,
      option_id: oldByLabel.get(label.toLowerCase()) || slugify(label, i),
      label,
      position: i + 1
    }));
    const { error: insertError } = await client.from("commonpick_options").insert(optionRows);
    if (insertError) { formMessage.textContent = insertError.message; return; }
  } else {
    const { data, error } = await client.from("commonpick_polls").insert({
      title, description, category, status
    }).select("id").single();
    if (error) { formMessage.textContent = error.message; return; }
    pollId = data.id;
    const optionRows = labels.map((label, i) => ({
      poll_id: pollId, option_id: slugify(label, i), label, position: i + 1
    }));
    const { error: insertError } = await client.from("commonpick_options").insert(optionRows);
    if (insertError) { formMessage.textContent = "Poll saved, but choices could not be saved: " + insertError.message; return; }
  }
  if (editingPollId && status === "published") {
    const { error } = await client.from("commonpick_polls")
      .update({ status: "published", updated_at: new Date().toISOString() }).eq("id", pollId);
    if (error) { formMessage.textContent = error.message; return; }
  }
  formMessage.textContent = status === "published" ? "Poll published." : "Poll saved.";
  resetForm();
  await loadAdminPolls();
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.getElementById("admin-email").value.trim().toLowerCase();
  if (email !== ADMIN_EMAIL) { loginMessage.textContent = "This email is not authorized for CommonPick administration."; return; }
  loginMessage.textContent = "Sending secure sign-in link…";
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + "/admin.html" }
  });
  loginMessage.textContent = error ? error.message : "Check your email for the secure sign-in link.";
});

pollForm.addEventListener("submit", event => {
  event.preventDefault();
  savePoll("draft");
});
document.getElementById("publish-now").addEventListener("click", () => {
  if (!pollForm.reportValidity()) return;
  savePoll("published");
});
document.getElementById("add-choice").addEventListener("click", () => addChoice());
document.getElementById("cancel-edit").addEventListener("click", resetForm);
signOut.addEventListener("click", async () => { await client.auth.signOut(); window.location.reload(); });

client.auth.onAuthStateChange(async (_event, session) => {
  const user = session?.user;
  const allowed = user?.email?.toLowerCase() === ADMIN_EMAIL;
  loginPanel.hidden = !!allowed;
  dashboard.hidden = !allowed;
  signOut.hidden = !allowed;
  if (allowed) {
    resetForm();
    await loadAdminPolls();
  } else if (user) {
    loginMessage.textContent = "This account is not authorized to manage CommonPick.";
    await client.auth.signOut();
  }
});

(async () => {
  const { data: { session } } = await client.auth.getSession();
  if (session?.user?.email?.toLowerCase() === ADMIN_EMAIL) {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    signOut.hidden = false;
    resetForm();
    await loadAdminPolls();
  }
  if (choiceFields.children.length === 0) resetForm();
})();
