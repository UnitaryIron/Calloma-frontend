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

  // Validate room ID
  if (!roomId) {
    alert("Room ID is missing from URL");
    window.location.href = "index.html";
    throw new Error("Missing room ID");
  }

  // Initialize the room
  async function initRoom() {
    try {
      // Get user media
      localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      }).catch(err => {
        console.error("Media access error:", err);
        throw new Error("Could not access camera/microphone. Please check permissions.");
      });
      
      localVideo.srcObject = localStream;
      socket.emit("join-room", roomId, socket.id);

      setupEventListeners();
      setupSocketEvents();
      
    } catch (error) {
      console.error("Error initializing room:", error);
      alert(error.message || "Failed to initialize room");
      window.location.href = "index.html";
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
    // Connection status
    socket.on("connect_error", (err) => {
      console.error("Connection error:", err);
      alert("Failed to connect to server. Trying to reconnect...");
    });

    // Handle new users
    socket.on("user-connected", userId => {
      console.log("User connected:", userId);
      if (userId === socket.id) return;
      createPeerConnection(userId, localStream);
    });

    // Get existing users when joining
    socket.on("existing-users", (userIds) => {
      console.log("Existing users:", userIds);
      userIds.forEach(userId => {
        if (userId !== socket.id && !peerConnections[userId]) {
          createPeerConnection(userId, localStream);
        }
      });
    });

    // Handle signaling
    socket.on("signal", (fromId, signal) => {
      console.log("Received signal from", fromId, "type:", signal.type || "candidate");
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
      console.log("User disconnected:", userId);
      removeRemoteVideo(userId);
    });

    // Handle chat messages
    socket.on("chat-message", (msg) => {
      displayMessage(msg);
    });
  }

  // Create peer connection
  function createPeerConnection(userId, stream) {
    console.log("Creating peer connection with", userId);
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        // Add your TURN server here if needed
        // { 
        //   urls: "turn:your-turn-server.com",
        //   username: "username",
        //   credential: "password"
        // }
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
        console.log("Sending ICE candidate to", userId);
        socket.emit("signal", userId, { candidate: e.candidate });
      }
    };

    // Handle remote stream
    peer.ontrack = (e) => {
      console.log("Received remote stream from", userId);
      addRemoteVideo(userId, e.streams[0]);
    };

    // Connection state changes
    peer.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, peer.connectionState);
      if (peer.connectionState === "disconnected") {
        removeRemoteVideo(userId);
      }
    };

    // For the initiator, create an offer
    if (userId !== socket.id) {
      createOffer(userId);
    }
  }

  // Create offer
  async function createOffer(userId) {
    const peer = peerConnections[userId];
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log("Sending offer to", userId);
      socket.emit("signal", userId, { type: "offer", offer: peer.localDescription });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  }

  // Handle incoming offers
  async function handleOffer(fromId, offer) {
    console.log("Handling offer from", fromId);
    const peer = peerConnections[fromId] || createPeerConnection(fromId, localStream);
    
    try {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      console.log("Sending answer to", fromId);
      socket.emit("signal", fromId, { type: "answer", answer: peer.localDescription });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }

  // Handle answers
  async function handleAnswer(fromId, answer) {
    console.log("Handling answer from", fromId);
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
    console.log("Handling ICE candidate from", fromId);
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
    console.log("Adding remote video for", userId);
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
    console.log("Removing remote video for", userId);
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
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
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
