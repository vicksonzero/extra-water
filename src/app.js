

var socketIO = require("socket.io");
var path = require('path');

var WS_PORT = 3010;

var RoomManager = require('./RoomManager');
var roomManager = new RoomManager();

const SPRING_CLEANING_INTERVL = 5 * 60 * 1000; // 5 minutes
console.log(`Spring cleaning every ${SPRING_CLEANING_INTERVL} minutes`);
setInterval(function () {
    var deletedRoomCount = roomManager.clearEmptyRooms();
    if (deletedRoomCount > -1) {
        console.log('spring cleaning ' + deletedRoomCount + ' rooms deleted');
    }
}, SPRING_CLEANING_INTERVL);

var express = require("express");
var router = express.Router();
// var fs = require("fs");


function init() {
    router.get('/', function (req, res) {
        var requestPath = req.baseUrl;
        console.log(requestPath);
        console.log('GET / token is ', req.query.token);

        // if player comes with no token
        if (req.query.token === undefined) {
            // make a new room and redirect
            var newRoom = roomManager.newRoom(
                function (newRoom) {
                    newRoom.game.playerJoined.add(function (data) {
                        // console.log(data);
                        io.to(newRoom.id).emit('playerJoined', data);
                    });
                    newRoom.game.playerUpdated.add(function (data) {
                        // console.log(data);
                        io.to(newRoom.id).emit('playerUpdated', data);
                    });
                    newRoom.game.mapUpdated.add(function (data) {
                        // console.log(data);
                        io.to(newRoom.id).emit('mapUpdated', data);
                    });
                    newRoom.game.scoreUpdated.add(function (playerID, addition, totalScore) {
                        // console.log(playerID, addition, totalScore);
                        io.to(newRoom.id).emit('scoreUpdated', playerID, addition, totalScore);
                    });
                    newRoom.game.gameIsOver.add(function (finalScore, map) {
                        // console.log();
                        io.to(newRoom.id).emit('gameIsOver', finalScore, map);
                    });

                },
                function (newRoom) {
                }
            );

            var token = newRoom.token;
            res.redirect(requestPath + '/?token=' + token);
            return;
        } else {
            if (!roomManager.roomExists(req.query.token)) {
                console.log(`room with token ${req.query.token} is not found. redirecting...`);
                res.redirect(requestPath + '/');
                return;
            }
        }

        res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    router.get('/newRoom', function (req, res, next) {
        var host = req.get('host');
        var newRoom = roomManager.newRoom(
            function (newRoom) {

            },
            function (newRoom) {
                newRoom.game.signals.updated.add(function (data) {
                    console.log(data.x, data.y, data.newVal);
                });
            }
        );

        var players = (newRoom.game.globals.players
            .map(function (player) {
                return {
                    token: host + '?token=' + newRoom.token
                };
            })
        );

        var result = {
            players
        };
        res.json(result);
    });

    router.get('/token', function (req, res, next) {
        var result = {
            token: 0
        };
        res.json(result);
    });

    router.get('/rooms', function (req, res, next) {
        var host = req.get('host');
        var baseUrl = req.baseUrl;
        var newRoomLink = req.protocol + '://' + host + baseUrl + '/newRoom';
        var rooms = roomManager.getRooms();
        res.send(
            '<p>' +
            rooms.length + ' rooms active' + '<br />' +
            '<a href="' + newRoomLink + '" target="_blank">Make New Room</a>' +
            '</p>' +
            (rooms
                .map(function (room) {
                    return 'Room ' + room.id + ' (mines: ' + room.game.globals.totalFlags + ' / ' + room.game.globals.totalMines + ')' + ':<br />' +
                        (room.game.globals.players
                            .map(function (player) {
                                return {
                                    tokenLink: req.protocol + '://' + host + baseUrl + '/?token=' + player.token
                                };
                            })
                            .map(function (player) {
                                return '<a href="' + player.tokenLink + '"target="_blank">' + player.tokenLink + '</a>';
                            })
                            .join('<br/>')
                        );
                })
                .join('<hr />')
            )
        )
    });

    router.get('/js/socket.io.js', function (req, res) {
        // console.log('socket haha');
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(path.join(__dirname, '../node_modules/socket.io-client/dist/socket.io.js'));
    });
    router.get('/js/phaser.min.js', function (req, res) {
        // console.log('phaser haha');
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(path.join(__dirname, '../node_modules/phaser/dist/phaser.js'));
    });
    router.get('/js/signals.js', function (req, res) {
        // console.log('phaser haha');
        res.setHeader('Content-Type', 'application/javascript');
        res.sendFile(path.join(__dirname, '../node_modules/signals/dist/signals.min.js'));
    });
    router.use('/', express.static(path.join(__dirname, '../public')));

    router.use('/assets', express.static(__dirname + '/../assets'));


    // var socketIO = require("socket.io");
    var io = socketIO.listen(WS_PORT);
    console.log('listening to: ', WS_PORT);
    io.on("connection", function (socket) {
        var query = socket.handshake.query;
        var token = query.token;


        if (!roomManager.roomExists(token)) {
            console.log(socket.id + ' has the wrong token: ' + token);
            socket.disconnect();
            return;
        } else {
            console.log(socket.id + " connected using token: " + token);
        }


        socket.on("disconnect", function () {
            console.log("disconnected: " + socket.id + ", token: " + token);
            var room = roomManager.getRoomByToken(token);
            var playerID = roomManager.getPlayerIDBySocketID(room, socket.id);

            // if room exists
            if (room) {
                room.players[playerID].isOnline = false;
                room.lastUsed = Date.now();
            }
            roomManager.clearEmptyRooms();
        });

        var room = roomManager.getRoomByToken(token);


        socket.on("startGame", function () {
            console.log('startGame');
            room.game.startGame();
        });
        socket.on("playerGetCell", function (playerID) {
            console.log('playerGetCell', playerID);
            room.game.playerGetCell(playerID);
        });
        socket.on("playerPickUpCell", function (playerID) {
            // console.log('playerPickUpCell', playerID);
            room.game.playerPickUpCell(playerID);
        });
        socket.on("playerPutCell", function ({ playerID, cell, cellX, cellY }) {
            // console.log('playerPutCell', { playerID, cell, cellX, cellY });
            room.game.playerPutCell({ playerID, cell, cellX, cellY });
        });
        socket.on("playerRotate", function (playerID) {
            // console.log('playerRotate', playerID);
            room.game.playerRotate(playerID);
        });
        socket.on("playerClickEdge", function (playerID, edgeDir) {
            console.log('playerClickEdge', playerID, edgeDir);
            room.game.onPlayerClickEdge(playerID, edgeDir);
        });


        socket.join(room.id);

        room.lastUsed = Date.now();

        var playerID = roomManager.getPlayerIDBySocketID(room, socket.id);
        room.players[playerID].isOnline = true;

        var welcomePack = {
            playerID,
            roomID: room.token
        };
        io.sockets.connected[socket.id].emit('init', welcomePack);

        // sendState(room);
    });

    function sendState(room) {

        var state = room.game.util.getState();
        // console.log(state);
        // console.log(room.game.globals.players[0], room.game.globals.players[1]);
        var players = room.game.globals.players.map(function (player) {
            return {
                name: player.name,
                score: player.score,
                bombs: player.bombs,
                isOnline: player.isOnline
            }
        });
        state.players = players;
        state.turn = room.game.globals.turn;
        console.log(state.masked);
        io.to(room.id).emit('state', state);
    }
    return router;
}

module.exports = init;

function makeTokenUrl(token) {
    return + HTTP_PORT + '?token=' + token;
}

// displays any unhandled errors. by default they are swallowed if these lines aren't here
// see https://nodejs.org/api/process.html#process_event_unhandledrejection
process.on('unhandledRejection', (reason, p) => {
    console.error('Unhandled Rejection at: Promise \n', p, ' \nreason: \n', reason);
    // application specific logging, throwing an error, or other logic here
});
