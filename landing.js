// Google Sign-In with proper initialization
function initializeGoogleSignIn() {
  // Load the Google Identity Services library
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  script.onload = () => {
    google.accounts.id.initialize({
      client_id: '1056893297604-rq2ggi6mn3j0q18pjidq0iem3umpsuo6.apps.googleusercontent.com',
      callback: handleCredentialResponse
    });
  };
  document.head.appendChild(script);
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

document.addEventListener('DOMContentLoaded', () => {
  const getStartedBtn = document.getElementById('get-started');
  const signinForm = document.getElementById('signin-form');
  const googleSigninBtn = document.getElementById('google-signin');

  // Show sign-in form with reCAPTCHA
  getStartedBtn.addEventListener('click', () => {
    getStartedBtn.classList.add('hidden');
    signinForm.classList.remove('hidden');
    initializeGoogleSignIn(); // Initialize Google Sign-In when form is shown
  });

  // Google Sign-In button click
  googleSigninBtn.addEventListener('click', () => {
    if (grecaptcha.getResponse()) {
      google.accounts.id.prompt();
    } else {
      alert('Please complete the reCAPTCHA!');
    }
  });
});
