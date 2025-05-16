// Load Google Identity Services immediately when page loads
function loadGoogleIdentityScript() {
  return new Promise((resolve) => {
    if (window.google) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

// Initialize Google Sign-In
function initializeGoogleSignIn() {
  google.accounts.id.initialize({
    client_id: '1056893297604-rq2ggi6mn3j0q18pjidq0iem3umpsuo6.apps.googleusercontent.com',
    callback: handleCredentialResponse,
    ux_mode: 'popup' // Explicitly set to popup mode
  });
}

function handleCredentialResponse(response) {
  try {
    const user = JSON.parse(atob(response.credential.split('.')[1]));
    localStorage.setItem('user', JSON.stringify(user));
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error('Error handling Google response:', error);
    alert('Sign-in failed. Please try again.');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const getStartedBtn = document.getElementById('get-started');
  const signinForm = document.getElementById('signin-form');
  const googleSigninBtn = document.getElementById('google-signin');

  // Pre-load Google script immediately
  await loadGoogleIdentityScript();
  initializeGoogleSignIn();

  // Show sign-in form with reCAPTCHA
  getStartedBtn.addEventListener('click', (e) => {
    e.preventDefault();
    getStartedBtn.classList.add('hidden');
    signinForm.classList.remove('hidden');
  });

  // Google Sign-In button click
  googleSigninBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    if (!grecaptcha.getResponse()) {
      alert('Please complete the reCAPTCHA!');
      return;
    }

    // Render the Google button properly
    google.accounts.id.renderButton(
      googleSigninBtn,
      {
        type: 'standard',
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular'
      }
    );
    
    // Prompt the Google Sign-In flow
    google.accounts.id.prompt();
  });
});
