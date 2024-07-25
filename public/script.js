const socket = io();
const username = prompt('Enter your name:');
socket.emit('join-call', username);

const localAudio = document.createElement('audio');
localAudio.muted = true;
document.body.appendChild(localAudio);

let peerConnections = {};
let isMuted = false;

// Get user media for audio with enhanced settings
navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
})
.then(stream => {
  localAudio.srcObject = stream;
  localAudio.play().catch(error => console.error('Error playing local audio:', error));

  // Toggle mute/unmute
  function toggleMute() {
    isMuted = !isMuted;
    localAudio.srcObject.getAudioTracks().forEach(track => track.enabled = !isMuted);
    document.getElementById('mute-unmute').textContent = isMuted ? 'Unmute' : 'Mute';
    socket.emit('mute-unmute', isMuted);
  }

  // Handle user list update
  socket.on('update-user-list', (users) => {
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    for (let id in users) {
      const user = users[id];
      const userItem = document.createElement('div');
      userItem.textContent = `${user.username} ${user.muted ? '(Muted)' : ''}`;
      userList.appendChild(userItem);

      if (!peerConnections[id] && id !== socket.id) {
        createPeerConnection(id, stream);
      }
    }
  });

  // Handle offer from other users
  socket.on('offer', (id, description) => {
    const peerConnection = createPeerConnection(id, stream);
    peerConnection.setRemoteDescription(description)
      .then(() => peerConnection.createAnswer())
      .then(sdp => peerConnection.setLocalDescription(sdp))
      .then(() => {
        socket.emit('answer', id, peerConnection.localDescription);
      });
  });

  // Handle answer from other users
  socket.on('answer', (id, description) => {
    peerConnections[id].setRemoteDescription(description);
  });

  // Handle ICE candidates
  socket.on('ice-candidate', (id, candidate) => {
    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
  });

  // Handle user disconnection
  socket.on('user-disconnected', id => {
    if (peerConnections[id]) {
      peerConnections[id].close();
      delete peerConnections[id];
    }
  });

  // Handle mute/unmute from other users
  socket.on('mute-unmute', (id, isMuted) => {
    const remoteAudio = document.getElementById(`remote-audio-${id}`);
    if (remoteAudio) {
      remoteAudio.muted = isMuted;
    }
  });

  // Event listeners
  document.getElementById('mute-unmute').addEventListener('click', toggleMute);
  document.getElementById('end-call').addEventListener('click', () => {
    socket.emit('end-call');
    window.location.reload();
  });

})
.catch(error => {
  console.error('Error accessing media devices:', error);
});

// Create peer connection
function createPeerConnection(id, stream) {
  const peerConnection = new RTCPeerConnection();
  stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));

  peerConnection.ontrack = event => {
    let remoteAudio = document.getElementById(`remote-audio-${id}`);
    if (!remoteAudio) {
      remoteAudio = document.createElement('audio');
      remoteAudio.id = `remote-audio-${id}`;
      document.body.appendChild(remoteAudio);
    }
    remoteAudio.srcObject = event.streams[0];
    remoteAudio.play().catch(error => console.error('Error playing remote audio:', error));
  };

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', id, event.candidate);
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    if (peerConnection.iceConnectionState === 'disconnected') {
      console.warn(`Peer connection with ${id} disconnected.`);
    }
  };

  peerConnection.createOffer()
    .then(sdp => peerConnection.setLocalDescription(sdp))
    .then(() => {
      socket.emit('offer', id, peerConnection.localDescription);
    });

  peerConnections[id] = peerConnection;
  return peerConnection;
}
