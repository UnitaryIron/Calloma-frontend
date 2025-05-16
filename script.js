// Inside Room (room.html)
if (window.location.pathname.includes("room.html")) {
  const socket = io("https://calloma-backend-production.up.railway.app", {
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  
  const roomId = new URLSearchParams(window.location.search).get("room");
  const username = localStorage.getItem("username") || "Anonymous";
  const videoGrid = document.getElementById("video-grid");
  const localVideo = document.getElementById("local-video");

  let peerConnections = {};
  let localStream;
  let isScreenSharing = false;

  // Initialize the room
  async function initRoom() {
    try {
      // Get user media
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      localVideo.srcObject = localStream;
      socket.emit("join-room", roomId, socket.id);

      setupEventListeners();
      setupSocketEvents();
      
    } catch (error) {
      console.error("Error accessing media devices:", error);
      alert("Could not access camera/microphone. Please check permissions.");
    }
  }

  // Set up all event listeners
  function setupEventListeners() {
    // Mute/Video toggle
    document.getElementById("mute-btn").addEventListener("click", toggleMute);
    document.getElementById("video-btn").addEventListener("click", toggleVideo);
    document.getElementById("share-btn").addEventListener("click", toggleScreenShare);
    document.getElementById("leave-btn").addEventListener("click", leaveRoom);
    
    // Chat functionality
    document.getElementById("send-btn").addEventListener("click", sendMessage);
    document.getElementById("chat-input").addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }

  // Set up socket.io events
  function setupSocketEvents() {
    // Handle new users
    socket.on("user-connected", userId => {
      if (userId === socket.id) return;
      createPeerConnection(userId, localStream);
    });

    // Handle signaling
    socket.on("signal", (fromId, signal) => {
      if (!peerConnections[fromId]) {
        createPeerConnection(fromId, localStream);
      }
      
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
      removeRemoteVideo(userId);
    });

    // Handle chat messages
    socket.on("chat-message", (msg) => {
      displayMessage(msg);
    });
  }

  // Create peer connection
  function createPeerConnection(userId, stream) {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        // Add your TURN server here if needed
      ]
    });
    
    peerConnections[userId] = peer;

    // Add local stream tracks
    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream);
    });

    // ICE Candidate handling
    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("signal", userId, { candidate: e.candidate });
      }
    };

    // Handle remote stream
    peer.ontrack = (e) => {
      addRemoteVideo(userId, e.streams[0]);
    };

    // Connection state changes
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "disconnected") {
        removeRemoteVideo(userId);
      }
    };
  }

  // Handle incoming offers
  async function handleOffer(fromId, offer) {
    const peer = peerConnections[fromId] || createPeerConnection(fromId, localStream);
    
    try {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("signal", fromId, { type: "answer", answer: peer.localDescription });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }

  // Handle answers
  async function handleAnswer(fromId, answer) {
    const peer = peerConnections[fromId];
    if (peer) {
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    }
  }

  // Handle ICE candidates
  async function handleCandidate(fromId, candidate) {
    const peer = peerConnections[fromId];
    if (peer) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    }
  }

  // Add remote video element
  function addRemoteVideo(userId, stream) {
    // Remove existing video if any
    removeRemoteVideo(userId);
    
    const remoteVideo = document.createElement("video");
    remoteVideo.id = `remote-${userId}`;
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    remoteVideo.srcObject = stream;
    videoGrid.appendChild(remoteVideo);
  }

  // Remove remote video element
  function removeRemoteVideo(userId) {
    const videoEl = document.getElementById(`remote-${userId}`);
    if (videoEl) {
      videoEl.srcObject?.getTracks()?.forEach(track => track.stop());
      videoEl.remove();
    }
    if (peerConnections[userId]) {
      peerConnections[userId].close();
      delete peerConnections[userId];
    }
  }

  // Chat functions
  function sendMessage() {
    const input = document.getElementById("chat-input");
    const message = input.value.trim();
    if (message) {
      socket.emit("chat-message", roomId, `${username}: ${message}`);
      input.value = "";
    }
  }

  function displayMessage(msg) {
    const messages = document.getElementById("messages");
    const messageElement = document.createElement("div");
    messageElement.textContent = msg;
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
  }

  // Control functions
  function toggleMute() {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      document.getElementById("mute-btn").textContent = 
        audioTrack.enabled ? "🎤 Mute" : "🔇 Unmute";
    }
  }

  function toggleVideo() {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      document.getElementById("video-btn").textContent = 
        videoTrack.enabled ? "🎥 Stop Video" : "📹 Start Video";
    }
  }

  async function toggleScreenShare() {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true,
          audio: false
        });
        
        const screenTrack = screenStream.getVideoTracks()[0];
        Object.values(peerConnections).forEach(peer => {
          const sender = peer.getSenders().find(s => s.track.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        });
        
        screenTrack.onended = () => toggleScreenShare();
        isScreenSharing = true;
        document.getElementById("share-btn").textContent = "🖥️ Stop Sharing";
      } else {
        const cameraTrack = localStream.getVideoTracks()[0];
        Object.values(peerConnections).forEach(peer => {
          const sender = peer.getSenders().find(s => s.track.kind === "video");
          if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
        });
        isScreenSharing = false;
        document.getElementById("share-btn").textContent = "🖥️ Share Screen";
      }
    } catch (error) {
      console.error("Screen sharing error:", error);
    }
  }

  function leaveRoom() {
    // Stop all tracks
    localStream.getTracks().forEach(track => track.stop());
    
    // Close all peer connections
    Object.values(peerConnections).forEach(peer => peer.close());
    
    // Disconnect socket
    socket.disconnect();
    
    // Redirect to home page
    window.location.href = "index.html";
  }

  // Initialize the room
  initRoom();
}
