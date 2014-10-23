var http = require('http');
var express = require('express');
var uuid = require('node-uuid');
var websocket = require('websocket').server;

var app = new express();
var server = http.createServer(app);
var ws = new websocket({'httpServer': server});
var rooms = {};

server.listen(3000, '192.168.1.8');

app.get('/', function (req, res) {
  res.render('index.hbs');
});

app.get('/createRoom', function (req, res) {
  var roomId = uuid.v4();
  rooms[roomId] = new Room();
  res.redirect('/room/' + roomId);
});

app.get('/room/:id', function (req, res) {
  var roomId = req.params.id;
  var room = rooms[roomId];
  if (!room) {
    res.redirect('/404');
    return;
  }
  res.render('room.hbs', {'roomId': roomId});
});

app.get('/404', function (req, res) {
  res.render('404.hbs');
});

app.use(express.static(__dirname + '/static'));

ws.on('request', function (req, res) {
  var connection = req.accept('echo-protocol', req.origin);
  connection.on('message', connectionOnMessage);
  connection.on('close', connectionOnClose);
});

function connectionOnMessage(evt) {
  var msg = JSON.parse(evt.utf8Data);
  if (msg['getPeerType']) {
    var roomId = msg.roomId;
    var room = rooms[roomId];
    if (!room) {
      return;
    }
    this['roomId'] = roomId;
    room.addConnection(this);
    dispRoomStatuses();
    return;
  }
  var room = rooms[this['roomId']];
  var peerType = this['peerType'];
  if (peerType == 'caller') {
    room['callee'].send(evt.utf8Data);
  } else {
    room['caller'].send(evt.utf8Data);
  }
}

function connectionOnClose(reasonCode, desc) {
  var roomId = this['roomId'];
  var room = rooms[roomId];
  if (!room) {
    return;
  }
  room.removeConnection(this);
  if (room.isEmpty()) {
     delete rooms[roomId];
  } 
  dispRoomStatuses();
}

function Room() {
  this['caller'] = null;
  this['callee'] = null;
}

Room.prototype.addConnection = function (connection) {
  if (!this['caller']) {
    this['caller'] = connection;
    connection['peerType'] = 'caller';
    connection.send(JSON.stringify({
      'peerType': 'caller'
    }));
  } else if (!this['callee']) {
    this['callee'] = connection;
    connection['peerType'] = 'callee';
    connection.send(JSON.stringify({
      'peerType': 'callee'
    }));
  } else {
    connection._events = null;
    connection.send(JSON.stringify({
      'error': 'Sorry, room is full'
    }));
  }
};

Room.prototype.removeConnection = function (connection) {
  if (connection['peerType'] == 'caller') {
    this['caller'] = null;
    if (this['callee']) {
      this['caller'] = this['callee'];
      this['callee'] = null;
      this['caller']['peerType'] = 'caller';
      this['caller'].send(JSON.stringify({
        'peerType': 'caller'
      }));
    }
  } else {
    this['callee'] = null;
    this['caller'].send(JSON.stringify({
      'peerType': 'caller'
    }));
  }
};

Room.prototype.isEmpty = function () {
  return ((!this['caller']) && (!this['callee']));
};

function dispRoomStatuses() {
  console.log('Status');
  console.log('------');
  for (var roomId in rooms) {
    if (rooms.hasOwnProperty(roomId)) {
      console.log(roomId);
      var callerStatus = (rooms[roomId]['caller']) ? 1 : 0;
      var calleeStatus = (rooms[roomId]['callee']) ? 1 : 0;
      console.log('caller connection: ' + callerStatus);
      console.log('callee connection: ' + calleeStatus);
    }
  }
  console.log('\n');
}
