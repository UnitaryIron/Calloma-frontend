if (window.location.pathname.includes("room.html")) {
  const socket = io("https://calloma-backend-production.up.railway.app", {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });

 const socket = io("https://calloma-backend-production.up.railway.app");
const roomId = new URLSearchParams(window.location.search).get('room');
const videoGrid = document.getElementById('video-grid');
const localVideo = document.getElementById('local-video');

let peerConnections = {};
let localStream;

// 1. Initialize Room
async function initRoom() {
  try {
    // Get user media
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    localVideo.srcObject = localStream;

    // Join the room
    socket.emit('join-room', roomId, socket.id);

    // Setup event listeners
    setupEventListeners();
    setupSocketEvents();

  } catch (err) {
    console.error("Room initialization failed:", err);
    alert("Could not access camera/microphone. Please check permissions.");
    window.location.href = 'index.html';
  }
}

// 2. Enhanced Socket Events
function setupSocketEvents() {
  // When new user joins
  socket.on('user-connected', userId => {
    if (userId === socket.id) return;
    createPeerConnection(userId, true);
  });

  // Get existing users when you join
  socket.on('existing-users', userIds => {
    userIds.forEach(userId => {
      if (userId !== socket.id && !peerConnections[userId]) {
        createPeerConnection(userId, false);
      }
    });
  });

  // Handle signaling
  socket.on('signal', (fromId, signal) => {
    if (!peerConnections[fromId]) {
      createPeerConnection(fromId, false);
    }
    handleSignal(fromId, signal);
  });

  // When user leaves
  socket.on('user-disconnected', userId => {
    if (peerConnections[userId]) {
      peerConnections[userId].close();
      delete peerConnections[userId];
      removeVideoElement(userId);
    }
  });
}

// 3. Improved Peer Connection Management
function createPeerConnection(userId, isInitiator) {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
      // Add TURN server here if needed
    ]
  });

  peerConnections[userId] = pc;

  // Add local stream tracks
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  // ICE Candidate handling
  pc.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('signal', userId, { candidate: e.candidate });
    }
  };

  // Remote stream handling
  pc.ontrack = e => {
    addVideoElement(userId, e.streams[0]);
  };

  // Create offer if initiator
  if (isInitiator) {
    createOffer(userId);
  }
}

async function createOffer(userId) {
  const pc = peerConnections[userId];
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('signal', userId, { type: 'offer', offer });
  } catch (err) {
    console.error("Offer creation failed:", err);
  }
}

async function handleSignal(fromId, signal) {
  const pc = peerConnections[fromId];
  try {
    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', fromId, { type: 'answer', answer });
    } else if (signal.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
    } else if (signal.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  } catch (err) {
    console.error("Signal handling failed:", err);
  }
}

// 4. Video Element Management
function addVideoElement(userId, stream) {
  removeVideoElement(userId); // Remove if already exists
  const video = document.createElement('video');
  video.id = `video-${userId}`;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  videoGrid.appendChild(video);
}

function removeVideoElement(userId) {
  const video = document.getElementById(`video-${userId}`);
  if (video) {
    video.srcObject?.getTracks()?.forEach(track => track.stop());
    video.remove();
  }
}

// 5. Initialize
if (roomId) {
  initRoom();
} else {
  window.location.href = 'index.html';
}
  window.addEventListener("load", initRoom);
}
