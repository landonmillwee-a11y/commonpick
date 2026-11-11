// CommonPick public poll feed. Only publishable Supabase credentials belong here.
const SUPABASE_URL = "https://zrjqmcgulgypqgoygbvx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BRuQrQwfwlQhAXnx9uuabA_XPje_3Ew";

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const pollList = document.getElementById("poll-list");
const feedStatus = document.getElementById("feed-status");

function voterId() {
  let id = localStorage.getItem("commonpick_voter");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("commonpick_voter", id);
  }
  return id;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[ch]);
}

async function loadPolls() {
  feedStatus.textContent = "Loading community polls…";
  const { data: polls, error } = await client
    .from("commonpick_polls")
    .select("id,title,description,category,status,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    feedStatus.textContent = "Polls could not be loaded. Check the database setup.";
    console.error(error);
    return;
  }

  if (!polls || polls.length === 0) {
    pollList.innerHTML = '<div class="empty-polls">No polls are live right now. Check back soon.</div>';
    feedStatus.textContent = "";
    return;
  }

  const { data: options, error: optionError } = await client
    .from("commonpick_options")
    .select("poll_id,option_id,label,position")
    .order("position", { ascending: true });

  if (optionError) {
    feedStatus.textContent = "Poll choices could not be loaded.";
    console.error(optionError);
    return;
  }

  const { data: votes, error: voteError } = await client
    .from("commonpick_votes")
    .select("poll_id,option_id,voter_id");

  if (voteError) {
    feedStatus.textContent = "Vote totals could not be loaded.";
    console.error(voteError);
    return;
  }

  const myVotes = new Set((votes || []).filter(v => v.voter_id === voterId()).map(v => v.poll_id));
  pollList.innerHTML = "";

  polls.forEach((poll, index) => {
    const pollOptions = (options || []).filter(o => o.poll_id === poll.id);
    const pollVotes = (votes || []).filter(v => v.poll_id === poll.id);
    const alreadyVoted = myVotes.has(poll.id);
    const card = document.createElement("article");
    card.className = "poll-card";
    card.innerHTML = `
      <div class="poll-card-intro">
        <div class="poll-kicker">${escapeHtml(poll.category)} <span>•</span> COMMUNITY POLL ${String(index + 1).padStart(3,"0")}</div>
        <h3>${escapeHtml(poll.title)}</h3>
        <p>${escapeHtml(poll.description || "Cast your vote and see where the community stands.")}</p>
        <div class="poll-count"><strong>${pollVotes.length.toLocaleString()}</strong><span>COMMUNITY VOTES</span></div>
      </div>
      <div class="poll-card-options">
        <div class="options-label"><span>${alreadyVoted ? "COMMUNITY RESULTS" : "MAKE YOUR PICK"}</span><span>${pollOptions.length} CHOICES</span></div>
        <div class="options" data-options></div>
        <div class="poll-actions">
          <button class="vote-button" data-vote disabled>${alreadyVoted ? "Vote recorded" : "Cast my vote"} <span>↗</span></button>
          <button class="results-button" data-results>View results</button>
        </div>
        <p class="status" data-status aria-live="polite">${alreadyVoted ? "You've already voted on this poll from this browser." : "Choose one option to cast your vote."}</p>
      </div>`;
    const optionsContainer = card.querySelector("[data-options]");
    const voteButton = card.querySelector("[data-vote]");
    const resultsButton = card.querySelector("[data-results]");
    const status = card.querySelector("[data-status]");
    let selected = null;
    let showResults = alreadyVoted;

    function renderOptions() {
      optionsContainer.innerHTML = "";
      pollOptions.forEach((option, i) => {
        const count = pollVotes.filter(v => v.option_id === option.option_id).length;
        const pct = pollVotes.length ? Math.round(count / pollVotes.length * 100) : 0;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option" + (selected === option.option_id ? " selected" : "");
        button.disabled = showResults;
        button.innerHTML = `
          <span class="option-result" style="width:${showResults ? pct : 0}%"></span>
          <span class="option-main"><span class="option-letter">${String.fromCharCode(65 + i % 26)}</span><span>${escapeHtml(option.label)}</span></span>
          <span class="option-percent">${showResults ? pct + "% · " + count : selected === option.option_id ? "SELECTED" : "CHOOSE"}</span>`;
        button.addEventListener("click", () => {
          selected = option.option_id;
          voteButton.disabled = false;
          renderOptions();
        });
        optionsContainer.append(button);
      });
      voteButton.disabled = !selected || showResults;
      voteButton.textContent = showResults ? "Vote recorded" : "Cast my vote ↗";
    }

    voteButton.addEventListener("click", async () => {
      if (!selected || showResults) return;
      voteButton.disabled = true;
      status.textContent = "Submitting your vote…";
      const { error } = await client.from("commonpick_votes").insert({
        poll_id: poll.id,
        option_id: selected,
        voter_id: voterId()
      });
      if (error) {
        status.textContent = error.code === "23505"
          ? "A vote has already been recorded from this browser."
          : "Your vote could not be submitted. Please try again.";
        console.error(error);
        voteButton.disabled = false;
        return;
      }
      status.textContent = "Your vote is in. Here are the community results.";
      await loadPolls();
    });

    resultsButton.addEventListener("click", () => {
      showResults = true;
      selected = null;
      status.textContent = "Community results. Voting is disabled in this view.";
      renderOptions();
    });

    renderOptions();
    pollList.append(card);
  });

  feedStatus.textContent = "";
}

loadPolls();
