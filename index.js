var express = require('express');
var app = express();
var moment = require('moment');
var server = require('http').createServer(app);
//var io = require('socket.io')(server);
var io = require('socket.io', { rememberTransport: false, transports: ['WebSocket', 'Flash Socket', 'AJAX long-polling'] }).listen(server);
server.listen(3000 ,() => {
    console.log('Server is running port 3000');
})

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

var account = require('./Model/account');
var baseReponseModel = require('./Model/base-response-model');
var contentChat = require('./Model/content-chat-model');
var users = [];
var contentChats= [];

io.on('connection',socket => {
    console.log(socket.id + ' connected');
    socket.emit('users',users);
    socket.on('username',(data) => {
        console.log(data);
        socket.username = data;
        let item = users.find(x => x.username == socket.username);
        if(item != null){
            item.isOnline = true;
            item.socketId = socket.id;
        }
        io.emit('users',users);
    });
    
    socket.on('request-connect',data => {
        let friend = users.find(x => x.username == data);
        if(friend != null){
            let roomName = socket.username + friend.username;
            socket.join(roomName);
            socket.to(friend.socketId).emit('await-connect',{name: socket.username, room: roomName});
        }
        
    });
    socket.on('accept-connect', data => {
        let roomName = data.room ;
        socket.join(roomName);
        io.to(roomName).emit('connect-success',{ roomName: roomName, friend: data.friend, username: socket.username});
    });
    socket.on('reject-connect', data => {
        let friend = users.find(x => x.username == data.friend) ;
        if(friend == null) return;
        console.log("reject connect");
        io.to(friend.socketId).emit('rejected-connect',{ friend: data.username});
    });

    socket.on('request-chat', data => {
        console.log(data);
        //let currentTime = moment(new Date()).format('MM DD YYYY, HH:mm:ss');
        let content = new contentChat(data.Username, data.Content, new Date(), data.RoomName);
        //contentChats.push(contentChat);
        //let contents =  contentChats.filter(x => x.roomName == data.RoomName);
        io.to(data.RoomName).emit("my-conversation", content);
    });
    socket.on('disconnect',() => {
        console.log(socket.username + ' disconnect');
        var item = users.find(x => x.username == socket.username);
        if(item != null){
            item.isOnline = false;
        }
        io.emit('users',users);
    });
});

app.post('/sign-in',(req,res) => {
    var username = req.body.username || req.body.UserName;
    if (users.length == 0){
        users.push(new account(username));
        io.emit('users',users);
        res.send(new baseReponseModel(true,{}, null));
    }
    else {
        let user = users.find(x => x.username == username);
        if ( user == null || user == undefined){
            users.push(new account(username));
            io.emit('users',users);
            res.send(new baseReponseModel(true,{}, ''));
        }
        else {
            if (user.isOnline){
                res.send(new baseReponseModel(false,{}, user.username + 'đang online!'));
                return;
            }
            io.emit('users',users);
            res.send(new baseReponseModel(true,{}, ''));
        }
    }
})