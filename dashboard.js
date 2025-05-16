// Load user data
const user = JSON.parse(localStorage.getItem('user'));
document.getElementById('user-email').textContent = user.email;

// Connect to backend
const socket = io("https://your-railway-backend.up.railway.app");

// Create new meeting
document.getElementById('new-meeting').addEventListener('click', () => {
  const meetingId = Math.random().toString(36).substring(2, 8).toUpperCase();
  window.location.href = `room.html?room=${meetingId}`;
});

// Join existing meeting
document.getElementById('join-meeting').addEventListener('click', () => {
  const meetingId = document.getElementById('meeting-id').value.trim();
  if (meetingId) {
    window.location.href = `room.html?room=${meetingId}`;
  }
});
