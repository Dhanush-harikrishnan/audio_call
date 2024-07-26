document.addEventListener('DOMContentLoaded', () => {
  const muteUnmuteButton = document.getElementById('mute-unmute');
  let isMuted = false;
  let localStream;
  const peerConnections = {};
  const socket = io.connect();

  // Function to get user media
  async function getUserMedia() {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Mute the local audio to prevent feedback
      localStream.getAudioTracks()[0].enabled = false;
      // Do something with the localStream, e.g., send it to the server
      socket.emit('join-call', 'room-id', localStream);
    } catch (error) {
      console.error('Error accessing media devices.', error);
    }
  }

  // Call the function to get user media
  getUserMedia();

  muteUnmuteButton.addEventListener('click', () => {
    isMuted = !isMuted;
    if (isMuted) {
      muteUnmuteButton.textContent = 'Unmute';
      // Mute the audio
      document.querySelectorAll('audio').forEach(audio => {
        audio.muted = true;
      });
    } else {
      muteUnmuteButton.textContent = 'Mute';
      // Unmute the audio
      document.querySelectorAll('audio').forEach(audio => {
        audio.muted = false;
      });
    }
  });

  socket.on('new-peer', id => {
    const peerConnection = createPeerConnection(id);
    peerConnections[id] = peerConnection;
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  });

  socket.on('offer', (id, description) => {
    const peerConnection = createPeerConnection(id);
    peerConnections[id] = peerConnection;
    peerConnection.setRemoteDescription(description)
      .then(() => peerConnection.createAnswer())
      .then(sdp => peerConnection.setLocalDescription(sdp))
      .then(() => {
        socket.emit('answer', id, peerConnection.localDescription);
      });
  });

  socket.on('answer', (id, description) => {
    peerConnections[id].setRemoteDescription(description);
  });

  socket.on('ice-candidate', (id, candidate) => {
    peerConnections[id].addIceCandidate(new RTCIceCandidate(candidate));
  });

  socket.on('peer-disconnected', id => {
    if (peerConnections[id]) {
      peerConnections[id].close();
      delete peerConnections[id];
      const remoteAudio = document.getElementById(`remote-audio-${id}`);
      if (remoteAudio) {
        remoteAudio.remove();
      }
    }
  });

  function createPeerConnection(id) {
    const peerConnection = new RTCPeerConnection();

    peerConnection.ontrack = event => {
      let remoteAudio = document.getElementById(`remote-audio-${id}`);
      if (!remoteAudio) {
        remoteAudio = document.createElement('audio');
        remoteAudio.id = `remote-audio-${id}`;
        document.body.appendChild(remoteAudio);
      }
      remoteAudio.srcObject = event.streams[0];
      remoteAudio.play().then(() => {
        console.log('Remote audio is playing');
      }).catch(error => {
        console.error('Error playing remote audio:', error);
      });
    };

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('ice-candidate', id, event.candidate);
      }
    };

    peerConnection.createOffer()
      .then(sdp => peerConnection.setLocalDescription(sdp))
      .then(() => {
        socket.emit('offer', id, peerConnection.localDescription);
      })
      .catch(error => {
        console.error('Error creating offer:', error);
      });

    return peerConnection;
  }
});