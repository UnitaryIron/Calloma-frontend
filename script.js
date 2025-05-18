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

  if (!roomId) {
    alert("Room ID is missing from URL");
    window.location.href = "index.html";
    throw new Error("Missing room ID");
  }

  async function initRoom() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      localVideo.muted = true;

      setupEventListeners();
      setupSocketEvents();

      socket.emit("join-room", roomId, socket.id, username);

    } catch (error) {
      console.error("Error initializing room:", error);
      alert(error.message || "Failed to initialize room");
      window.location.href = "index.html";
    }
  }

  function setupEventListeners() {
    document.getElementById("mute-btn").addEventListener("click", toggleMute);
    document.getElementById("video-btn").addEventListener("click", toggleVideo);
    document.getElementById("share-btn").addEventListener("click", toggleScreenShare);
    document.getElementById("leave-btn").addEventListener("click", leaveRoom);

    document.getElementById("send-btn").addEventListener("click", sendMessage);
    document.getElementById("chat-input").addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }

  function setupSocketEvents() {
    socket.on("connect_error", (err) => {
      console.error("Connection error:", err);
      alert("Failed to connect to server. Trying to reconnect...");
    });

    socket.on("existing-users", (userIds) => {
      console.log("Existing users:", userIds);
      userIds.forEach(userId => {
        if (userId !== socket.id && !peerConnections[userId]) {
          createPeerConnection(userId, true);
        }
      });
    });

    socket.on("user-connected", userId => {
      console.log("User connected:", userId);
      if (userId !== socket.id) {
        createPeerConnection(userId, true);
      }
    });

    socket.on("signal", (fromId, signal) => {
      console.log("Received signal from", fromId, ":", signal);
      if (!peerConnections[fromId]) {
        createPeerConnection(fromId, false);
      }

      const peer = peerConnections[fromId];

      if (signal.type === "offer") {
        handleOffer(fromId, signal.offer);
      } else if (signal.type === "answer") {
        handleAnswer(fromId, signal.answer);
      } else if (signal.candidate) {
        handleCandidate(fromId, signal.candidate);
      }
    });

    socket.on("user-disconnected", userId => {
      console.log("User disconnected:", userId);
      removeRemoteVideo(userId);
    });

    socket.on("chat-message", msg => displayMessage(msg));
  }

  function createPeerConnection(userId, isInitiator) {
    console.log(`Creating peer connection with ${userId}, initiator: ${isInitiator}`);
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    });

    peerConnections[userId] = peer;

    localStream.getTracks().forEach(track => {
      peer.addTrack(track, localStream);
    });

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("signal", userId, { candidate: e.candidate });
      }
    };

    peer.ontrack = (e) => {
      addRemoteVideo(userId, e.streams[0]);
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "disconnected") {
        removeRemoteVideo(userId);
      }
    };

    if (isInitiator) {
      createOffer(userId);
    }
  }

  async function createOffer(userId) {
    const peer = peerConnections[userId];
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit("signal", userId, { type: "offer", offer: peer.localDescription });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  }

  async function handleOffer(fromId, offer) {
    const peer = peerConnections[fromId];
    try {
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("signal", fromId, { type: "answer", answer: peer.localDescription });
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  }

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

  function addRemoteVideo(userId, stream) {
    removeRemoteVideo(userId);
    const remoteVideo = document.createElement("video");
    remoteVideo.id = `remote-${userId}`;
    remoteVideo.autoplay = true;
    remoteVideo.playsInline = true;
    remoteVideo.srcObject = stream;
    videoGrid.appendChild(remoteVideo);
  }

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
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        for (const userId in peerConnections) {
          const sender = peerConnections[userId]
            .getSenders()
            .find(s => s.track.kind === "video");
          if (sender) sender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        isScreenSharing = true;
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error("Screen share error:", error);
    }
  }

  function stopScreenShare() {
    const videoTrack = localStream.getVideoTracks()[0];
    for (const userId in peerConnections) {
      const sender = peerConnections[userId]
        .getSenders()
        .find(s => s.track.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
    }
    isScreenSharing = false;
  }

  function leaveRoom() {
    window.location.href = "index.html";
  }

  window.addEventListener("load", initRoom);
}
