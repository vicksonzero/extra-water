/*global $: true, console: true */

var Signal = require('signals');

// $(function () {
// "use strict";



function Game() {

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
            // console.log('updateProgress', this.pipeType, this.progress);

            if (this.pipeType === '-') this.progress = Math.max(Math.floor(0.4 * this.duration), this.progress);
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


        getDirs() {

            const dirIndexList = {
                '+': [0, 1, 2, 3],
                'T': [0, 1, 2],
                'L': [0, 3],
                '|': [1, 3],
                '-': [0],
            };

            const dirs = dirIndexList[this.pipeType].map((i) => (i + this.pipeDir) % 4);

            return dirs;
        }

        getDeltas() {
            const deltas = [
                [1, 0],
                [0, 1],
                [-1, 0],
                [0, -1],
            ];
            return this.getDirs().map((i) => deltas[i]);
        }

        getNeighbors() {
            return this.getDeltas().map((delta) => this.getNeighbor(...delta));
        }

        canCompleteCycle() {
            const deltas = [
                [1, 0],
                [0, 1],
                [-1, 0],
                [0, -1],
            ];

            // debugger;
            return this.getDirs().filter((dir) => {
                const delta = deltas[dir];
                const neighbor = this.getNeighbor(...delta);

                return neighbor.isFull() && neighbor.getDirs().some((d) => (d + 2) % 4 === dir);
            }).length >= 2;
        }

        pourToNeighbors(newDuration, fronts, players) {
            const deltas = [
                [1, 0],
                [0, 1],
                [-1, 0],
                [0, -1],
            ];


            const dirs = this.getDirs();

            dirs.forEach((i) => {
                const delta = deltas[i];
                const cell = this.getNeighbor(...delta);
                if (!cell) return;
                if (cell.pipeType === '') return;

                const inDir = (i + 2) % 4;
                if (cell.isFull()) return;
                if (!cell.canInputFrom(inDir)) return;

                const player = players.find((player) => {
                    return (player.mode === 'cell' &&
                        player.cellX === cell.x && player.cellY === cell.y
                    );
                });
                player.updateFluidDuration();
                cell.activatePipe(this.progress - this.duration, player.fluidDuration, [(i + 2) % 4]);
                fronts.add(cell);
            })
        }
        toJSON() {
            const {
                x, y,
                pipeType, pipeDir,
                duration, progress,
                inList, outList,
            } = this;
            return {
                x, y,
                pipeType, pipeDir,
                duration, progress,
                inList: inList.slice(),
                outList: outList.slice(),
            };
        }

        getPipeConfig() {
            const {
                x, y,
                pipeType, pipeDir,
                duration, progress,
                inList, outList,
            } = this;
            return {
                x, y,
                pipeType, pipeDir,
                // duration, progress,
                // inList: inList.slice(),
                // outList: outList.slice(),
            };
        }

        getPipeProgress() {
            const {
                x, y,
                pipeType, pipeDir,
                duration, progress,
                inList, outList,
            } = this;
            return {
                // x, y,
                // pipeType, pipeDir,
                duration, progress,
                inList: inList.slice(),
                outList: outList.slice(),
            };
        }
    }

    class Player {
        constructor(i, { fluidTable }) {
            this.playerID = i;
            this.fluidTable = fluidTable.slice();
            this.fluidDuration = 3000;
            this.fluidLevel = 0;
            this.mode = 'idle'; // 'idle', 'rotate', 'cell'
            this.cell = null;
            this.cellX = null;
            this.cellY = null;
        }

        setViewXY(cellX, cellY) {
            this.cellX = cellX;
            this.cellY = cellY;
        }

        setCell(cell) {
            this.cell = cell;
        }

        addFluidLevel(amt) {
            this.fluidLevel += amt;
            this.fluidLevel = Math.max(0, this.fluidLevel);
            this.updateFluidDuration();
        }

        updateFluidDuration() {
            const { count, duration } = this.fluidTable.find(({ count, duration }) => count >= this.fluidLevel);
            this.fluidDuration = duration;
        }
    }

    const pipeGame = {
        gameid: '',
        gridWidth: 25,
        gridHeight: 25,

        map: [],
        fronts: new Set(),
        fluidDuration: 5000,
        last: 0,

        ups: 5,
        players: [],
        samplePlayer: new Player(-1, {
            fluidTable: [
                { count: 0, duration: 8000 },
                { count: 2, duration: 7500 },
                { count: 6, duration: 6000 },
                { count: 10, duration: 5000 },
                { count: 15, duration: 4000 },
                { count: 20, duration: 3000 },
                { count: 30, duration: 1000 },
            ],
        }),
        connectCommand: { leftPlayer: null, leftOut: null, rightPlayer: null, rightIn: null },
        playerJoined: new Signal(),
        playerUpdated: new Signal(),
        scoreUpdated: new Signal(),
        mapUpdated: new Signal(),
        gameIsOver: new Signal(),

        score: 0,

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
            setTimeout(() => this.sendState(), 1000 / this.ups);
        },

        startGame() {
            this.last = Date.now();
            setTimeout(() => this.updateFluid(), 1000 / this.ups);
        },

        sendState() {
            if (this.players.length > 0) {
                this.dispatchPlayerChange();
            }

            setTimeout(() => this.sendState(), 1000 / this.ups);
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
            this.updateScore();
            this.fronts.forEach((cell) => {
                // console.log(cell.isFull());

                if (cell.isFull()) {
                    cell.pourToNeighbors(this.fluidDuration, this.fronts, this.players);

                    const player = this.players.find((player) => {
                        return (player.mode === 'cell' &&
                            player.cellX === cell.x && player.cellY === cell.y
                        );
                    });
                    player.mode = 'idle';
                }
            });
            this.fronts.forEach((cell) => {
                cell.updateOutList();
            });

            this.players.forEach((player) => {
                if (player.mode === 'idle') {

                    player.addFluidLevel(-delta / 1000 / 5 * 0.8);
                }
            })

            // this.dispatchPlayerChange();

            if (this.fronts.size > 0) {
                this.last = Date.now();
                setTimeout(this.updateFluid.bind(this), 1000 / this.ups);
            } else {
                console.log('game over');
                this.gameOver();
            }
        },

        updateScore() {
            this.fronts.forEach((cell) => {
                let score = 0;
                const playerID = this.players.findIndex((player) => {
                    return (player.mode === 'cell' &&
                        player.cellX === cell.x && player.cellY === cell.y
                    );
                });
                // console.log(`Player-${playerID}`);

                if (cell.isFull()) {
                    score += 1;
                    const neighbours = cell.getNeighbors();
                    // debugger;
                    // console.log('updateScore', playerID, neighbours);

                    if (cell.canCompleteCycle()) {
                        score += 4;
                    }
                    this.players[playerID].addFluidLevel(1);
                    this.addScore(playerID, score);

                }
            });
        },

        dispatchPlayerChange() {
            const map = this.serializeMap();
            this.players.forEach((player) => {
                if (player.mode === 'cell') {
                    const cell = this.map[player.cellX][player.cellY];
                    // console.log('dispatchPlayerChange cell');

                    this.playerUpdated.dispatch({
                        playerID: player.playerID,
                        fluidLevel: player.fluidLevel,
                        mode: player.mode,
                        score: this.score,
                        map: map,
                        cell: {
                            x: cell.x,
                            y: cell.y,
                            pipeType: cell.pipeType,
                            pipeDir: cell.pipeDir,
                            duration: cell.duration,
                            progress: cell.progress,
                            inList: cell.inList.slice(),
                            outList: cell.outList.slice(),
                        },
                    });
                } else if (player.mode === 'rotate') {
                    const cell = player.cell;
                    // console.log('dispatchPlayerChange rotate');

                    this.playerUpdated.dispatch({
                        playerID: player.playerID,
                        fluidLevel: player.fluidLevel,
                        mode: player.mode,
                        score: this.score,
                        map: map,
                        cell: {
                            x: cell.x,
                            y: cell.y,
                            pipeType: cell.pipeType,
                            pipeDir: cell.pipeDir,
                            duration: cell.duration,
                            progress: cell.progress,
                            inList: cell.inList.slice(),
                            outList: cell.outList.slice(),
                        },
                    });
                } else if (player.mode === 'idle') {
                    const cell = player.cell;
                    // console.log('dispatchPlayerChange idle');

                    this.playerUpdated.dispatch({
                        playerID: player.playerID,
                        fluidLevel: player.fluidLevel,
                        mode: player.mode,
                        score: this.score,
                        map: map,
                        // cell: {
                        //     x: cell.x,
                        //     y: cell.y,
                        //     pipeType: cell.pipeType,
                        //     pipeDir: cell.pipeDir,
                        //     duration: cell.duration,
                        //     progress: cell.progress,
                        //     inList: cell.inList.slice(),
                        //     outList: cell.outList.slice(),
                        // },
                    });
                }
            });
        },

        dispatchMapChange() {
            const map = this.map.map((col, x) => col.map((cell, y) => cell.getPipeConfig()));
            this.mapUpdated.dispatch({
                map,
            });
        },

        playerJoin() {
            let player;
            this.players.push(player = new Player(this.players.length, this.samplePlayer));
            console.log('Player joined:', player.playerID);
            this.playerJoined.dispatch({
                map: this.serializeMap(),
                playerID: player.playerID,
            });
            this.dispatchPlayerChange();
            return player;
        },

        playerPutCell({ playerID, cell, cellX, cellY }) {
            const player = this.players[playerID];
            if (!player) throw new Error('playerPutCell: player not found: ' + playerID);

            player.updateFluidDuration();
            // console.log('playerPutCell', playerID, cell.getPipeConfig(), cellX, cellY, player.fluidDuration);
            const currentCell = this.map[cellX][cellY];
            if (currentCell.progress <= 0 || currentCell.duration < 0) {
                this.addCell(cellX, cellY, cell.pipeType, cell.pipeDir, player.fluidDuration);
                player.cellX = cellX;
                player.cellY = cellY;
                player.mode = 'cell';
                // this.dispatchPlayerChange();
            } else {
                console.log('playerPutCell: existing cell');

                player.mode = 'cell';
                // this.dispatchPlayerChange();

            }
        },

        onPlayerClickEdge(playerID, edgeDir) {
            // edgeDir = 0,1,2,3 (0=right, 1=bottom)
            const player = this.players[playerID];
            const cell = player.cell;
            if (this.connectCommand.leftPlayer == null) {
                this.connectCommand.leftPlayer = player;
                this.connectCommand.leftOut = edgeDir;
            } else if (this.connectCommand.leftPlayer === player) {
                this.connectCommand.leftPlayer = null;
                this.connectCommand.leftOut = null;
            } else if (this.connectCommand.rightPlayer == null) {
                if (this.connectCommand.leftPlayer.mode === 'cell' || player.mode === 'cell') {
                    this.connectCommand.rightPlayer = player;
                    this.connectCommand.rightIn = edgeDir;

                    this.connectCellsByEdge(this.connectCommand);
                    this.connectCommand.leftPlayer = null;
                    this.connectCommand.leftOut = null;
                    this.connectCommand.rightPlayer = null;
                    this.connectCommand.rightIn = null;
                } else {
                    this.connectCommand.leftPlayer = null;
                    this.connectCommand.leftOut = null;
                }
            } else {
                // nothing
            }
            // this.dispatchPlayerChange();
        },
        connectCellsByEdge(connectCommand) {
            const realLeft = connectCommand.leftPlayer.mode === 'cell' ? connectCommand.leftPlayer : connectCommand.rightPlayer;
            const realLeftDir = connectCommand.leftPlayer.mode === 'cell' ? connectCommand.leftOut : connectCommand.rightIn;
            const realRight = connectCommand.leftPlayer.mode === 'cell' ? connectCommand.rightPlayer : connectCommand.leftPlayer;
            const realRightDir = connectCommand.leftPlayer.mode === 'cell' ? connectCommand.rightIn : connectCommand.leftOut;

            const targetDir = realLeftDir; // direction in world space
            // console.log('targetDir: ' + targetDir);

            // rotate right until matchine
            let rightPointingAt = realRightDir;
            while (rightPointingAt != ((targetDir + 2) % 4)) {
                realRight.cell.pipeDir += 1;
                realRight.cell.pipeDir %= 4;
                rightPointingAt += 1;
                rightPointingAt %= 4;
            }
            // console.log('realRight.pipeDir: ' + realRight.cell.pipeDir);
            const deltas = [
                [1, 0],
                [0, 1],
                [-1, 0],
                [0, -1],
            ];

            this.playerPutCell({
                playerID: realRight.playerID,
                cell: realRight.cell,
                cellX: realLeft.cellX + deltas[targetDir][0],
                cellY: realLeft.cellY + deltas[targetDir][1],
            });
        },
        playerPickUpCell(playerID) {
            const player = this.players[playerID];
            if (!player) throw new Error('playerPickUpCell: player not found: ' + playerID);

            // debugger;
            const cell = (this.map[player.cellX] || {})[player.cellY];
            if (!cell) throw new Error('playerPickUpCell: cell not found: ' + player.cellX + ',' + player.cellY);


            // console.log('playerPickUpCell', playerID, player.mode, cell.isFull());

            if (player.mode === 'cell') {
                if (cell.isFull()) {
                    console.log('playerPickUpCell isFull');

                    player.mode = 'idle';
                    this.playerGetCell(playerID);
                }
            }
        },
        playerGetCell(playerID) {
            const player = this.players[playerID];
            if (!player) throw new Error('playerGetCell: player not found: ' + playerID);

            console.log('playerGetCell', playerID, player.mode);

            if (player.mode === 'idle') {
                if (this.fronts.size <= 0) {
                    player.setCell(new Cell({
                        pipeGame: this,
                        pipeType: '-',
                        pipeDir: Math.floor(Math.random() * 4),
                    }));
                    player.mode = 'rotate';
                    this.playerPutCell({ playerID, cell: player.cell, cellX: 12, cellY: 12 });
                    // this.dispatchPlayerChange();
                } else {
                    player.setCell(new Cell({
                        pipeGame: this,
                        pipeType: ['+', 'T', 'L', '|'][Math.floor(Math.random() * 4)],
                        pipeDir: Math.floor(Math.random() * 4),
                    }));
                    player.mode = 'rotate';
                    // console.log('playerGetCell', playerID, player.cell.pipeType, player.cell.pipeDir);

                    // this.dispatchPlayerChange();
                }
            }
        },

        playerRotate(playerID) {
            const player = this.players[playerID];
            if (!player) throw new Error('playerGetCell: player not found: ' + playerID);
            // console.log('playerRotate', playerID);

            if (player.mode === 'rotate') {
                player.cell.pipeDir += 1;
                player.cell.pipeDir %= 4;
                // this.dispatchPlayerChange();
            }
        },

        addCell(x, y, pipeType, pipeDir, fluidDuration) {
            const cell = this.map[x][y];

            cell.pipeType = pipeType || '-';
            cell.pipeDir = pipeDir;
            cell.activatePipe(0, fluidDuration, []);
            cell.updateOutList();
            if (this.fronts.size <= 0) this.fronts.add(cell);
        },

        addScore(playerID, score) {
            this.score += score;
            console.log('addScore', this.score);

            this.scoreUpdated.dispatch(playerID, score, this.score);
        },
        gameOver() {
            console.log('gameOver', this.score, this.serializeMap().length);
            this.gameIsOver.dispatch(this.score, this.serializeMap());
        },

        serializeMap() {
            return (
                this.map.map((col, x) => col.map((cell, y) => cell.toJSON()))
            );
        }
    };
    return pipeGame;
}
module.exports = Game;
