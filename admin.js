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
const loadAssistantDraft = document.getElementById("load-assistant-draft");
const generatePollButton = document.getElementById("generate-poll");
const chatgptPrompt = document.getElementById("chatgpt-prompt");
const chatgptPollJson = document.getElementById("chatgpt-poll-json");
const copyChatgptPrompt = document.getElementById("copy-chatgpt-prompt");
const importChatgptPoll = document.getElementById("import-chatgpt-poll");
const aiPollTopic = document.getElementById("ai-poll-topic");
const aiPollMessage = document.getElementById("ai-poll-message");
const adminPollSearch = document.getElementById("admin-poll-search");
const adminPollStatus = document.getElementById("admin-poll-status");
const adminPollSummary = document.getElementById("admin-poll-summary");
let editingPollId = null;
let cachedAdminPolls = [];

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

let currentAssistantDraftId = null;

async function loadAssistantQueue() {
  const queue = document.getElementById("assistant-draft-queue");
  queue.textContent = "Loading draft queue…";
  const { data: drafts, error } = await client.from("commonpick_assistant_drafts")
    .select("id,title,description,category,choices,status,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    queue.textContent = "Could not load assistant drafts. Run the assistant draft database setup.";
    console.error(error);
    return;
  }
  queue.innerHTML = "";
  if (!drafts?.length) { queue.textContent = "No assistant-generated drafts are waiting."; return; }
  drafts.forEach(draft => {
    const row = document.createElement("div");
    row.className = "admin-poll-row";
    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = draft.title || "Untitled poll";
    const meta = document.createElement("p");
    meta.textContent = (draft.category || "COMMUNITY") + " · " + (draft.choices || []).length + " choices" +
      (draft.status === "used" ? " · SAVED TO POLL LIBRARY" : " · WAITING FOR REVIEW");
    details.append(title, meta);
    const load = document.createElement("button");
    load.className = "results-button";
    load.type = "button";
    load.textContent = draft.status === "used" ? "Saved to polls" : "Review draft";
    load.disabled = draft.status === "used";
    if (!load.disabled) load.addEventListener("click", () => loadDraftFromAssistant(draft));
    row.append(details, load);
    queue.append(row);
  });
}

function buildChatGPTPrompt() {
  const topic = aiPollTopic.value.trim();
  const category = document.getElementById("poll-category").value.trim() || "COMMUNITY";
  if (topic.length < 3) {
    aiPollMessage.textContent = "Enter a topic with at least 3 characters.";
    aiPollTopic.focus();
    return "";
  }

  return `Create one complete CommonPick community poll for this topic: "${topic}".
Suggested category: ${category}.

Make the poll engaging, neutral, easy to understand, and suitable for a broad public audience. Avoid leading wording, biased framing, duplicate answers, and overlapping choices. Choose 6–12 concise, distinct answer choices that cover the likely responses. Use "Other" only when it makes sense.

Return ONLY valid JSON. Do not use Markdown fences or add commentary. Match this exact structure:
{
  "title": "The poll question, maximum 140 characters",
  "description": "Optional short context, maximum 300 characters",
  "category": "A short category, maximum 40 characters",
  "choices": ["Choice 1", "Choice 2", "Choice 3"]
}

Requirements: 2–40 choices; each choice maximum 90 characters; no duplicate choices. The title must be phrased as a question when appropriate. Do not include vote counts or claim that the poll is official.`;
}

function startChatGPTWorkflow() {
  const prompt = buildChatGPTPrompt();
  if (!prompt) return;
  chatgptPrompt.value = prompt;
  aiPollMessage.textContent = "Prompt prepared. Copy it, then paste it into ChatGPT.";
  window.open("https://chatgpt.com/", "_blank", "noopener");
  chatgptPrompt.focus();
  chatgptPrompt.select();
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(prompt).then(() => {
        aiPollMessage.textContent = "Prompt copied. Paste it into the ChatGPT tab that just opened.";
      }).catch(() => {
        aiPollMessage.textContent = "ChatGPT opened. Copy the highlighted prompt above and paste it into ChatGPT.";
      });
    }
  } catch {
    aiPollMessage.textContent = "ChatGPT opened. Copy the highlighted prompt above and paste it into ChatGPT.";
  }
}

function importChatGPTDraft() {
  const raw = chatgptPollJson.value.trim();
  if (!raw) {
    aiPollMessage.textContent = "Paste ChatGPT's JSON response first.";
    chatgptPollJson.focus();
    return;
  }

  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const draft = JSON.parse(cleaned);
    const title = typeof draft.title === "string" ? draft.title.trim() : "";
    const description = typeof draft.description === "string" ? draft.description.trim() : "";
    const category = typeof draft.category === "string" ? draft.category.trim().slice(0, 40) : "COMMUNITY";
    const choices = Array.isArray(draft.choices)
      ? [...new Map(draft.choices.map(value => String(value).trim()).filter(Boolean).map(value => [value.toLowerCase(), value])).values()]
      : [];

    if (!title || title.length > 140 || description.length > 300 || choices.length < 2 || choices.length > 40 || choices.some(choice => choice.length > 90)) {
      throw new Error("Check that the response has a title, description under 300 characters, category, and 2–40 choices under 90 characters each.");
    }

    loadDraftFromAssistant({ title, description, category, choices });
    chatgptPollJson.value = "";
    aiPollMessage.textContent = "Poll imported. Review every field below, then save it as a draft or publish it yourself.";
  } catch (error) {
    aiPollMessage.textContent = error instanceof SyntaxError
      ? "That response is not valid JSON. Ask ChatGPT to return only the JSON object, then paste it again."
      : error.message;
  }
}

function loadDraftFromAssistant(draft) {
  currentAssistantDraftId = draft.id || null;
  editingPollId = null;
  pollForm.reset();
  document.getElementById("poll-title").value = draft.title || "";
  document.getElementById("poll-description").value = draft.description || "";
  document.getElementById("poll-category").value = draft.category || "COMMUNITY";
  choiceFields.innerHTML = "";
  (draft.choices || []).forEach(choice => addChoice(choice));
  if (choiceFields.children.length < 2) { addChoice(); addChoice(); }
  document.getElementById("form-heading").textContent = "Review assistant draft.";
  document.getElementById("save-draft").textContent = "Save as draft";
  document.getElementById("publish-now").hidden = false;
  document.getElementById("cancel-edit").hidden = false;
  formMessage.textContent = "Draft loaded. Edit any field, then save it to your poll library. It will not go live unless you publish it.";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  editingPollId = null;
  currentAssistantDraftId = null;
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

async function loadCategoryRecommendations() {
  const list = document.getElementById("category-recommendation-list");
  list.textContent = "Loading recommendations…";
  const { data: recommendations, error } = await client
    .from("commonpick_category_recommendations")
    .select("id,category,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    list.textContent = "Could not load recommendations. Run the category recommendations database setup.";
    console.error(error);
    return;
  }
  list.innerHTML = "";
  if (!recommendations.length) {
    list.textContent = "No category recommendations yet.";
    return;
  }
  recommendations.forEach(recommendation => {
    const row = document.createElement("article");
    row.className = "admin-poll-row";
    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = recommendation.category;
    const meta = document.createElement("p");
    meta.textContent = "SUBMITTED " + new Date(recommendation.created_at).toLocaleDateString();
    details.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "admin-row-actions";
    const use = document.createElement("button");
    use.type = "button";
    use.className = "results-button";
    use.textContent = "Create poll draft";
    use.addEventListener("click", () => {
      resetForm();
      document.getElementById("poll-category").value = recommendation.category;
      document.getElementById("form-heading").textContent = "Create a poll from this recommendation.";
      formMessage.textContent = "Category added. Write the poll question and answer choices, then save as a draft.";
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.getElementById("poll-title").focus();
    });
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "results-button";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", async () => {
      if (!window.confirm("Dismiss this category recommendation?")) return;
      const { error: deleteError } = await client.from("commonpick_category_recommendations")
        .delete().eq("id", recommendation.id);
      if (deleteError) {
        alert("Could not dismiss recommendation: " + deleteError.message);
        return;
      }
      await loadCategoryRecommendations();
    });
    actions.append(use, dismiss);
    row.append(details, actions);
    list.append(row);
  });
}

function renderAdminPolls() {
  const term = (adminPollSearch?.value || "").trim().toLowerCase();
  const status = adminPollStatus?.value || "all";
  const filtered = cachedAdminPolls.filter(poll => {
    const matchesStatus = status === "all" || poll.status === status;
    const searchable = [poll.title, poll.category, poll.status].join(" ").toLowerCase();
    return matchesStatus && searchable.includes(term);
  });

  const counts = cachedAdminPolls.reduce((all, poll) => {
    all[poll.status] = (all[poll.status] || 0) + 1;
    return all;
  }, {});
  adminPollSummary.textContent =
    `${cachedAdminPolls.length} total · ${counts.published || 0} published · ${counts.draft || 0} drafts · ${counts.closed || 0} closed · Showing ${filtered.length}`;

  pollList.innerHTML = "";
  if (!filtered.length) {
    pollList.textContent = cachedAdminPolls.length
      ? "No polls match those filters."
      : "No polls created yet.";
    return;
  }

  filtered.forEach(poll => {
    const row = document.createElement("article");
    row.className = "admin-poll-row";
    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = poll.title;
    const meta = document.createElement("p");
    meta.textContent = (poll.category || "COMMUNITY") + " · " + poll.status.toUpperCase();
    details.append(title, meta);
    const actions = document.createElement("div");
    actions.className = "admin-row-actions";
    const edit = document.createElement("button");
    edit.className = "results-button";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editPoll(poll.id));
    actions.append(edit);
    const toggle = document.createElement("button");
    toggle.className = "results-button";
    toggle.textContent = poll.status === "published" ? "Close voting" : poll.status === "closed" ? "Reopen voting" : "Publish";
    toggle.addEventListener("click", async () => {
      const next = poll.status === "published" ? "closed" : "published";
      const { error: updateError } = await client.from("commonpick_polls")
        .update({ status: next, updated_at: new Date().toISOString() }).eq("id", poll.id);
      if (updateError) {
        alert("Could not update poll status: " + updateError.message);
        return;
      }
      await loadAdminPolls();
    });
    actions.append(toggle);

    const remove = document.createElement("button");
    remove.className = "results-button";
    remove.textContent = "Delete";
    remove.addEventListener("click", async () => {
      const confirmed = window.confirm(
        "Permanently delete this poll? Its answer choices will also be deleted. This cannot be undone."
      );
      if (!confirmed) return;
      const { error: deleteError } = await client.from("commonpick_polls").delete().eq("id", poll.id);
      if (deleteError) {
        alert("Could not delete poll: " + deleteError.message);
        return;
      }
      await loadAdminPolls();
    });
    actions.append(remove);
    row.append(details, actions);
    pollList.append(row);
  });
}

async function loadAdminPolls() {
  pollList.textContent = "Loading polls…";
  const { data: polls, error } = await client.from("commonpick_polls")
    .select("id,title,category,status,created_at").order("created_at", { ascending: false });
  if (error) {
    pollList.textContent = "Could not load polls. Confirm that the database setup has been run.";
    console.error(error);
    return;
  }
  cachedAdminPolls = polls || [];
  renderAdminPolls();
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
    ? "You are editing a published poll. Changes to answer choices can affect how existing results are interpreted."
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
  let queueWarning = "";
  if (currentAssistantDraftId) {
    const { error: draftUpdateError } = await client.from("commonpick_assistant_drafts")
      .update({ status: "used", poll_id: pollId, used_at: new Date().toISOString() })
      .eq("id", currentAssistantDraftId);
    if (draftUpdateError) {
      queueWarning = " Poll saved, but the assistant draft queue could not be updated: " + draftUpdateError.message;
      console.error(draftUpdateError);
    }
  }
  resetForm();
  formMessage.textContent = (status === "published" ? "Poll published." : "Poll saved.") + queueWarning;
  await loadAdminPolls();
  await loadAssistantQueue();
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
loadAssistantDraft.addEventListener("click", loadAssistantQueue);
generatePollButton.addEventListener("click", startChatGPTWorkflow);
copyChatgptPrompt.addEventListener("click", async () => {
  if (!chatgptPrompt.value) {
    chatgptPrompt.value = buildChatGPTPrompt();
    if (!chatgptPrompt.value) return;
  }
  try {
    await navigator.clipboard.writeText(chatgptPrompt.value);
    aiPollMessage.textContent = "Prompt copied. Paste it into ChatGPT.";
  } catch {
    chatgptPrompt.focus();
    chatgptPrompt.select();
    aiPollMessage.textContent = "Copy the selected prompt and paste it into ChatGPT.";
  }
});
importChatgptPoll.addEventListener("click", importChatGPTDraft);
aiPollTopic.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    startChatGPTWorkflow();
  }
});
adminPollSearch?.addEventListener("input", renderAdminPolls);
adminPollStatus?.addEventListener("change", renderAdminPolls);

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
    await loadAssistantQueue();
    await loadCategoryRecommendations();
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
    await loadAssistantQueue();
    await loadCategoryRecommendations();
  }
  if (choiceFields.children.length === 0) resetForm();
})();
