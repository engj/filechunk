var pc;
var dc;
var isCaller;
var config = {
  'iceServers': [{
    'url': 'stun:stun.l.google.com:19302'
  }]
};

var ws = new WebSocket('ws://192.168.1.8:3000', 'echo-protocol');

// Need to know if this peer is callee or caller
// in this room.
ws.onopen = function () {
    console.log('connection opened.');
    ws.send(JSON.stringify({
      'getPeerType': true,
      'roomId': roomId
    }));
};

ws.onmessage = function (evt) {
  var msg = JSON.parse(evt.data);
  if (msg['peerType']) {
    setPeerType(msg['peerType']);
    resetPC();
    if (!isCaller) {
      onLocalStream();
    }
  } else if (msg['startOffer']) {
    // Once the caller and callee have
    // connected, caller receives 
    // startOffer from callee to begin
    // handshaking process.
    onLocalStream();
  } else if (msg['sdp']) {
    onRemoteDescription(msg);
  } else if (msg['type'] && (msg['type'] == 'icecandidate')) {
    onRemoteIceCandidate(msg);
  } else if (msg['error']) {
    console.log(msg['error']);
  }
};

// Need to know which peer is the caller
// and which peer is the callee in order
// to determine who will createOffer()
// and who will createAnswer().
function setPeerType(peerType) {
  if (peerType == 'caller') {
    isCaller = true;
  } else {
    isCaller = false;
  }
}

function resetPC() {
  console.log('*** Resetting pc ***');
  pc = new webkitRTCPeerConnection(config);
  pc.onaddstream = onRemoteStream;

  // Both peers must have the same id.
  var dataChannelOptions = {
    id: 0
  };
  dc = pc.createDataChannel("myLabel", dataChannelOptions);
  dc.onopen = function () {
    console.log('YES');
    dc.send('asdasd');
  };
  dc.onmessage = function (evt) {
    console.log('Got Data Channel Message: ' + evt.data);
  };
  dc.onerror = function (error) {
    console.log('ERROR: ' + error);
  };
}

function onLocalStream() {
  if (!isCaller) {
    ws.send(JSON.stringify({
      'startOffer': true
    }));
  } else {
    pc.createOffer(onLocalDescription, function () {
    }, logError);
  }
}

function onRemoteStream(evt) {
  console.log('Got remote stream');
  var remote = document.getElementById('remote');
  remote.src = webkitURL.createObjectURL(evt.stream);
}

function onLocalDescription(desc) {
  pc.setLocalDescription(desc, function () {
    // Send local description to remote peer.
    console.log('Sent description');
    ws.send(JSON.stringify(desc));

    // Must start sending ICE candidates right 
    // after setting local description.
    startIce();
  }, logError);
}

function onRemoteDescription(msg) {
  console.log('Got remote description');
  pc.setRemoteDescription(new RTCSessionDescription(msg), function () {
    if (msg.type == 'offer') {
      pc.createAnswer(onLocalDescription, function () {
      }, logError);
    }
  });
}

function onRemoteIceCandidate(msg) {
  if (msg['candidate'] == null) {
    return;
  }
  console.log('Added ice candidate:');
  console.log(new RTCIceCandidate(msg.candidate));
  pc.addIceCandidate(new RTCIceCandidate(msg.candidate), function () {
  }, logError);
}

function startIce() {
  console.log('Starting ICE');
  pc.onicecandidate = function (evt) {
    console.log('Local candidate:');
    console.log(evt);
    ws.send(JSON.stringify(evt));
  };
}

function startDataChannel() {
}

function logError(error) {
  console.log(error);
}
