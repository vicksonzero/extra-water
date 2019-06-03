var Game = require('./game');

var randtoken = require('rand-token');
var tokenCharSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';

class RoomManager {
    constructor() {
        this.rooms = {};
        this.nextRoomID = 0;
        this.idleRoomLimit = 1 * 60 * 1000; // 1min
    }

    // RoomManager.prototype
    newRoom(beforeInitCallback, afterInitCallback) {
        var id = this.nextRoomID;
        this.nextRoomID++;

        var newRoom = {
            id,
            token: randtoken.generate(5, tokenCharSet),
            game: new Game(),
            lastUsed: Date.now(),
            players: [], // {token, playerID}
        };
        this.rooms[id] = newRoom;
        beforeInitCallback(newRoom);
        newRoom.game.initMap();
        newRoom.game.init();

        afterInitCallback(newRoom);
        return newRoom;
    }

    getRooms() {
        var arr = Object.keys(this.rooms).map(function (key) { return this.rooms[key]; }.bind(this));
        return arr;
    }

    getToken(roomID, playerID) {
        return this.getRoomByID(roomID).token;
    }

    roomExists(token) {
        return this.getRoomByToken(token) !== null;
    }

    getRoomByToken(token) {
        var rooms = this.getRooms();
        for (var i = 0; i < rooms.length; i++) {
            var room = rooms[i];
            if (room.token == token) {
                return room;
            }
        }
        return null;
    }

    getPlayerIDBySocketID(room, socketID) {
        let playerID = ((Object.entries(room.players).find(([_, { token }]) => token === socketID) || {})[1] || {}).playerID;

        if (playerID != null) return playerID;
        const player = room.game.playerJoin();
        playerID = player.playerID;
        room.players[playerID] = { token: socketID, playerID, isOnline: true };
        return playerID;
    }

    getRoomByID(roomID) {
        return this.rooms[roomID] || null;
    }

    clearEmptyRooms() {
        var rooms = this.getRooms();
        if (rooms.length < 1) {
            return -1;
        }
        var deletedRoomCount = 0;
        var now = Date.now();
        console.log(now);
        rooms.forEach(function (room) {
            var isEmpty = room.players.every(function (player) {
                return player.isOnline === false;
            });
            console.log('Room ' + room.id + ': ' + (isEmpty ? 'empty ' : '      ') + (now - room.lastUsed));
            var hasBeenLongTime = now - room.lastUsed > this.idleRoomLimit;
            if (isEmpty && hasBeenLongTime) {
                // this.kickAll(room.id);
                this.removeRoom(room.id);
                deletedRoomCount++;
            }
        }.bind(this));
        return deletedRoomCount;
    }

    removeRoom(roomID) {
        console.log('remove room ' + roomID);
        delete this.rooms[roomID];
    }
}













module.exports = RoomManager;
