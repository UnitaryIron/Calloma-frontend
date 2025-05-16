// Join Room (index.html)
document.getElementById("join-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const roomId = document.getElementById("room-id").value;
    localStorage.setItem("username", username);
    window.location.href = `room.html?room=${roomId}`;
  });
  
  // Inside Room (room.html)
  if (window.location.pathname.includes("room.html")) {
    const socket = io("https://calloma-backend-production.up.railway.app");
    const roomId = new URLSearchParams(window.location.search).get("room");
    const username = localStorage.getItem("username");
    const videoGrid = document.getElementById("video-grid");
    const localVideo = document.getElementById("local-video");
  
    let peerConnections = {};
    let localStream;
  
    // Get user media (video/audio)
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        localStream = stream;
        localVideo.srcObject = stream;
  
        socket.emit("join-room", roomId, socket.id);
  
        // Handle new users
        socket.on("user-connected", userId => {
          if (userId === socket.id) return;
          createPeerConnection(userId, stream);
        });
  
        // Handle signals
        socket.on("signal", (fromId, signal) => {
          if (signal.type === "offer") {
            handleOffer(fromId, signal.offer);
          } else if (signal.type === "answer") {
            handleAnswer(fromId, signal.answer);
          } else if (signal.candidate) {
            handleCandidate(fromId, signal.candidate);
          }
        });
  
        // Handle user disconnect
        socket.on("user-disconnected", userId => {
          const videoEl = document.getElementById(`remote-${userId}`);
          if (videoEl) videoEl.remove();
          if (peerConnections[userId]) peerConnections[userId].close();
          delete peerConnections[userId];
        });
  
        // Chat
        document.getElementById("send-btn").addEventListener("click", sendMessage);
        document.getElementById("chat-input").addEventListener("keypress", (e) => {
          if (e.key === "Enter") sendMessage();
        });
      });
  
    // Create peer connection
    function createPeerConnection(userId, stream) {
      const peer = new RTCPeerConnection();
      peerConnections[userId] = peer;
  
      // Add local stream
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
  
      // Handle ICE candidates
      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("signal", userId, { candidate: e.candidate });
        }
      };
  
      // Handle remote stream
      peer.ontrack = (e) => {
        const remoteVideo = document.createElement("video");
        remoteVideo.id = `remote-${userId}`;
        remoteVideo.autoplay = true;
        remoteVideo.srcObject = e.streams[0];
        videoGrid.appendChild(remoteVideo);
      };
  
      // Create offer
      peer.createOffer()
        .then(offer => peer.setLocalDescription(offer))
        .then(() => {
          socket.emit("signal", userId, { type: "offer", offer: peer.localDescription });
        });
    }
  
    // Handle incoming offers
    function handleOffer(fromId, offer) {
      const peer = new RTCPeerConnection();
      peerConnections[fromId] = peer;
  
      // Add local stream
      localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
  
      peer.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("signal", fromId, { candidate: e.candidate });
        }
      };
  
      peer.ontrack = (e) => {
        const remoteVideo = document.createElement("video");
        remoteVideo.id = `remote-${fromId}`;
        remoteVideo.autoplay = true;
        remoteVideo.srcObject = e.streams[0];
        videoGrid.appendChild(remoteVideo);
      };
  
      peer.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peer.createAnswer())
        .then(answer => peer.setLocalDescription(answer))
        .then(() => {
          socket.emit("signal", fromId, { type: "answer", answer: peer.localDescription });
        });
    }
  
    // Handle answers & ICE candidates
    function handleAnswer(fromId, answer) {
      peerConnections[fromId].setRemoteDescription(new RTCSessionDescription(answer));
    }
  
    function handleCandidate(fromId, candidate) {
      peerConnections[fromId].addIceCandidate(new RTCIceCandidate(candidate));
    }
  
    // Chat function
    function sendMessage() {
      const input = document.getElementById("chat-input");
      const message = input.value.trim();
      if (message) {
        socket.emit("chat-message", roomId, `${username}: ${message}`);
        input.value = "";
      }
    }
  
    socket.on("chat-message", (msg) => {
      const messages = document.getElementById("messages");
      messages.innerHTML += `<div>${msg}</div>`;
      messages.scrollTop = messages.scrollHeight;
    });
  
    // Screen sharing
    document.getElementById("share-btn").addEventListener("click", () => {
      navigator.mediaDevices.getDisplayMedia({ video: true })
        .then(screenStream => {
          const screenTrack = screenStream.getVideoTracks()[0];
          Object.values(peerConnections).forEach(peer => {
            const sender = peer.getSenders().find(s => s.track.kind === "video");
            if (sender) sender.replaceTrack(screenTrack);
          });
        });
    });
  
    // Mute/Video toggle
    document.getElementById("mute-btn").addEventListener("click", () => {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      document.getElementById("mute-btn").textContent = 
        audioTrack.enabled ? "🎤 Mute" : "🔇 Unmute";
    });
  
    document.getElementById("video-btn").addEventListener("click", () => {
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
      document.getElementById("video-btn").textContent = 
        videoTrack.enabled ? "🎥 Stop Video" : "📹 Start Video";
    });

    // Landing Page Logic
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
  
    // Leave call
    document.getElementById("leave-btn").addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }
