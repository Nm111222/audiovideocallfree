// ✅ 1. Setup Firebase config
// const firebaseConfig = {
//   apiKey: "YOUR_API_KEY",
//   authDomain: "YOUR_PROJECT.firebaseapp.com",
//   databaseURL: "https://webrtc-demo-403fd-default-rtdb.firebaseio.com",
//   projectId: "YOUR_PROJECT",
//   storageBucket: "YOUR_PROJECT.appspot.com",
//   messagingSenderId: "XXXXXX",
//   appId: "XXXXXX"
// };

const firebaseConfig = {
  apiKey: "AIzaSyDuUhUGcWe9-9s2wb6WgdeAXBO8Oi1k09E",
  authDomain: "webrtc-demo-403fd.firebaseapp.com",
  databaseURL: "https://webrtc-demo-403fd-default-rtdb.firebaseio.com",
  projectId: "webrtc-demo-403fd",
  storageBucket: "webrtc-demo-403fd.firebasestorage.app",
  messagingSenderId: "658289105211",
  appId: "1:658289105211:web:939ef5b9188409ac2eff1e",
  measurementId: "G-ZE7WMGZWJC",
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ✅ 2. WebRTC setup
let localStream;
let remoteStream;
let pc;

const servers = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

document.getElementById("startBtn").onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  document.getElementById("localVideo").srcObject = localStream;
};

document.getElementById("createBtn").onclick = async () => {
  pc = new RTCPeerConnection(servers);
  remoteStream = new MediaStream();
  document.getElementById("remoteVideo").srcObject = remoteStream;

  // Add local tracks
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  // Remote track
  pc.ontrack = (event) => {
    event.streams[0]
      .getTracks()
      .forEach((track) => remoteStream.addTrack(track));
  };

  // Create room in Firebase
  const roomRef = db.ref("rooms").push();
  const roomId = roomRef.key;
  alert("Room created: " + roomId);

  // Save offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await roomRef.set({ offer: offer });

  // Listen for answer
  roomRef.on("value", async (snapshot) => {
    const data = snapshot.val();
    if (data?.answer && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  // ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      db.ref(`rooms/${roomId}/callerCandidates`).push(event.candidate.toJSON());
    }
  };

  // Listen for callee ICE
  db.ref(`rooms/${roomId}/calleeCandidates`).on("child_added", (snapshot) => {
    const candidate = new RTCIceCandidate(snapshot.val());
    pc.addIceCandidate(candidate);
  });
};

document.getElementById("joinBtn").onclick = async () => {
  const roomId = document.getElementById("roomId").value;
  const roomRef = db.ref("rooms/" + roomId);
  const roomData = (await roomRef.get()).val();

  if (!roomData) {
    alert("Room not found!");
    return;
  }

  pc = new RTCPeerConnection(servers);
  remoteStream = new MediaStream();
  document.getElementById("remoteVideo").srcObject = remoteStream;

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    event.streams[0]
      .getTracks()
      .forEach((track) => remoteStream.addTrack(track));
  };

  await pc.setRemoteDescription(new RTCSessionDescription(roomData.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await roomRef.update({ answer: answer });

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      db.ref(`rooms/${roomId}/calleeCandidates`).push(event.candidate.toJSON());
    }
  };

  // Listen for caller ICE
  db.ref(`rooms/${roomId}/callerCandidates`).on("child_added", (snapshot) => {
    const candidate = new RTCIceCandidate(snapshot.val());
    pc.addIceCandidate(candidate);
  });
};
