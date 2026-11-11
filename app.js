// CommonPick: browser-safe public configuration only. Never put a Supabase service-role key here.
const SUPABASE_URL = "https://zrjqmcgulgypqgoygbvx.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "sb_publishable_BRuQrQwfwlQhAXnx9uuabA_XPje_3Ew";
const POLL_ID = "11111111-1111-4111-8111-111111111111";

const contenders = [
  { id: "mcdonalds", name: "McDonald's" },
  { id: "chick-fil-a", name: "Chick-fil-A" },
  { id: "five-guys", name: "Five Guys" },
  { id: "wendys", name: "Wendy's" }
];

const optionsEl = document.getElementById("options");
const voteButton = document.getElementById("vote-button");
const resultsButton = document.getElementById("results-button");
const statusEl = document.getElementById("status");
const countEl = document.getElementById("vote-count");
let selected = null;
let showResults = false;
let client = null;
let totalVotes = 0;
let counts = {};

function voterId() {
  let id = localStorage.getItem("commonpick_voter");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("commonpick_voter", id);
  }
  return id;
}
function configured() {
  return SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("PASTE_") &&
    !SUPABASE_ANON_KEY.includes("PASTE_") &&
    window.supabase;
}
function render() {
  optionsEl.innerHTML = "";
  contenders.forEach((item, index) => {
    const votes = counts[item.id] || 0;
    const pct = totalVotes ? Math.round(votes / totalVotes * 100) : 0;
    const button = document.createElement("button");
    button.className = "option" + (selected === item.id ? " selected" : "");
    button.type = "button";
    button.disabled = showResults || !client;
    const main = document.createElement("span");
    main.className = "option-main";
    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.textContent = String.fromCharCode(65 + index);
    const name = document.createElement("span");
    name.textContent = item.name;
    main.append(letter, name);
    const bar = document.createElement("span");
    bar.className = "option-result";
    bar.style.width = showResults ? pct + "%" : "0%";
    const percent = document.createElement("span");
    percent.className = "option-percent";
    percent.textContent = showResults ? `${pct}% · ${votes}` : (selected === item.id ? "SELECTED" : "CHOOSE");
    button.append(bar, main, percent);
    button.addEventListener("click", () => {
      if (showResults) return;
      selected = item.id;
      voteButton.disabled = false;
      render();
    });
    optionsEl.append(button);
  });
  countEl.textContent = totalVotes.toLocaleString();
  voteButton.disabled = !selected || showResults || !client;
  voteButton.textContent = showResults ? "Vote submitted" : "Cast my vote ↗";
}
async function loadResults() {
  if (!client) return;
  const { data, error } = await client.from("commonpick_votes").select("option_id");
  if (error) {
    statusEl.textContent = "Couldn't load votes yet. Check the database setup.";
    return;
  }
  counts = {};
  data.forEach(row => counts[row.option_id] = (counts[row.option_id] || 0) + 1);
  totalVotes = data.length;
  render();
}
async function init() {
  if (!configured()) {
    render();
    statusEl.textContent = "The site is ready for its database connection. Follow the setup instructions in README.";
    return;
  }
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: existing, error } = await client.from("commonpick_votes")
    .select("option_id").eq("poll_id", POLL_ID).eq("voter_id", voterId()).maybeSingle();
  if (error) statusEl.textContent = "Database connected; finish the SQL setup if this is a new project.";
  if (existing) {
    showResults = true;
    statusEl.textContent = "You've already voted on this device. Here are the results.";
    voteButton.textContent = "Vote submitted";
  } else {
    statusEl.textContent = "Choose your favorite, then cast your vote.";
  }
  await loadResults();
  if (existing) render();
}
voteButton.addEventListener("click", async () => {
  if (!selected || !client) return;
  voteButton.disabled = true;
  statusEl.textContent = "Submitting your vote…";
  const { error } = await client.from("commonpick_votes").insert({
    poll_id: POLL_ID, option_id: selected, voter_id: voterId()
  });
  if (error) {
    statusEl.textContent = error.code === "23505"
      ? "A vote has already been recorded from this browser."
      : "Vote couldn't be submitted. Please try again.";
    voteButton.disabled = false;
    return;
  }
  showResults = true;
  statusEl.textContent = "Your vote is in. Here's where the community stands.";
  await loadResults();
  render();
});
resultsButton.addEventListener("click", async () => {
  showResults = true;
  selected = null;
  statusEl.textContent = "Community results. Voting is disabled in this view.";
  await loadResults();
  render();
});
init();
