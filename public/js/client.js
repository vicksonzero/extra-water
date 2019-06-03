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


    function connectSocket() {

        var socket = window.socket = io.connect(
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
            console.log('init', data);
            // updateRoomToken();
            const {
                playerID,
                roomID,
            } = data;
            pipeGame.playerID = playerID;
            window.scene.onPlayerAdded({ playerID });
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

        socket.on('playerJoined', function ({ map, playerID }) {
            // console.log('socket playerJoined', { mapL: map.length, playerID });

            pipeGame.map = map;
            pipeGame.playerJoined.dispatch({ playerID });
        });
        socket.on('playerUpdated', function (data) {
            // console.log('socket playerUpdated', data);
            const { map } = data;
            pipeGame.map = map;
            pipeGame.playerUpdated.dispatch(data);

        });
        socket.on('scoreUpdated', function (playerID, addition, totalScore) {
            // console.log('socket scoreUpdated', playerID, addition, totalScore);
            pipeGame.scoreUpdated.dispatch(playerID, addition, totalScore);

        });
        socket.on('gameIsOver', function (finalScore, map) {
            // console.log('socket gameIsOver', finalScore, map);
            pipeGame.map = map;
            pipeGame.gameIsOver.dispatch(finalScore);
        });
    }


    const pipeGame = window.pipeGame = {
        playerID: -1,
        gridWidth: 25,
        gridHeight: 25,
        map: [],
        startGame() {
            console.log('startGame');
            socket.emit("startGame");
        },
        // iterateMap() ?
        playerGetCell(playerID) {
            // console.log('playerGetCell', playerID);
            socket.emit("playerGetCell", playerID);
        },
        playerPickUpCell(playerID) {
            socket.emit("playerPickUpCell", playerID);
        },
        playerPutCell({ playerID, cell, cellX, cellY }) {
            socket.emit("playerPutCell", { playerID, cell, cellX, cellY });
        },
        playerRotate(playerID) {
            socket.emit("playerRotate", playerID);
        },

        onPlayerClickEdge(playerID, dirIndex) {
            // console.log('onPlayerClickEdge', playerID, dirIndex);

            socket.emit("playerClickEdge", playerID, dirIndex);
        },

        iterateMap(callback) {
            this.map.forEach((col, x) => {
                col.forEach((cell, y) => {
                    // const cellGraphic = mapGraphics[x][y];
                    callback(cell, x, y);
                });
            })
        },
        playerJoined: new signals.Signal(),
        playerUpdated: new signals.Signal(),
        scoreUpdated: new signals.Signal(),
        mapUpdated: new signals.Signal(),
        gameIsOver: new signals.Signal(),
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
            const pipeWidth = w / 4;
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
            // this.setInteractive(new Phaser.Geom.Rectangle(-10, -10, 20, 20), Phaser.Geom.Rectangle.Contains, true);

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
            const pipeWidth = w / 4;

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

            if (pipeData.progress > 0) {
                this.disableInteractive();
                // this.setInteractive(false);
            }

        }
    }

    class PlayerPhone extends Phaser.GameObjects.Container {
        constructor(playerID, scene, x, y, children) {
            super(scene, x, y, children);
            this.type = 'PlayerPhone';
            this.mode = 'idle'; // 'idle', 'rotate', 'cell'
            this.playerID = playerID;
            this.fluidLevel = 0;
            this.cell = null;
            // this.add(this.bg = this.scene.add.image(0, 0, 'button'));
            this.add(this.bg = this.scene.add.graphics({
                x: 0,
                y: 0,
                lineStyle: {
                    width: 5,
                    color: 0x000000,
                    alpha: 1
                },
                fillStyle: {
                    color: 0xffffff,
                    alpha: 1
                },
            }));
            this.bg.fillRect(-250, -250, 500, 500);
            this.bg.strokeRect(-250, -250, 500, 500);
            // this.bg.setScale(1 / 2.5);

            this.add(this.cellGraphic = new CellGraphic(0, 0, 500, 500, scene, 0, 0));

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
            // this.scene.input.on('dragstart', (pointer, gameObject, dragX, dragY) => {
            //     if (gameObject.type == 'PlayerPhone') {
            //         const playerPhone = gameObject;
            //         console.log('dragstart', playerPhone.mode);
            //     }
            // });
            this.scene.input.on('drag', (pointer, gameObject, dragX, dragY) => {
                if (gameObject.type == 'PlayerPhone') {
                    const playerPhone = gameObject;
                    if (playerPhone.cell.x == null) {
                        this.scene.currentPlayer = gameObject;
                        gameObject.x = dragX;
                        gameObject.y = dragY;
                    }
                }
            });
            this.scene.input.on('dragend', (pointer, gameObject, dropped) => {
                if (gameObject.type == 'PlayerPhone') {
                    if (!dropped) {
                        gameObject.x = gameObject.input.dragStartX;
                        gameObject.y = gameObject.input.dragStartY;
                    }
                }
            });
            this.scene.input.on('drop', (pointer, gameObject, zone) => {
                // debugger;
                if (gameObject.type == 'PlayerPhone') {
                    const playerPhone = gameObject;
                    // console.log('drop', this.scene.isTutorial, playerPhone.cell.x);
                    if (playerPhone.cell.x == null) {

                        if (this.scene.isTutorial && !(zone.cellX == 12 && zone.cellY == 12)) {
                            // debugger;
                            playerPhone.x = playerPhone.input.dragStartX;
                            playerPhone.y = playerPhone.input.dragStartY;

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
                            this.scene.isTutorial = false;
                        }
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

        updateBG() {
            this.bg.clear();
            if (this.mode === 'cell') {
                this.bg.fillStyle(Phaser.Display.Color.HSLToColor(0, 1, 1).color, 1);
            } else if (this.mode === 'rotate') {
                this.bg.fillStyle(Phaser.Display.Color.HSLToColor(0, 0, 0.8).color, 1);
            }
            this.bg.fillRect(-250, -250, 500, 500);
            this.bg.strokeRect(-250, -250, 500, 500);
        }


        toString() {
            const m = {
                'idle': 'I',
                'cell': 'C',
                'rotate': 'R',
            }[this.mode];
            if (this.cell) {
                if (this.cell.x != null) {
                    return `P:${this.playerID}, ` +
                        `${m}:${this.fluidLevel.toFixed(1)} ` +
                        `(${this.cell.x},${this.cell.y}) ` +
                        `[` +
                        `${this.cell.pipeType}, ${this.cell.pipeDir}, ` +
                        `${(this.cell.progress / this.cell.duration).toFixed(2)}, d=${this.cell.duration}]`;
                } else {
                    return `P:${this.playerID}, ` +
                        `${m}:${this.fluidLevel.toFixed(1)} ` +
                        `[` +
                        `${this.cell.pipeType}, ${this.cell.pipeDir}, ` +
                        `${(this.cell.progress / this.cell.duration).toFixed(2)}, d=${this.cell.duration}]`;
                }
            }
            return `P:${this.playerID}, ` +
                `${m}:${this.fluidLevel.toFixed(1)} `;
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
            this.hudContainer = null;
            this.playerPhones = {};
            // pipeGame.playerJoined.add((...params) => this.onPlayerAdded(...params));
            pipeGame.playerUpdated.add((...params) => this.onPlayerUpdated(...params));
            pipeGame.scoreUpdated.add((...params) => this.onScoreUpdated(...params));
            pipeGame.mapUpdated.add((...params) => this.onMapUpdated(...params));
            pipeGame.gameIsOver.add((finalScore) => this.onGameIsOver(finalScore));


            this.debugText = null;
            this.scoreText = null;
            this.gameOverText = null;

            this.scoreHistory = [];


            this.isTutorial = true;
        }

        preload() {
            this.load.image('start_button', './images/kenney/onscreencontrols/Sprites/shadedLight/shadedLight42.png');
            this.load.image('button', './images/kenney/onscreencontrols/Sprites/shadedLight/shadedLight12.png');
            this.load.image('add_button', './images/kenney/onscreencontrols/Sprites/shadedLight/shadedLight18.png');
            this.load.image('right_button', './images/kenney/onscreencontrols/Sprites/shadedLight/shadedLight16.png');

        }
        create() {
            window.scene = this;
            this.mapContainer = this.add.container(0, 0).setName('mapContainer');
            this.playerContainer = this.add.container(0, 0).setName('playerContainer');
            this.uiContainer = this.add.container(0, 0).setName('uiContainer');
            this.arrowContainer = this.add.container(0, 0).setName('arrowContainer');
            this.hudContainer = this.add.container(0, 0).setName('hudContainer');

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
            this.mapGraphics.forEach((col, x) => {
                col.forEach((cellGraphic, y) => {
                    cellGraphic.setPosition(x * this.cellWidth + this.cellWidth / 2, y * this.cellHeight + this.cellHeight / 2);
                    cellGraphic.init();
                })
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
            connectSocket();
        }

        update(time, delta) {
            this.updateBoard();
            // this.updatePlayerCell();
            // if (this.key1.isDown) this.currentPlayer = 1;
            // if (this.key2.isDown) this.currentPlayer = 2;
            // if (this.key3.isDown) this.currentPlayer = 3;
            // if (this.key4.isDown) this.currentPlayer = 4;
            // if (this.key5.isDown) this.currentPlayer = 5;

            // this.debugText.setText(this.playerPhones.map(p => p.toString()).join('\n'));
        }

        updateBoard() {
            function isFull(cell) {
                if (cell.duration < 0) return null;
                return cell.progress >= cell.duration;
            }
            pipeGame.iterateMap((cell, x, y) => {
                // console.log(x,y);

                const cellGraphic = this.mapGraphics[x][y];
                // if (isFull(cell)) {
                cellGraphic.drawPipe({
                    pipeType: cell.pipeType,
                    pipeDir: cell.pipeDir,
                });
                cellGraphic.updatePipeFill({
                    inList: cell.inList,
                    outList: cell.outList,
                    duration: cell.duration,
                    progress: cell.progress,

                });
                // }
            });
            this.updatePlayerCell();
        }

        updatePlayerCell() {
            for (const [_, playerPhone] of Object.entries(this.playerPhones)) {
                if (playerPhone.cell) {
                    playerPhone.cellGraphic.drawPipe(playerPhone.cell);
                }
            }
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
            startBtn.on('pointerup', () => {
                if (!this.isTutorial) {
                    pipeGame.startGame();
                    startBtn.setVisible(false);
                }
            });

            let addBtn;
            this.uiContainer.add(addBtn = this.add.image(150, 400, 'add_button'));
            addBtn.setInteractive().on('pointerdown', () => {
                addBtn.setTint(0xAAAAAA);

            });
            this.input.on('pointerup', () => {
                addBtn.setTint(0xFFFFFF);
            });
            addBtn.on('pointerup', () => {
                const playerPhone = this.playerPhones[pipeGame.playerID];
                if ((!playerPhone.cell || playerPhone.cell.x == null) || playerPhone.cell.progress >= playerPhone.cell.duration) {
                    if (playerPhone.mode === 'idle') {
                        pipeGame.playerGetCell(playerPhone.playerID);
                    } else if (playerPhone.mode === 'cell') {
                        pipeGame.playerPickUpCell(playerPhone.playerID);
                    }
                }
            });


            //////////////////////////////////////////////////////////

            const deltas = [
                [1, 0],
                [0, 1],
                [-1, 0],
                [0, -1],
            ];

            this.dirButtons = deltas.map((delta, dirIndex) => {

                let dirBtn;
                this.arrowContainer.add(dirBtn = this.add.image(250 + delta[0] * 200, 250 + delta[1] * 200, 'right_button'));
                dirBtn.setScale(1.5);
                dirBtn.setAngle(dirIndex * 90);
                dirBtn.setInteractive().on('pointerdown', () => {
                    dirBtn.setTint(0xAAAAAA);
                    pipeGame.onPlayerClickEdge(pipeGame.playerID, dirIndex);
                });
                this.input.on('pointerup', () => {
                    dirBtn.setTint(0xFFFFFF);
                });
                // dirBtn.on('pointerup', () => {
                // });
            });
            this.arrowContainer.setVisible(false);

            //////////////////////////////////////////////////////////


            this.hudContainer.add(this.debugText = this.add.text(500, 0, 'debug_mode', { color: 'black', align: 'right' }));
            this.debugText.setOrigin(1, 0);

            this.hudContainer.add(this.scoreText = this.add.text(20, 20, '--', { fontSize: '24px', color: 'black' }));
            this.hudContainer.add(this.gameOverText = this.add.text(250, 250, 'Game Over', {
                color: 'black',
                fontSize: '64px',
            }));
            this.gameOverText.setOrigin(0.5);
            this.gameOverText.setAlpha(0.3);
            this.gameOverText.setVisible(false);
        }

        onPlayerAdded({ playerID }) {
            let player;
            this.playerContainer.add(player = new PlayerPhone(playerID, this, 250, 250));
            this.playerPhones[playerID] = player;

        }

        onPlayerUpdated(data) {
            // console.log('onPlayerUpdated', data);

            const { playerID, mode, fluidLevel, score, cell } = data;
            // const {
            //     x,
            //     y,
            //     pipeType,
            //     pipeDir,
            //     duration,
            //     progress,
            //     inList,
            //     outList,
            // } = cell;

            if (score && ('Score: ' + score) != this.scoreText.text) {
                this.scoreText.setText(`Score: ${score}`);
                this.scoreHistory.push(score);
                // console.log('scoreHistory', this.scoreHistory);
            }


            if (playerID === 0 && cell && cell.x != null) {
                this.isTutorial = false;
            }
            if (playerID !== pipeGame.playerID) return;
            // console.log('onPlayerUpdated', data);

            this.playerPhones[playerID].mode = mode;
            this.playerPhones[playerID].updateBG();
            this.playerPhones[playerID].fluidLevel = fluidLevel;
            if (mode !== 'idle') {
                this.playerPhones[playerID].cell = cell;
                this.playerPhones[playerID].drawCell(cell);

                this.playerContainer.setVisible(true);
                this.arrowContainer.setVisible(true);
            } else {
                this.playerPhones[playerID].cell = null;
                this.playerContainer.setVisible(false);
                this.arrowContainer.setVisible(false);
            }
        }

        onMapUpdated({ map }) {

        }

        onScoreUpdated(playerID, addition, totalScore) {
            const playerPhone = this.playerPhones[playerID];
            if (!playerPhone) {
                console.warn('playerPhone not found: ' + playerID);
                return;
            }

            let scoreText;

            this.hudContainer.add(scoreText = this.add.text(playerPhone.x, playerPhone.y, `+${addition}`, { color: 'black', fontSize: '24px', fontWeight: 700 }));
            scoreText.setOrigin(0.5);
            const duration = addition > 1 ? 6 : 3;
            this.tweens.add({
                targets: scoreText,
                y: playerPhone.y - 50,
                duration: duration * 1000,
                onComplete: () => scoreText.destroy()
            });
        }

        onGameIsOver(finalScore) {
            // const playerPhone = this.playerPhones[pipeGame.playerID];
            // playerPhone.drawCell(pipeGame.map[playerPhone.cellX][playerPhone.cellY]);
            this.gameOverText.visible = true;
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
