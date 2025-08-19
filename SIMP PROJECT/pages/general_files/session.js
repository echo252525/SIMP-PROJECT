import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://gxydxmobwrccqagltlci.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4eWR4bW9id3JjY3FhZ2x0bGNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDMzOTMsImV4cCI6MjA3MDcxOTM5M30.Zk2xUlmlPGbe-7rDsqC486Js9LGFMMOp-fytNZSwzBs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Checks the current session depending on the page type
 * - If on a protected page (like dashboard) and not logged in → redirect to login
 * - If on login page and already logged in → redirect to dashboard
 */
(async function checkSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = window.location.pathname;

  if (!session) {
    // If user is not logged in but on a protected page → redirect
    if (!path.includes("login.html")) {
      window.location.replace("../../../index.html");
    }
  } else {
    // If user IS logged in but tries to visit login page → redirect to dashboard
    if (path.includes("login.html")) {
      window.location.replace("dashboard.html");
    }
  }
})();

// Attach logout logic if logout button exists on this page
document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.replace("../../../index.html");
      } catch (err) {
        alert("Logout failed: " + err.message);
        console.error(err);
      }
    });
  }
});
