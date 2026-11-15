const SUPABASE_URL = "https://zrjqmcgulgypqgoygbvx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_BRuQrQwfwlQhAXnx9uuabA_XPje_3Ew";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const signupForm = document.getElementById("account-signup-form");
const signinForm = document.getElementById("account-signin-form");
const signupStatus = document.getElementById("account-signup-status");
const signinStatus = document.getElementById("account-signin-status");
const currentPanel = document.getElementById("account-current");
const switchSignup = document.getElementById("show-signup");
const switchSignin = document.getElementById("show-signin");

function showMode(mode) {
  const signingIn = mode === "signin";
  signupForm.hidden = signingIn;
  signinForm.hidden = !signingIn;
  switchSignin.closest(".account-switch").hidden = signingIn;
  signinForm.querySelector(".account-switch").hidden = !signingIn;
  signupStatus.textContent = "";
  signinStatus.textContent = "";
}

function renderAccount(session) {
  const user = session?.user;
  if (!user || user.is_anonymous) {
    currentPanel.hidden = true;
    signupForm.hidden = false;
    return;
  }

  currentPanel.hidden = false;
  currentPanel.innerHTML = "";
  const heading = document.createElement("strong");
  heading.textContent = "Your CommonPick account";
  const details = document.createElement("p");
  details.textContent = user.email ? "Connected as " + user.email : "Your account is active.";
  const signOutButton = document.createElement("button");
  signOutButton.type = "button";
  signOutButton.className = "results-button";
  signOutButton.textContent = "Sign out";
  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    const { error } = await client.auth.signOut();
    if (error) {
      signupStatus.textContent = error.message;
      signOutButton.disabled = false;
      return;
    }
    window.location.reload();
  });
  currentPanel.append(heading, details, signOutButton);
  signupForm.hidden = true;
  signinForm.hidden = true;
  switchSignin.closest(".account-switch").hidden = true;
}

signupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.getElementById("account-signup-email").value.trim().toLowerCase();
  signupStatus.textContent = "Setting up your account…";
  const submit = signupForm.querySelector('button[type="submit"]');
  submit.disabled = true;

  try {
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;

    if (session?.user?.is_anonymous) {
      const { error } = await client.auth.updateUser({ email });
      if (error) throw error;
      signupStatus.textContent = "Check your inbox to verify your email. Your guest voting identity and votes stay connected to this account.";
    } else if (session?.user?.email) {
      signupStatus.textContent = "You're already signed in as " + session.user.email + ".";
    } else {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + "/account.html",
          shouldCreateUser: true
        }
      });
      if (error) throw error;
      signupStatus.textContent = "Check your inbox for a secure link to finish creating your account.";
    }
  } catch (error) {
    signupStatus.textContent = error.message || "We couldn't create your account. Please try again.";
  } finally {
    submit.disabled = false;
  }
});

signinForm.addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.getElementById("account-signin-email").value.trim().toLowerCase();
  signinStatus.textContent = "Sending your sign-in link…";
  const submit = signinForm.querySelector('button[type="submit"]');
  submit.disabled = true;

  try {
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/account.html",
        shouldCreateUser: false
      }
    });
    if (error) throw error;
    signinStatus.textContent = "Check your inbox for your secure sign-in link.";
  } catch (error) {
    signinStatus.textContent = error.message || "We couldn't send your sign-in link. Please try again.";
  } finally {
    submit.disabled = false;
  }
});

switchSignin.addEventListener("click", () => showMode("signin"));
switchSignup.addEventListener("click", () => showMode("signup"));

client.auth.onAuthStateChange((_event, session) => {
  renderAccount(session);
});

client.auth.getSession().then(({ data, error }) => {
  if (error) {
    signupStatus.textContent = error.message;
    return;
  }
  renderAccount(data.session);
});
