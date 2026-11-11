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
  const categories = [...new Set(polls.map(p => (p.category || "COMMUNITY").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  let selectedCategory = "ALL";
  let searchTerm = "";

  pollList.innerHTML = `
    <div class="poll-discovery">
      <label class="poll-search-label" for="poll-search">FIND A POLL</label>
      <input id="poll-search" class="poll-search" type="search" placeholder="Search questions, topics, or choices…" autocomplete="off">
      <label class="poll-search-label" for="poll-category-filter">CATEGORY</label>
      <select id="poll-category-filter" class="poll-category-filter">
        <option value="ALL">All categories</option>
      </select>
      <p class="poll-filter-count" id="poll-filter-count" aria-live="polite"></p>
    </div>
    <div class="poll-highlights" id="poll-highlights"></div>
    <div class="poll-list-results" id="poll-list-results"></div>`;

  const searchInput = document.getElementById("poll-search");
  const categoryFilter = document.getElementById("poll-category-filter");
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  });
  const filterCount = document.getElementById("poll-filter-count");
  const resultsContainer = document.getElementById("poll-list-results");
  const highlightsContainer = document.getElementById("poll-highlights");

  function renderHighlights(visiblePolls) {
    const voteCount = poll => (votes || []).filter(v => v.poll_id === poll.id).length;
    const trending = [...visiblePolls].sort((a, b) => voteCount(b) - voteCount(a) || new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);
    const newest = [...visiblePolls].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3);

    function sectionMarkup(title, eyebrow, items) {
      const cards = items.map(poll => `
        <a class="highlight-card" href="#poll-${escapeHtml(poll.id)}">
          <span class="highlight-category">${escapeHtml(poll.category || "COMMUNITY")}</span>
          <strong>${escapeHtml(poll.title)}</strong>
          <span class="highlight-meta">${voteCount(poll).toLocaleString()} COMMUNITY VOTES <span>↗</span></span>
        </a>`).join("");
      return `
        <section class="highlight-section">
          <div class="highlight-heading"><span>${eyebrow}</span><h3>${title}</h3></div>
          <div class="highlight-grid">${cards || '<p class="highlight-empty">No polls to show yet.</p>'}</div>
        </section>`;
    }

    highlightsContainer.innerHTML =
      sectionMarkup("Trending", "MOST VOTED", trending) +
      sectionMarkup("Newest", "JUST PUBLISHED", newest);
  }

  function renderPollCards() {
    const normalizedSearch = searchTerm.toLowerCase();
    const filteredPolls = polls.filter(poll => {
      const category = (poll.category || "COMMUNITY").trim();
      const pollOptions = (options || []).filter(o => o.poll_id === poll.id);
      const searchable = [poll.title, poll.description, category, ...pollOptions.map(o => o.label)]
        .join(" ").toLowerCase();
      return (selectedCategory === "ALL" || category === selectedCategory)
        && searchable.includes(normalizedSearch);
    });

    filterCount.textContent = filteredPolls.length + (filteredPolls.length === 1 ? " poll found" : " polls found");
    renderHighlights(filteredPolls);
    resultsContainer.innerHTML = "";
    if (!filteredPolls.length) {
      resultsContainer.innerHTML = '<div class="empty-polls filter-empty">No polls match those filters. Try another search or category.</div>';
      return;
    }

    filteredPolls.forEach((poll, index) => {
      const pollOptions = (options || []).filter(o => o.poll_id === poll.id);
      const pollVotes = (votes || []).filter(v => v.poll_id === poll.id);
      const alreadyVoted = myVotes.has(poll.id);
      const card = document.createElement("article");
      card.className = "poll-card";
      card.id = "poll-" + poll.id;
      card.innerHTML = `
        <div class="poll-card-intro">
          <div class="poll-kicker">${escapeHtml(poll.category || "COMMUNITY")} <span>•</span> COMMUNITY POLL ${String(index + 1).padStart(3,"0")}</div>
          <h3>${escapeHtml(poll.title)}</h3>
          <p>${escapeHtml(poll.description || "Cast your vote and see where the community stands.")}</p>
          <div class="poll-count"><strong>${pollVotes.length.toLocaleString()}</strong><span>COMMUNITY VOTES</span></div>
        </div>
        <div class="poll-card-options">
          <div class="options-label"><span>${alreadyVoted ? "COMMUNITY RESULTS" : "MAKE YOUR PICK"}</span><span>${pollOptions.length} CHOICES</span></div>
          <div class="results-summary" data-results-summary aria-live="polite"></div>
          <div class="options" data-options></div>
          <div class="poll-actions">
            <button class="vote-button" data-vote disabled>${alreadyVoted ? "Vote recorded" : "Cast my vote"} <span>↗</span></button>
            <button class="results-button" data-results>View results</button>
          </div>
          <p class="status" data-status aria-live="polite">${alreadyVoted ? "You've already voted on this poll from this browser." : "Choose one option to cast your vote."}</p>
        </div>`;
      const optionsContainer = card.querySelector("[data-options]");
      const resultsSummary = card.querySelector("[data-results-summary]");
      const voteButton = card.querySelector("[data-vote]");
      const resultsButton = card.querySelector("[data-results]");
      const status = card.querySelector("[data-status]");
      let selected = null;
      let showResults = alreadyVoted;

      function renderOptions() {
        optionsContainer.innerHTML = "";
        const optionCounts = pollOptions.map(option => ({
          option,
          count: pollVotes.filter(v => v.option_id === option.option_id).length
        }));
        const highestCount = Math.max(0, ...optionCounts.map(item => item.count));
        const leaders = optionCounts.filter(item => item.count === highestCount && highestCount > 0);
        if (showResults) {
          if (!pollVotes.length) {
            resultsSummary.textContent = "No votes have been cast yet.";
          } else if (leaders.length > 1) {
            resultsSummary.textContent = `Tied · ${highestCount.toLocaleString()} votes each · ${pollVotes.length.toLocaleString()} total votes`;
          } else {
            resultsSummary.textContent = `Leading: ${leaders[0].option.label} · ${highestCount.toLocaleString()} votes · ${pollVotes.length.toLocaleString()} total votes`;
          }
          resultsSummary.hidden = false;
        } else {
          resultsSummary.hidden = true;
          resultsSummary.textContent = "";
        }
        pollOptions.forEach((option, i) => {
          const count = optionCounts[i].count;
          const pct = pollVotes.length ? Math.round(count / pollVotes.length * 100) : 0;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "option" + (selected === option.option_id ? " selected" : "");
          button.disabled = showResults;
          button.innerHTML = `
            <span class="option-result" style="width:${showResults ? pct : 0}%"></span>
            <span class="option-main"><span class="option-letter">${String.fromCharCode(65 + i % 26)}</span><span>${escapeHtml(option.label)}</span></span>
            <span class="option-percent">${showResults ? pct + "% · " + count.toLocaleString() + (count === 1 ? " vote" : " votes") : selected === option.option_id ? "SELECTED" : "CHOOSE"}</span>`;
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
      resultsContainer.append(card);
    });
  }

  searchInput.addEventListener("input", () => {
    searchTerm = searchInput.value.trim();
    renderPollCards();
  });
  categoryFilter.addEventListener("change", () => {
    selectedCategory = categoryFilter.value;
    renderPollCards();
  });
  renderPollCards();

  feedStatus.textContent = "";
}

const recommendationForm = document.getElementById("category-recommendation-form");
if (recommendationForm) {
  recommendationForm.addEventListener("submit", async event => {
    event.preventDefault();
    const input = document.getElementById("category-recommendation-input");
    const status = document.getElementById("category-recommendation-status");
    const category = input.value.trim().replace(/\s+/g, " ");
    if (category.length < 2 || category.length > 60) {
      status.textContent = "Please enter a category between 2 and 60 characters.";
      return;
    }
    const submit = recommendationForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    status.textContent = "Submitting…";
    const { error } = await client.from("commonpick_category_recommendations").insert({ category });
    submit.disabled = false;
    if (error) {
      status.textContent = "Your recommendation could not be submitted. Please try again.";
      console.error(error);
      return;
    }
    input.value = "";
    status.textContent = "Thanks. Your category recommendation has been sent.";
  });
}

loadPolls();
