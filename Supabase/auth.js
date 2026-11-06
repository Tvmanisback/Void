/* Void OS - Supabase authentication */
(() => {
  'use strict';

  let client = null;
  let initialized = false;

  function getClient() {
    if (client) return client;
    const config = window.VOID_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
    client = window.supabase.createClient(config.url, config.anonKey);
    return client;
  }

  function showMessage(message, type = '') {
    const element = document.getElementById('auth-message');
    if (!element) return;
    element.textContent = message;
    element.className = 'auth-message' + (type ? ' ' + type : '');
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
    if (!form || !signInTab || !signUpTab || !authScreen) {
      throw new Error('Authentication screen elements are missing');
    }

    const supabase = getClient();
    if (supabase) {
      document.getElementById('auth-connection').innerHTML =
        '<span class="connected"></span> Connected to Supabase';
    }

    let mode = 'signin';
    function setMode(next) {
      mode = next;
      const signup = mode === 'signup';
      signInTab.classList.toggle('active', !signup);
      signUpTab.classList.toggle('active', signup);
      nameWrap.hidden = !signup;
      document.getElementById('auth-title').textContent =
        signup ? 'Create your account.' : 'Welcome back.';
      document.getElementById('auth-description').textContent =
        signup ? 'Set up your account to enter Void OS.' : 'Sign in to continue to your desktop.';
      document.getElementById('auth-password').autocomplete =
        signup ? 'new-password' : 'current-password';
      submit.textContent = signup ? 'Create account' : 'Sign in';
      showMessage('');
    }

    signInTab.addEventListener('click', () => setMode('signin'));
    signUpTab.addEventListener('click', () => setMode('signup'));

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const activeClient = getClient();
      if (!activeClient) {
        showMessage('Supabase is not connected yet. Add your Project URL and anon/public key in Supabase/config.js.', 'error');
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

    if (!supabase) {
      authScreen.classList.remove('hidden');
      return;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Supabase session restore failed:', error);
      if (data?.session?.user) onAuthenticated(data.session.user);
      else authScreen.classList.remove('hidden');
    }).catch(error => {
      console.error('Supabase session restore failed:', error);
      authScreen.classList.remove('hidden');
    });
  }

  async function signOut() {
    const supabase = getClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Supabase sign-out failed:', error);
    }
  }

  window.VoidAuth = { init, signOut };
})();
