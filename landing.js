document.addEventListener('DOMContentLoaded', () => {
  const getStartedBtn = document.getElementById('get-started');
  const signinForm = document.getElementById('signin-form');
  const googleSigninBtn = document.getElementById('google-signin');

  // Show sign-in form with reCAPTCHA
  getStartedBtn.addEventListener('click', () => {
    getStartedBtn.classList.add('hidden');
    signinForm.classList.remove('hidden');
  });

  // Google Sign-In
  googleSigninBtn?.addEventListener('click', () => {
    // Verify reCAPTCHA first
    if (grecaptcha.getResponse()) {
      // Implement Google Sign-In
      google.accounts.id.initialize({
        client_id: '1056893297604-vonoqltql1odccv0vh154dgl6mhmttl4.apps.googleusercontent.com',
        callback: (response) => {
          const user = JSON.parse(atob(response.credential.split('.')[1]));
          localStorage.setItem('user', JSON.stringify(user));
          window.location.href = 'dashboard.html';
        }
      });
      google.accounts.id.prompt();
    } else {
      alert('Please complete the reCAPTCHA!');
    }
  });
});
