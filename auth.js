/* Void OS - Supabase authentication */
(() => {
  'use strict';

  let client = null;
  let initialized = false;

  function getClient() {
    if (client) return client;
    const config = window.VOID_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
    try {
      client = window.supabase.createClient(config.url, config.anonKey);
    } catch (e) {
      console.error('Supabase client create failed:', e);
      return null;
    }
    return client;
  }

  function showMessage(message, type = '') {
    const element = document.getElementById('auth-message');
    if (!element) return;
    element.textContent = message;
    element.className = 'auth-message' + (type ? ' ' + type : '');
  }

  function setConnectionStatus(html) {
    const el = document.getElementById('auth-connection');
    if (el) el.innerHTML = html;
  }

  function init(onAuthenticated) {
    if (initialized) return;
    initialized = true;
    const form = document.getElementById('auth-form');
    const signInTab = document.getElementById('auth-signin-tab');
    const signUpTab = document.getElementById('auth-signup-tab');
    const nameWrap = document.getElementById('auth-name-wrap');
    const submit = document.getElementById('auth-submit');
    const authScreen = document.getElementById('auth-screen');
    const guestBtn = document.getElementById('auth-guest');
    if (!form || !signInTab || !signUpTab || !authScreen) {
      throw new Error('Authentication screen elements are missing');
    }

    // Always show auth UI quickly — never leave user on blank/checking forever
    authScreen.classList.remove('hidden');

    const supabase = getClient();
    if (supabase) {
      setConnectionStatus('<span class="connected"></span> Connected to Supabase');
    } else {
      setConnectionStatus('<span></span> Offline mode — use Guest to continue');
    }

    let mode = 'signin';
    function setMode(next) {
      mode = next;
      const signup = mode === 'signup';
      signInTab.classList.toggle('active', !signup);
      signUpTab.classList.toggle('active', signup);
      nameWrap.hidden = !signup;
      document.getElementById('auth-title').textContent =
        signup ? 'Join Void OS.' : 'Welcome back.';
      document.getElementById('auth-description').textContent =
        signup ? 'Create an account to get started.' : 'Sign in to open your desktop.';
      document.getElementById('auth-password').autocomplete =
        signup ? 'new-password' : 'current-password';
      submit.textContent = signup ? 'Create account' : 'Sign in';
      showMessage('');
    }

    signInTab.addEventListener('click', () => setMode('signin'));
    signUpTab.addEventListener('click', () => setMode('signup'));

    // Guest bypass — always works, no network required
    if (guestBtn) {
      guestBtn.addEventListener('click', (e) => {
        e.preventDefault();
        onAuthenticated({
          email: 'guest@void.local',
          user_metadata: { display_name: 'Guest' }
        });
      });
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const activeClient = getClient();
      if (!activeClient) {
        showMessage('Sign-in unavailable. Click Continue as Guest instead.', 'error');
        return;
      }

      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const displayName = document.getElementById('auth-name').value.trim();
      submit.disabled = true;
      submit.textContent = mode === 'signup' ? 'Creating account…' : 'Signing in…';
      showMessage('');

      try {
        const result = mode === 'signup'
          ? await activeClient.auth.signUp({
              email,
              password,
              options: { data: { display_name: displayName || email.split('@')[0] } }
            })
          : await activeClient.auth.signInWithPassword({ email, password });

        if (result.error) throw result.error;
        if (mode === 'signup' && !result.data.session) {
          showMessage('Account created. Check your email to confirm it, then sign in.', 'success');
        } else if (result.data.user) {
          onAuthenticated(result.data.user);
        }
      } catch (error) {
        showMessage(error.message || 'Authentication failed. Please try again.', 'error');
      } finally {
        submit.disabled = false;
        submit.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
      }
    });

    if (!supabase) return;

    // Session restore with timeout so we never hang on "Checking…"
    const timeout = new Promise(resolve => setTimeout(() => resolve({ data: { session: null }, error: null }), 4000));
    Promise.race([supabase.auth.getSession(), timeout])
      .then(({ data, error }) => {
        if (error) console.error('Supabase session restore failed:', error);
        if (data?.session?.user) onAuthenticated(data.session.user);
      })
      .catch(error => {
        console.error('Supabase session restore failed:', error);
        setConnectionStatus('<span></span> Could not reach sign-in service — use Guest');
      });
  }

  async function signOut() {
    const supabase = getClient();
    if (supabase) {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Supabase sign-out failed:', error);
      } catch (e) {
        console.error(e);
      }
    }
  }

  async function getAccessToken() {
    const supabase = getClient();
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data?.session?.access_token || null;
  }

  window.VoidAuth = { init, signOut, getAccessToken };
})();
