
//@ts-check
/*global $: true, console: true */


// var WS_HOST = 'localhost';
// var WS_PORT = 80;



$(function () {
    "use strict";


    var params = parseURLParam();
    // console.log(params);
    if (params.token[0] === undefined) {
        console.error('no token error');
        document.write('no token error');
        return;
    } else {
        console.log('token', params.token[0]);
    }

    // utils
    // @ts-ignore: Adding funcitons to Array
    Array.prototype.transpose = function () {
        return this[0].map((col, i) => this.map(row => row[i]));
    };


    var socket = io.connect(
        '127.0.0.1:3010',
        {
            query: [
                "&token=" + params.token[0],
            ].join(""),
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        }
    );


    socket.on('connect', function () {
        console.log('connected as ' + socket.id);
    });

    socket.on('init', function (data) {
        // console.log('init()');
        // updateRoomToken();
    });

    socket.on('disconnect', function () {
        console.log('disconnected');
        $('#invite').hide();
        $('#instructions').hide();
        $('#disconnected').show()
    });

    socket.on('reconnecting', function (trialCount) {
        console.log('Reconnect #' + trialCount + '...');
    });

    socket.on('state', function (data) {
        // console.log(data);

    });

    /* =========================================== */
    // --- Global & Default Variables ---
    /* =========================================== */

    class Cell {
        /**
         * 
         */
        constructor(params) {
            const {
                pipeGame,
                x,
                y,
                pipeType,
                pipeDir,
                duration,
                progress,
                inList,
                outList,
            } = params;
            this.pipeGame = pipeGame;
            this.x = x;
            this.y = y;

            // state
            this.pipeType = pipeType || '';
            this.pipeDir = pipeDir != null ? pipeDir : 0;

            this.duration = duration != null ? duration : -1; // in ms
            this.progress = progress != null ? progress : 0; // in ms

            this.inList = inList || [];
            this.outList = outList || [];
        }

        getNeighbor(dx, dy) {
            return ((this.pipeGame.map[this.x + dx] || {})[this.y + dy] || {});
        }

        updateProgress(dt) {
            if (this.progress < this.duration) {
                this.progress += dt;
            }
        }

        isFull() {
            if (this.duration < 0) return null;
            return this.progress >= this.duration;
        }

        canInputFrom(inDir) {
            const dirIndexList = {
                '+': [0, 1, 2, 3],
                'T': [0, 1, 2],
                'L': [0, 3],
                '|': [1, 3],
                '-': [0],
            };
            const dirs = dirIndexList[this.pipeType].map((i) => (i + this.pipeDir) % 4);

            return dirs.includes(inDir);
        }

        activatePipe(progress, duration, inList) {
            this.progress = Math.max(this.progress, progress);
            this.duration = duration;
            this.inList = Array.from(new Set(this.inList.concat(inList)));
        }

        updateOutList() {
            const dirIndexList = {
                '+': [0, 1, 2, 3],
                'T': [0, 1, 2],
                'L': [0, 3],
                '|': [1, 3],
                '-': [0],
            };
            const dirs = dirIndexList[this.pipeType].map((i) => (i + this.pipeDir) % 4);


            // const possibleOutList = dirs.filter((i) => !this.inList.includes(i));
            this.outList = dirs.filter((i) => !this.inList.includes(i));
            // console.log('updateOutList', this.x, this.y, this.pipeType, this.pipeDir, dirs, this.outList);
        }

        pourToNeighbors(newDuration, fronts) {
            const deltas = [
                [1, 0],
                [0, 1],
                [-1, 0],
                [0, -1],
            ];

            const dirIndexList = {
                '+': [0, 1, 2, 3],
                'T': [0, 1, 2],
                'L': [0, 3],
                '|': [1, 3],
                '-': [0],
            };

            const dirs = dirIndexList[this.pipeType].map((i) => (i + this.pipeDir) % 4);

            dirs.forEach((i) => {
                const delta = deltas[i];
                const cell = this.getNeighbor(...delta);
                if (!cell) return;
                if (cell.pipeType === '') return;

                const inDir = (i + 2) % 4;
                if (cell.isFull()) return;
                if (!cell.canInputFrom(inDir)) return;

                cell.activatePipe(this.progress - this.duration, newDuration, [(i + 2) % 4]);
                fronts.add(cell);
            })
        }
    }

    class Player {
        constructor(i, { cellX, cellY, fluidDuration, fluidDurationMin }) {
            this.playerID = i;
            this.fluidDuration = fluidDuration;
            this.fluidDurationMin = fluidDurationMin;
            this.mode = 'idle'; // 'idle', 'rotate', 'cell'
            this.cell = null;
            this.cellX = cellX;
            this.cellY = cellY;
        }

        setViewXY(cellX, cellY) {
            this.cellX = cellX;
            this.cellY = cellY;
        }

        setCell(cell) {
            this.cell = cell;
        }
    }

    const pipeGame = {
        gameid: '',
        gridWidth: 25,
        gridHeight: 25,

        map: [],
        fronts: new Set(),
        fluidDuration: 3000,
        last: 0,

        ups: 10,
        players: [],
        samplePlayer: new Player(-1, { fluidDuration: 3000, fluidDurationMin: 1000 }),
        connectCommand: { leftCell: null, leftOut: null, rightCell: null, rightIn: null },
        playerJoined: new signals.Signal(),
        playerUpdated: new signals.Signal(),

        initMap() {
            this.map = (new Array(this.gridWidth)
                .fill(1)
                .map((_, x) => {
                    return (new Array(this.gridHeight)
                        .fill(1)
                        // @ts-ignore: Optional parameters in pure JS
                        .map((_, y) => new Cell({ pipeGame: this, x, y }))
                    );
                }));
            // this.iterateMap((cell, x, y) => {
            //     cell.pipeType = ['', '+', 'T', 'L', '|', '-'][Math.floor(Math.random() * 5)];
            //     cell.pipeDir = Math.floor(Math.random() * 4);
            // });
        },
        iterateMap(callback) {
            this.map.forEach((col, x) => {
                col.forEach((cell, y) => {
                    // const cellGraphic = mapGraphics[x][y];
                    callback(cell, x, y);
                });
            })
        },
        init() {
            const [xx, yy] = [
                Math.floor(this.gridWidth / 2),
                Math.floor(this.gridHeight / 2),
            ];
            // let cell;
            // this.fronts.add(cell = this.map[xx][yy]);

            // cell.pipeType = '-';
            // cell.pipeDir = Math.floor(Math.random() * 4);
            // cell.activatePipe(Math.floor(0.4 * this.fluidDuration), this.fluidDuration, []);
            // cell.updateOutList();
        },
        startGame() {
            this.last = Date.now();
            setTimeout(() => this.updateFluid(), 1000 / this.ups);
        },

        updateFluid() {
            const delta = Date.now() - this.last;
            // console.log('updateGame', delta);
            this.fronts.forEach((cell) => {
                if (cell.isFull()) this.fronts.delete(cell);
            });
            this.fronts.forEach((cell) => {
                cell.updateProgress(delta);
                // console.log(cell);

            });
            this.fronts.forEach((cell) => {
                // console.log(cell.isFull());

                if (cell.isFull()) {
                    cell.pourToNeighbors(this.fluidDuration, this.fronts);
                }
            });
            this.fronts.forEach((cell) => {
                cell.updateOutList();
            });

            this.dispatchPlayerChange();

            if (this.fronts.size > 0) {
                this.last = Date.now();
                setTimeout(this.updateFluid.bind(this), 1000 / this.ups);
            }
        },

        dispatchPlayerChange() {
            this.players.forEach((player) => {
                if (player.mode === 'cell') {
                    const cell = this.map[player.cellX][player.cellY];
                    console.log('dispatchPlayerChange cell');

                    this.playerUpdated.dispatch({
                        playerID: player.playerID,
                        mode: player.mode,
                        cell: {
                            x: cell.x,
                            y: cell.y,
                            pipeType: cell.pipeType,
                            pipeDir: cell.pipeDir,
                            duration: cell.duration,
                            progress: cell.progress,
                            inList: cell.inList.slice(),
                            outList: cell.outList.slice(),
                        }
                    });
                } else if (player.mode === 'rotate') {
                    const cell = player.cell;
                    console.log('dispatchPlayerChange rotate');

                    this.playerUpdated.dispatch({
                        playerID: player.playerID,
                        mode: player.mode,
                        cell: {
                            x: cell.x,
                            y: cell.y,
                            pipeType: cell.pipeType,
                            pipeDir: cell.pipeDir,
                            duration: cell.duration,
                            progress: cell.progress,
                            inList: cell.inList.slice(),
                            outList: cell.outList.slice(),
                        }
                    });
                }
            });
        },

        playerJoin() {
            let player;
            this.players.push(player = new Player(this.players.length, this.samplePlayer));
            console.log('Player joined:', player.playerID);
            this.playerJoined.dispatch({
                playerID: player.playerID,
            });
        },

        playerPutCell({ playerID, cell, cellX, cellY }) {
            const player = this.players[playerID];
            if (!player) throw new Error('playerGetCell: player not found: ' + playerID);
            console.log('playerPutCell', playerID, cell, cellX, cellY);

            this.addCell(cellX, cellY, cell.pipeType, cell.pipeDir);
            player.cellX = cellX;
            player.cellY = cellY;
            player.mode = 'cell';
            this.dispatchPlayerChange();
        },

        onPlayerClickEdge(playerID, edgeDir) {
            // edgeDir = 0,1,2,3 (0=right, 1=bottom)
            if (this.connectCommand.leftCell == null) {

            } else if (this.connectCommand.rightCell == null) {

            } else {

            }
        },
        playerPickUpCell(playerID) {
            const player = this.players[playerID];
            if (!player) throw new Error('playerGetCell: player not found: ' + playerID);

            console.log('playerPickUpCell', playerID);

            if (player.mode === 'cell') {
                player.mode = 'rotate';
                this.dispatchPlayerChange();
            }
        },
        playerGetCell(playerID) {
            const player = this.players[playerID];
            if (!player) throw new Error('playerGetCell: player not found: ' + playerID);

            console.log('playerGetCell', playerID);

            if (player.mode === 'idle') {
                if (this.fronts.size <= 0) {
                    player.setCell(new Cell({
                        pipeGame: this,
                        pipeType: '-',
                        pipeDir: Math.floor(Math.random() * 4),
                    }));
                    player.mode = 'rotate';
                    this.dispatchPlayerChange();
                } else {
                    player.setCell(new Cell({
                        pipeGame: this,
                        pipeType: ['+', 'T', 'L', '|'][Math.floor(Math.random() * 4)],
                        pipeDir: Math.floor(Math.random() * 4),
                    }));
                    player.mode = 'rotate';
                    this.dispatchPlayerChange();
                }
            }
        },

        playerRotate(playerID) {
            const player = this.players[playerID];
            if (!player) throw new Error('playerGetCell: player not found: ' + playerID);
            console.log('playerRotate', playerID);

            if (player.mode === 'rotate') {
                player.cell.pipeDir += 1;
                player.cell.pipeDir %= 4;
                this.dispatchPlayerChange();
            }
        },

        addCell(x, y, pipeType, pipeDir) {
            const cell = this.map[x][y];

            cell.pipeType = pipeType || '-';
            cell.pipeDir = pipeDir;
            cell.activatePipe(Math.floor(0.4 * this.fluidDuration), this.fluidDuration, []);
            cell.updateOutList();
            if (this.fronts.size <= 0) this.fronts.add(cell);
        }
    };

































    /* =========================================== */
    // --- Phaser ---
    /* =========================================== */

    // game class
    class Game extends Phaser.Game {
        constructor(config) {
            super(config);
        }
    }

    class CellGraphic extends Phaser.GameObjects.Container {

        constructor(cellX, cellY, w, h, scene, x, y, children) {
            super(scene, x, y, children);
            this.bg = null;
            this.pipe = null;
            this.cellWidth = 0;
            this.cellHeight = 0;
            this.cellX = cellX;
            this.cellY = cellY;

            this.cellWidth = w;
            this.cellHeight = h;
        }
        createUI() {
            this.add(this.bg = this.scene.add.graphics({
                x: 0,
                y: 0,
                lineStyle: {
                    width: 1,
                    color: 0xffffff,
                    alpha: 1
                },
                fillStyle: {
                    color: 0xffffff,
                    alpha: 1
                },

            }));
            this.add(this.pipe = this.scene.add.graphics({
                x: 0,
                y: 0,
                lineStyle: {
                    width: 1,
                    color: 0xffffff,
                    alpha: 1
                },
                fillStyle: {
                    color: 0xffffff,
                    alpha: 1
                },
            }));
            this.add(this.fill = this.scene.add.graphics({
                x: 0,
                y: 0,
                lineStyle: {
                    width: 1,
                    color: 0xffffff,
                    alpha: 1
                },
                fillStyle: {
                    color: 0xffffff,
                    alpha: 1
                },
            }));
        }
        init() {
            const w = this.cellWidth;
            const h = this.cellHeight;

            this.bg.clear();
            let color = Phaser.Display.Color.HSLToColor(0.7, 0.5, 0.5).color;

            if (this.cellX == 12 && this.cellY == 12) {
                color = Phaser.Display.Color.HSLToColor(0, 1, 0.5).color;
            }
            this.bg.lineStyle(1, color, 1);
            this.bg.strokeRect(-w / 2, -h / 2, w, h);

            // this.bg.fillStyle(color, 0.1);
            // this.bg.fillRect(-w / 2, -h / 2, w, h);


            this.initInteractive();
        }

        drawPipe(pipeData) {
            const w = this.cellWidth;
            const h = this.cellHeight;

            const {
                pipeType,
                pipeDir, // 0, 1, 2, 3
                inList, // 0, 1, 2, 3
                outList, // 0, 1, 2, 3
                duration,
                progress,

            } = pipeData;


            this.pipe.clear();
            let color = Phaser.Display.Color.HSLToColor(0.7, 0.1, 0.5).color;
            const pipeWidth = 5;
            this.pipe.lineStyle(pipeWidth, color, 1);
            // console.log('pipeType', pipeType);

            const [w2, h2, pipeWidth2] = [w / 2, h / 2, pipeWidth / 2];
            switch (pipeType) {
                case '+': {
                    this.pipe.lineBetween(0, -h2, 0, h2);
                    this.pipe.lineBetween(-w2, 0, w2, 0);
                } break;
                case 'T': {
                    this.pipe.lineBetween(0, 0, 0, h2);
                    this.pipe.lineBetween(-w2, 0, w2, 0);
                } break;
                case 'L': {
                    this.pipe.lineBetween(-pipeWidth2, 0, w2, 0);
                    this.pipe.lineBetween(0, pipeWidth2, 0, -h2);
                } break;
                case '|': {
                    this.pipe.lineBetween(0, -h2, 0, h2);
                } break;
                case '-': {
                    this.pipe.lineBetween(-pipeWidth2, 0, w2, 0);
                } break;
            }

            this.pipe.angle = pipeDir * 90;
        }


        initInteractive() {
            this.setInteractive(new Phaser.Geom.Rectangle(-10, -10, 20, 20), Phaser.Geom.Rectangle.Contains, true);

            // this.scene.input.on('drag',  (pointer, gameObject, dragX, dragY) =>{
            //     if (gameObject.type == 'PlayerPhone') {
            //         gameObject.x = dragX;
            //         gameObject.y = dragY;
            //     }
            // });
            // this.scene.input.on('drag',  (pointer, gameObject, dragX, dragY)=> {
            //     if (gameObject.type == 'PlayerPhone') {
            //         gameObject.x = dragX;
            //         gameObject.y = dragY;
            //     }
            // });
            // this.scene.input.on('drop',  (pointer, gameObject, isOver, a, b)=> {
            //     // debugger;
            //     if (gameObject.type == 'PlayerPhone') {
            //         // gameObject.x = dragX;
            //         // gameObject.y = dragY;
            //         gameObject.x = Math.floor(gameObject.x / this.scene.cellWidth) * this.scene.cellWidth + this.scene.cellWidth / 2;
            //         gameObject.y = Math.floor(gameObject.y / this.scene.cellHeight) * this.scene.cellHeight + this.scene.cellHeight / 2;
            //     }
            // });
            // this.scene.input.setDraggable(this);

        }

        updatePipeFill(pipeData) {
            const w = this.cellWidth;
            const h = this.cellHeight;

            // console.log('updatePipeFill', pipeData);


            const {
                pipeType,
                pipeDir, // 0, 1, 2, 3
                inList, // 0, 1, 2, 3
                outList, // 0, 1, 2, 3
                duration,
                progress,

            } = pipeData;
            const pipeWidth = 5;

            this.fill.clear();

            // if not yet fill
            if (duration < 0) return;
            // console.log('updatePipeFill', progress / duration);


            let color = Phaser.Display.Color.HSLToColor(0.7, 1, 0.5).color;
            this.fill.lineStyle(pipeWidth, color, 1);

            const [w2, h2, pipeWidth2] = [w / 2, h / 2, pipeWidth / 2];

            const inPercent = Math.max(0, Math.min(0.5, progress / duration)) * 2;

            inList.forEach((input) => {
                switch (input) {
                    case 0: { // from right
                        this.fill.lineBetween(w2, 0, w2 - ((w2 + pipeWidth2) * inPercent), 0);
                    } break;
                    case 1: { // from bottom
                        this.fill.lineBetween(0, h2, 0, h2 - ((h2 + pipeWidth2) * inPercent));
                    } break;
                    case 2: { // from left
                        this.fill.lineBetween(-w2, 0, -w2 + ((w2 + pipeWidth2) * inPercent), 0);
                    } break;
                    case 3: { // from top
                        this.fill.lineBetween(0, -h2, 0, -h2 + ((h2 + pipeWidth2) * inPercent));
                    } break;
                }

            });
            const outPercent = Math.max(0, Math.min(0.5, progress / duration - 0.5)) * 2;
            const pipeWidth2b = (inList.length > 0 ? pipeWidth2 : -pipeWidth2);

            outList.forEach((input) => {
                switch (input) {
                    case 0: { // to right
                        this.fill.lineBetween(pipeWidth2b, 0, pipeWidth2b + ((w2 - pipeWidth2b) * outPercent), 0);
                    } break;
                    case 1: { // to bottom
                        this.fill.lineBetween(0, pipeWidth2b, 0, pipeWidth2b + ((h2 - pipeWidth2b) * outPercent));
                    } break;
                    case 2: { // to left
                        this.fill.lineBetween(-pipeWidth2b, 0, -pipeWidth2b - ((w2 - pipeWidth2b) * outPercent), 0);
                    } break;
                    case 3: { // to top
                        this.fill.lineBetween(0, -pipeWidth2b, 0, -pipeWidth2b - ((h2 - pipeWidth2b) * outPercent));
                    } break;
                }
            });

        }
    }

    class PlayerPhone extends Phaser.GameObjects.Container {
        constructor(playerID, scene, x, y, children) {
            super(scene, x, y, children);
            this.type = 'PlayerPhone';
            this.mode = 'idle'; // 'idle', 'rotate', 'cell'
            this.playerID = playerID;
            this.cell = null;
            this.add(this.bg = this.scene.add.image(0, 0, 'button'));
            this.bg.setScale(1 / 2.5);

            this.add(this.cellGraphic = new CellGraphic(0, 0, 20, 20, scene, 0, 0));

            this.cellGraphic.createUI();
            // this.cellGraphic.init(); // don't init because don't want interactive
            this.initInteractive();
        }
        initInteractive() {
            this.setInteractive(new Phaser.Geom.Rectangle(-10, -10, 20, 20), Phaser.Geom.Rectangle.Contains);

            // this.scene.input.on('drag', (pointer, gameObject, dragX, dragY)=> {
            //     if (gameObject.type == 'PlayerPhone') {
            //         gameObject.x = dragX;
            //         gameObject.y = dragY;
            //     }
            // });
            this.scene.input.on('dragstart', (pointer, gameObject, dragX, dragY) => {
                if (gameObject.type == 'PlayerPhone') {
                    const playerPhone = gameObject;
                    console.log('dragstart', playerPhone.mode);
                    if (playerPhone.mode === 'idle') {
                        pipeGame.playerGetCell(playerPhone.playerID);
                    } else if (playerPhone.mode === 'cell') {
                        pipeGame.playerPickUpCell(playerPhone.playerID);
                    }
                }
            });
            this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
                if (gameObject.type == 'PlayerPhone') {
                    this.scene.currentPlayer = gameObject;
                    gameObject.x = dragX;
                    gameObject.y = dragY;
                }
            });
            this.scene.input.on('drop', (pointer, gameObject, zone) => {
                // debugger;
                if (gameObject.type == 'PlayerPhone') {
                    const playerPhone = gameObject;
                    if (this.scene.isTutorial && !(zone.cellX == 12 && zone.cellY == 12)) {
                        // debugger;
                        playerPhone.x = playerPhone.input.dragStartX;
                        playerPhone.y = playerPhone.input.dragStartY;
                        this.scene.isTutorial = false;

                        this.scene.currentPlayer = null;
                    } else {
                        playerPhone.x = Math.floor(playerPhone.x / this.scene.cellWidth) * this.scene.cellWidth + this.scene.cellWidth / 2;
                        playerPhone.y = Math.floor(playerPhone.y / this.scene.cellHeight) * this.scene.cellHeight + this.scene.cellHeight / 2;
                        pipeGame.playerPutCell({
                            playerID: playerPhone.playerID,
                            cell: {
                                pipeType: playerPhone.cell.pipeType,
                                pipeDir: playerPhone.cell.pipeDir,
                            },
                            cellX: zone.cellX,
                            cellY: zone.cellY
                        });
                        this.scene.currentPlayer = null;
                    }
                }
            });
            this.scene.input.setDraggable(this);

        }

        drawCell(cell) {
            const {
                x,
                y,
                pipeType,
                pipeDir,
                duration,
                progress,
                inList,
                outList,
            } = cell;

            // TODO: not tear down every frame
            // if (this.cell.) {
            this.cellGraphic.drawPipe(cell);
            // }
            this.cellGraphic.updatePipeFill(cell);
        }
    }














    class MainScene extends Phaser.Scene {
        constructor(config) {
            super(config);
            this.cellWidth = 20;
            this.cellHeight = 20;
            this.mapGraphics = null;
            this.currentPlayer = null;

            this.mapContainer = null;
            this.playerContainer = null;
            this.uiContainer = null;
            this.playerPhones = [];
            pipeGame.playerJoined.add((...params) => this.onPlayerAdded(...params));
            pipeGame.playerUpdated.add((...params) => this.onPlayerUpdated(...params));

            this.isTutorial = true;
        }

        preload() {
            this.load.image('start_button', './images/kenney/onscreencontrols/Sprites/shadedLight/shadedLight42.png');
            this.load.image('button', './images/kenney/onscreencontrols/Sprites/shadedLight/shadedLight12.png');
            this.load.image('add_button', './images/kenney/onscreencontrols/Sprites/shadedLight/shadedLight18.png');

        }
        create() {
            this.mapContainer = this.add.container(0, 0).setName('mapContainer');
            this.playerContainer = this.add.container(0, 0).setName('playerContainer');
            this.uiContainer = this.add.container(0, 0).setName('uiContainer');

            this.cameras.main.setBackgroundColor('#AAAAAA');
            this.mapGraphics = (new Array(pipeGame.gridWidth)
                .fill(1)
                .map((_, x) => {
                    return (new Array(pipeGame.gridHeight)
                        .fill(1)
                        .map((_, y) => {
                            const cellGraphic = new CellGraphic(x, y, this.cellWidth, this.cellHeight, this);
                            this.mapContainer.add(cellGraphic);
                            cellGraphic.createUI();
                            return cellGraphic;
                        })
                    );
                }));
            this.mapContainer.bringToTop(this.mapGraphics[12][12]);
            pipeGame.iterateMap((cell, x, y) => {
                const cellGraphic = this.mapGraphics[x][y];
                cellGraphic.setPosition(x * this.cellWidth + this.cellWidth / 2, y * this.cellHeight + this.cellHeight / 2);
                cellGraphic.init();
            });
            // this.key1 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
            // this.key2 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
            // this.key3 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
            // this.key4 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR);
            // this.key5 = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE);

            this.createUI();

            this.input.on('pointerdown', (pointer, gameObject, zone) => {
                if (pointer.buttons & 2) {
                    // debugger;
                    if ((this.currentPlayer || {}).type == 'PlayerPhone' && this.currentPlayer.mode === 'rotate') {
                        pipeGame.playerRotate(this.currentPlayer.playerID);
                    }
                }
            });

            this.addPlayer();
        }

        update(time, delta) {
            this.updateBoard();
            // if (this.key1.isDown) this.currentPlayer = 1;
            // if (this.key2.isDown) this.currentPlayer = 2;
            // if (this.key3.isDown) this.currentPlayer = 3;
            // if (this.key4.isDown) this.currentPlayer = 4;
            // if (this.key5.isDown) this.currentPlayer = 5;

        }

        updateBoard() {
            pipeGame.iterateMap((cell, x, y) => {
                // console.log(x,y);

                const cellGraphic = this.mapGraphics[x][y];
                if (cell.isFull()) {
                    cellGraphic.updatePipeFill({
                        // pipeType: ['', '+', 'T', 'L', '|', '-'][Math.floor(Math.random() * 5)],
                        // pipeDir: Math.floor(Math.random() * 4),
                        inList: cell.inList,
                        outList: cell.outList,
                        duration: cell.duration,
                        progress: cell.progress,

                    });
                }
            });

            this.playerPhones.forEach((playerPhone) => {
                if (playerPhone.cell) {
                    playerPhone.cellGraphic.drawPipe(playerPhone.cell);
                }
            });
        }
        createUI() {
            let startBtn;
            this.uiContainer.add(startBtn = this.add.image(250, 400, 'start_button'));
            startBtn.setInteractive().on('pointerdown', () => {
                startBtn.setTint(0xAAAAAA);

            });
            this.input.on('pointerup', () => {
                startBtn.setTint(0xFFFFFF);
            });
            startBtn.setInteractive().on('pointerup', () => {
                pipeGame.startGame();
            });

            let addBtn;
            this.uiContainer.add(addBtn = this.add.image(150, 400, 'add_button'));
            addBtn.setInteractive().on('pointerdown', () => {
                addBtn.setTint(0xAAAAAA);

            });
            this.input.on('pointerup', () => {
                addBtn.setTint(0xFFFFFF);
            });
            addBtn.setInteractive().on('pointerup', () => {
                pipeGame.playerJoin();
            });
        }

        addPlayer() {
            pipeGame.playerJoin();
        }

        onPlayerAdded({ playerID }) {
            let player;
            this.playerContainer.add(player = new PlayerPhone(playerID, this, 250, 300));
            this.playerPhones.push(player);

        }

        onPlayerUpdated(data) {
            console.log('onPlayerUpdated', data);

            const { playerID, mode, cell } = data;
            const {
                x,
                y,
                pipeType,
                pipeDir,
                duration,
                progress,
                inList,
                outList,
            } = cell;

            this.playerPhones[playerID].mode = mode;
            this.playerPhones[playerID].cell = cell;
            this.playerPhones[playerID].drawCell(cell);
        }
    }


    // main game configuration
    const config = {
        width: 500,
        height: 500,
        disableContextMenu: true,
        type: Phaser.AUTO,
        parent: "game",
        scene: MainScene,
    };
    // when the page is loaded, create our game instance
    var game = new Game(config);

    pipeGame.initMap();
    pipeGame.init();
    //@ts-ignore: expose pipeGame
    window.pipeGame = pipeGame;

    // setTimeout(() => {
    // }, 100);
    function handleSizeUpdate(event) {
        const ww = window.innerWidth / 500;
        const hh = window.innerHeight / 500;

        const min = Math.min(ww, hh);
        console.log('handleSizeUpdate', window.innerWidth, ww, window.innerHeight, hh, min);

        game.canvas.style.width = `${min * 500}px`;
        game.canvas.style.height = `${min * 500}px`;
    }

    if (!window.location.search.includes('video')) {
        window.addEventListener('resize', handleSizeUpdate);

        console.log('init handleSizeUpdate');
        handleSizeUpdate();
    }
});




/*
* copied from stackoverflow
*/
function parseURLParam() { var n, a = {}, e = decodeURIComponent; return location.search.replace("?", "").split("&").forEach(function (o) { n = o.split("="), n[0] in a ? a[n[0]].push(e(n[1])) : a[n[0]] = [e(n[1])] }), a }
