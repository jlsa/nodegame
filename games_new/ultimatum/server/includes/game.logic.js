/**
 * # Logic code for Ultimatum Game
 * Copyright(c) 2013 Stefano Balietti
 * MIT Licensed
 *
 * Handles bidding, and responds between two players.
 * Extensively documented tutorial.
 *
 * Info:
 * Matching, and stepping can be done in different ways. It can be 
 * centralized, and the logic tells the clients when to step, or
 * clients can synchronize themselves and step automatically.
 *
 * In this game, the logic is synchronized with the clients. The logic
 * will send automatically game-commands to start and step
 * through the game plot whenever it enters a new game step.
 *
 * http://www.nodegame.org
 * ---
 */

var path = require('path');

var Database = require('nodegame-db').Database;
// Variable _node_ is shared by the requiring module
// (game.room.js) through `channel.require` method.
var ngdb = new Database(module.parent.exports.node);
var mdb = ngdb.getLayer('MongoDB');

var ngc = require('nodegame-client');
var Stager = ngc.Stager;
var stepRules = ngc.stepRules;
var GameStage = ngc.GameStage;
var J = ngc.JSUS;

var stager = new Stager();

// Variable registered outside of the export function are shared among all
// instances of game logics.
var counter = 0;
var MIN_PLAYERS = 2;
var PLAYING_STAGE = 2;

// Here we export the logic function. Receives three parameters:
// - node: the NodeGameClient object.
// - channel: the ServerChannel object in which this logic will be running.
// - gameRoom: the GameRoom object in which this logic will be running. 
module.exports = function(node, channel, gameRoom) {
 
    // Reads in descil-mturk configuration.
    var confPath = path.resolve(__dirname, '..', 'descil.conf.js');
    var dk = require('descil-mturk')(confPath);
    dk.getCodes(function() {
        debugger
        if (!dk.codes.size()) {
            throw new Error('game.logic: no codes found.');
        }
    });

    function doMatch() {
        var g, bidder, respondent, data_b, data_r;
        
        g = node.game.pl.shuffle();
        bidder = g.first();
        respondent = g.last();
        
        data_b = {
	    role: 'bidder',
	    other: respondent.id
        };
        data_r = {
	    role: 'respondent',
	    other: bidder.id
        };
        // Send a message to each player with their role
        // and the id of the other player.
        node.say('BIDDER', bidder.id, data_b);
        node.say('RESPONDENT', respondent.id, data_r);
        console.log('Matching completed.');
    }

    // Event handler registered in the init function are always valid.
    stager.setOnInit(function() {
        console.log('********************** ultimatum room ' + counter++ + ' **********************');

        var disconnected;
        disconnected = {};

        // Reconnections must be handled by the game developer.
        node.on.preconnect(function(p) {
            console.log('Oh...somebody reconnected!', p);
            if (disconnected[p.id]) {
                // Delete countdown to terminate the game.
                clearTimeout(this.countdown);
                // Notify other player he is back.
                node.socket.send(node.msg.create({
                    target: 'PCONNECT',
                    data: p,
                    to: 'ALL'
                }));
                delete disconnected[p.id];
            }
            else {
                // Player was not authorized, redirect to a warning page.
                node.redirect('/ultimatum/unauth.htm', p.id);
            }
            
        });

        // Register player disconnection, and wait for him...
        node.on.pdisconnect(function(p) {
            disconnected[p.id] = {
                id: p.id,
                stage: p.stage
            }
        });

        // Update the Payoffs
        node.on.data('response', function(msg) {
	    var resWin, bidWin, p, response;
            response = msg.data;

	    if (!response) {
                // TODO handle error.
                return;
            }

	    if (response.response === 'ACCEPT') {

		resWin = parseInt(response.value);
		bidWin = 100 - resWin;
		
		// Respondent payoff.
		p = dk.codes.id.get(msg.from);
                if (!p) {
                    console.log('AAAH not P!');
                    return;
                }

		p.win = (!p.win) ? resWin : p.win + resWin;
		node.log('Added to respondent ' + msg.from + ' ' +
                         response.value + ' ECU');
		
		// Bidder payoff
		p = dk.codes.id.get(response.from);
                
                if (!p) {
                    console.log('AAAH not P2!');
                    return;
                }

		p.win = (!p.win) ? bidWin : p.win + bidWin;
		node.log('Added to bidder ' + p.clientId + ' ' + p.win + ' ECU');
	    }
	});

        console.log('init');
    });

     // Event handler registered in the init function are always valid.
    stager.setOnGameOver(function() {
        console.log('************** GAMEOVER ' + gameRoom.name + '****************');
        // TODO: update database.
        channel.destroyGameRoom(gameRoom.name);
    });

    // Functions
    
    function instructions() {
        console.log('Instructions');
    }
    
    function quiz() {
        console.log('Quiz');
    }

    function ultimatum() {
        console.log('Ultimatum');
        doMatch();
    }
    
    function questionnaire() {
        console.log('questionnaire');
    }
    
    function endgame() {
        var code, exitcode, accesscode;
        console.log('endgame');

        node.game.pl.each(function(p) {
            code = dk.codes.id.get(p.id);
            if (!code) {
                console.log('ERROR: no code in endgame:', p.id);
                return;
            }
            
            accesscode = code.AccessCode;
	    exitcode = code.ExitCode;
	    code.win = (p.win || 0) / 1000;
	    dk.checkOut(accesscode, exitcode, code.win);
	    node.say('WIN', p.id, p.win);
	});
	console.log('FINAL PAYOFF PER PLAYER');
	console.log('***********************');
	console.log(node.game.pl.keep(['mtid', 'win']).fetch());
	console.log('***********************');
	
	console.log('Game ended');
    } 
    
    function notEnoughPlayers() {
        console.log('Warning: not enough players!!');
        this.countdown = setTimeout(function() {
            console.log('Countdown fired. Game terminated.');
            // TODO needs to update the player in the registry too.
            node.redirect('/ultimatum/gameterminated.html', 'ALL');
            node.game.gameover();
        }, 30000);
    }

    // Set default step rule.
    stager.setDefaultStepRule(stepRules.OTHERS_SYNC_STEP);
    
    // Adding the stages. We can later on define the rules and order that
    // will determine their execution.
    stager.addStage({
        id: 'instructions',
        cb: instructions,
        minPlayers: [ 2, notEnoughPlayers ],
    });

    stager.addStage({
        id: 'quiz',
        cb: quiz,
        minPlayers: [ 2, notEnoughPlayers ],
    });

    stager.addStage({
        id: 'ultimatum',
        cb: ultimatum,
        minPlayers: [ 2, notEnoughPlayers ],
    });

    stager.addStage({
        id: 'questionnaire',
        cb: questionnaire
    });
    
    stager.addStage({
        id: 'endgame',
        cb: endgame
    });

    // Building the game plot.
    var REPEAT = 1;

    // Here we define the sequence of stages of the game (game plot).
    stager
        .init()
        .next('instructions')
        .next('quiz')
        .repeat('ultimatum', REPEAT)
        .next('questionnaire')
        .next('endgame')
        .gameover();

    // Here we group together the definition of the game logic.
    return {
        nodename: 'lgc' + counter,
        game_metadata: {
            name: 'ultimatum',
            version: '0.0.1'
        },
        game_settings: {
            // Will not publish any update of stage / stageLevel, etc.
            publishLevel: 0,
            // Will send a start / step command to ALL the clients when
            // the logic will start / step through the game.
            // This option requires that the game plots of the clients
            // and logic are symmetric or anyway compatible.
            syncStepping: true
        },
        // Extracts, and compacts the game plot that we defined above.
        plot: stager.getState(),
        // If debug is false (default false), exception will be caught and
        // and printed to screen, and the game will continue.
        debug: true,
        // Controls the amount of information printed to screen.
        verbosity: 0,
        // nodeGame enviroment variables.
        env: {
            auto: false
        }
    };

};
