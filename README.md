# Extra-water

Real-time, Multiplayer Pipe Connection game using socket.io, jQuery and HTML5 canvas.


## Play Here

http://dickson.md/extra-water/

Open this link and share the other link with your friend to start.


## How to play

WIP

## How to use

### Set up (production)

    $ git clone https://github.com/vicksonzero/extra-water.git
    $ npm install
    $ npm start


### End points

1. `GET /` starts a new game, join it and show a link for the other player
2. `GET /?token=TOKEN` joins a game with a token.
3. `GET /newRoom` starts a new game, returns JSON
4. `GET /rooms` lists all games


## Advanced

### Nested Express modules

`src/app.js` is in fact an `express.Router`. It means that you can do the following:

    var express = require('express');
    var app = express();
    var gameApp = require('src/app');
    app.use('/extra-water/', gameApp);

and serve gameApp inside another express module.


### Auto-resume / kill rooms

Game rooms are open by going to `GET /`, and is maintained as long as 1 of the players are still in the room.

Unfortunately, once both players leave the room, it is immediately destroyed.


### Socket.io and DigitalOcean

I have no idea why, but you need to fill in actual ip address for socket.io stuff to work on DigitalOcean.



## Bug Reporting and Contributions

Please [open issues][issues] and/or pull requests. I am more than happy to follow-up.


## License

The MIT License (MIT)  
Copyright (c) 2019 Chui Hin Wah


[issues]: https://github.com/vicksonzero/extra-water/issues
