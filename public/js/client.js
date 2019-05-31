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
        constructor(game, x, y) {
            this.game = game;
            this.x = x;
            this.y = y;

            // state
            this.pipeType = '';
            this.pipeDir = '';

            this.duration = -1; // in ms
            this.progress = 0; // in ms
        }

        getNeighbor(dx, dy) {
            return ((this.game[this.x + dx] || {})[this.y + dy] || {});
        }
    }

    const pipeGame = {
        gridWidth: 25,
        gridHeight: 25,
        initMap() {
            this.map = (new Array(this.gridWidth)
                .fill(1)
                .map((_, x) => {
                    return (new Array(this.gridHeight)
                        .fill(1)
                        .map((_, y) => new Cell(this, x, y))
                    );
                }));
        },
        map: [],

    };


    // game class
    class Game extends Phaser.Game {
        constructor(config) {
            super(config);
        }
    }

    class CellGraphic extends Phaser.GameObjects.Container {

        constructor(scene, x, y, children) {
            super(scene, x, y, children);
            this.bg = null;
            this.pipe = null;
            this.cellWidth = 0;
            this.cellHeight = 0;
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
        init({ dispX, dispY, w, h, pipeData }) {
            this.cellWidth = w;
            this.cellHeight = h;
            this.setPosition(dispX + w / 2, dispY + h / 2);

            this.bg.clear();
            let color = Phaser.Display.Color.HSLToColor(1, 0.5, 0.5).color;
            this.bg.lineStyle(1, color, 1);
            this.bg.strokeRect(-w / 2, -h / 2, w, h);

            this.bg.fillStyle(color, 0.1);
            this.bg.fillRect(-w / 2, -h / 2, w, h);

            const {
                pipeType,
                pipeDir, // 0, 1, 2, 3
                inList, // 0, 1, 2, 3
                outList, // 0, 1, 2, 3
                duration,
                progress,

            } = pipeData;


            this.pipe.clear();
            color = Phaser.Display.Color.HSLToColor(0.7, 0.1, 0.5).color;
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
            }

            this.pipe.angle = pipeDir * 90;
        }

        updatePipeFill(pipeData) {
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

            this.fill.clear();

            // if not yet fill
            if (duration < 0) return;

            let color = Phaser.Display.Color.HSLToColor(0.7, 1, 0.5).color;
            const pipeWidth = 5;
            this.fill.lineStyle(pipeWidth, color, 1);

            const [w2, h2, pipeWidth2] = [w / 2, h / 2, pipeWidth / 2];

            const inPercent = Math.min(0.5, progress / duration) * 2;
            console.log(inPercent);

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
            const outPercent = Math.max(0, progress / duration - 0.5) * 2;

            outList.forEach((input) => {
                switch (input) {
                    case 0: { // to right
                        this.fill.lineBetween(pipeWidth2, 0, pipeWidth2 + ((w2 - pipeWidth2) * outPercent), 0);
                    } break;
                    case 1: { // to bottom
                        this.fill.lineBetween(0, pipeWidth2, 0, pipeWidth2 + ((h2 - pipeWidth2) * outPercent));
                    } break;
                    case 2: { // to left
                        this.fill.lineBetween(-pipeWidth2, 0, -pipeWidth2 - ((w2 - pipeWidth2) * outPercent), 0);
                    } break;
                    case 3: { // to top
                        this.fill.lineBetween(0, -pipeWidth2, 0, -pipeWidth2 - ((h2 - pipeWidth2) * outPercent));
                    } break;
                }

            });

        }
    }


    class MainScene extends Phaser.Scene {
        constructor(config) {
            super(config);
            this.cellWidth = 20;
            this.cellHeight = 20;
            this.mapGraphics = null;
        }

        preload() {

        }
        create() {
            this.cameras.main.setBackgroundColor('#AAAAAA');
            this.mapGraphics = (new Array(pipeGame.gridWidth)
                .fill(1)
                .map((_, x) => {
                    return (new Array(pipeGame.gridHeight)
                        .fill(1)
                        .map((_, y) => {
                            const cellGraphic = new CellGraphic(this);
                            this.add.existing(cellGraphic);
                            cellGraphic.createUI();
                            cellGraphic.init({
                                dispX: x * this.cellWidth,
                                dispY: y * this.cellHeight,
                                w: this.cellWidth,
                                h: this.cellHeight,
                                pipeData: {
                                    pipeType: ['', '+', 'T', 'L', '|'][Math.floor(Math.random() * 5)],
                                    pipeDir: Math.floor(Math.random() * 4),
                                    inList: [],
                                    outList: [],
                                    duration: -1,
                                    progress: 0,
                                }
                            });
                            cellGraphic.updatePipeFill({
                                // pipeType: ['', '+', 'T', 'L', '|'][Math.floor(Math.random() * 5)],
                                // pipeDir: Math.floor(Math.random() * 4),
                                inList: [],
                                outList: [2],
                                duration: 4,
                                progress: Math.random() * 4,

                            });
                            return cellGraphic;
                        })
                    );
                }));
        }

        update(time, delta) {

        }

        updateBoard() {
            // this.mapGraphics.forEach
            pipeGame.map.forEach((col, x) => {
                col.forEach((cell, y) => {
                    const cellGraphic = this.mapGraphics[x][y];
                });
            })

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
