import '../imports/roles.js';

function generateAccessCode() {
  var code = '';
  var possible = 'abcdefghijklmnopqrstuvwxyz';

  do {
    for (var i = 0; i < 6; i++) {
      code += possible.charAt(Math.floor(Math.random() * possible.length));
    }
  } while (Games.find({accessCode: code}).count() != 0)

  return code;
}

function generateNewGame() {
  var game = {
    accessCode: generateAccessCode(),
    // the roles included in the game
    roles: [],
    // game states include 'waitingForPlayers', 'selectingRoles', 'settingUp', and 'inProgress'
    state: 'waitingForPlayers',
    // current quest number (1-5)
    quest: 1,
    // player ID of the quest leader
    questLeader: null,
    // players selected to go on a quest
    proposal: [],
    // number of votes to pass the proposal
    votes: 0,
    // number of proposals that were voted down
    failedProposals: 0,
    // number of fails on a quest (as opposed to successes)
    fails: 0,
    // number of failed quests
    failedQuests: 0
  };

  var gameID = Games.insert(game);
  return Games.findOne(gameID);
}

function generateNewPlayer(game, name) {

  var player = {
    gameID: game._id,
    name: name,
    role: null
  }

  var playerID = Players.insert(player);
  return Players.findOne(playerID);
}

function getCurrentGame() {
  var gameID = Session.get('gameID');
  if (gameID) {
    return Games.findOne(gameID);
  }
}

function getAccessLink(){
  var game = getCurrentGame();

  if (!game){
    return;
  }
  return Meteor.settings.public.url + game.accessCode + '/';
}

function getCurrentPlayer() {
  var playerID = Session.get('playerID');
  if (playerID) {
    return Players.findOne(playerID);
  }
}

function resetUserState() {
  var player = getCurrentPlayer();
  var game = getCurrentGame();

  if (player) {
    Players.remove(player._id);
  }

  Session.set('gameID', null);
  Session.set('playerID', null);
}

/* sets the state of the game (which template to render) */
/* types of game state:
    waitingForPlayers (lobby)
    selectingRoles (rolesMenu)
    inProgress (gameView)
 */
function trackGameState() {
  var gameID = Session.get('gameID');
  var playerID = Session.get('playerID');

  if (!gameID || !playerID) {
    return;
  }

  var game = Games.findOne(gameID);
  var player = Players.findOne(playerID);

  if (!game || !player) {
    Session.set('gameID', null);
    Session.set('playerID', null);
    Session.set('currentView', 'startMenu');
    return;
  }

  if (game.state === 'waitingForPlayers') {
    Session.set('currentView', 'lobby');
  } else if (game.state === 'selectingRoles') {
    Session.set('currentView', 'rolesMenu');
  } else if (game.state === 'inProgress') {
    Session.set('currentView', 'gameView');
  }
  // game.state can also be finishedVoting and voting
}

Meteor.setInterval(function () {
  Session.set('time', new Date());
}, 1000);

function hasHistoryApi () {
  return !!(window.history && window.history.pushState);
}

if (hasHistoryApi()){
  function trackUrlState () {
    var accessCode = null;
    var game = getCurrentGame();
    if (game) {
      accessCode = game.accessCode;
    } else {
      accessCode = Session.get('urlAccessCode');
    }

    var currentURL = '/';
    if (accessCode) {
      currentURL += accessCode+'/';
    }
    window.history.pushState(null, null, currentURL);
  }
  Tracker.autorun(trackUrlState);
}

Tracker.autorun(trackGameState);

function leaveGame() {
  var player = getCurrentPlayer();
  Session.set('currentView', 'startMenu');
  Players.remove(player._id);
  Session.set('playerID', null);
  Session.set('turnMessage', null);
  Session.set('errorMessage', null);

  var game = getCurrentGame();
  if (Players.find({gameID: game._id}).count() == 0) {
    Games.remove(game._id);
  }
};

function resetGame() {
  var game = getCurrentGame();
  Games.update(game._id, {$set: {
    roles: [],
    state: 'waitingForPlayers',
    quest: 1,
    questLeader: null,
    proposal: [],
    votes: 0,
    failedProposals: 0,
    fails: 0,
    failedQuests: 0
  }});
}

function endGame() {
  resetGame();
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
}

Template.main.helpers({
  whichView: function() {
    return Session.get('currentView');
  }
});

Template.startMenu.events({
  'click #btn-create-game-view': function() {
    Session.set('currentView', 'createGame');
  },
  'click #btn-join-game-view': function() {
    Session.set('currentView', 'joinGame');
  }
});

Template.startMenu.rendered = function() {
  resetUserState();
};

Session.set('currentView', 'startMenu');

Template.createGame.events({
  'submit #create-game': function(event) {

    var playerName = event.target.playerName.value;
    if (!playerName) {
      return false;
    }

    var game = generateNewGame();
    var player = generateNewPlayer(game, playerName);

    Meteor.subscribe('games', game.accessCode);
    Meteor.subscribe('players', game._id, function onReady() {
      Session.set('gameID', game._id);
      Session.set('playerID', player._id);
      Session.set('currentView', 'lobby');
    });

    return false;
  },
  'click .btn-back-start-menu': function() {
    Session.set('currentView', 'startMenu');
    return false;
  }
})

Template.joinGame.rendered = function (event) {
  resetUserState();

  var urlAccessCode = Session.get('urlAccessCode');

  if (urlAccessCode){
    $("#access-code").val(urlAccessCode);
    $("#access-code").hide();
    $("#player-name").focus();
  } else {
    $("#access-code").focus();
  }
};

Template.joinGame.helpers({
  errorMessage: function() {
    return Session.get('errorMessage');
  }
});

Template.joinGame.events({
  'submit #join-game': function(event) {
    var playerName = event.target.playerName.value;
    var accessCode = event.target.accessCode.value;

    if (!playerName) {
      return false;
    }

    Meteor.subscribe('games', accessCode, function onReady() {
      var game = Games.findOne({
        accessCode: accessCode
      });

      if (game) {

        // TODO if the game is in progress
        if (game.state !== 'waitingForPlayers') {
          Session.set('errorMessage', 'Please wait. Cannot join a game in progress.');
          return false;
        }

        Meteor.subscribe('players', game._id);
        player = generateNewPlayer(game, playerName);

        Session.set('urlAccessCode', null);
        Session.set('gameID', game._id);
        Session.set('playerID', player._id);
        Session.set('currentView', 'lobby');
        Session.set('errorMessage', null);
      } else {
        console.log('invalid access code');
        Session.set('errorMessage', 'Invalid access code.')
      }
    });

    return false;
  },
  'click .btn-back-start-menu': function() {
    Session.set('urlAccessCode', null);
    Session.set('currentView', 'startMenu');
    Session.set('errorMessage', null);
    return false;
  }
})

Template.lobby.helpers({
  game: function() {
    return getCurrentGame();
  },
  players: function() {
    var game = getCurrentGame();
    var currentPlayer = getCurrentPlayer();

    if (!game) {
      return null;
    }

    var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();

    players.forEach(function(player) {
      if (player._id === currentPlayer._id) {
        player.isCurrent = true;
      }
    });

    return players;
  }
})

Template.lobby.events({
  'click .btn-leave': leaveGame,
  'click .btn-start': function() {
    Session.set('currentView', 'rolesMenu');

    var game = getCurrentGame();
    Games.update(game._id, {$set: {state: 'selectingRoles'}});
  }
})

Template.rolesMenu.helpers({
  roleKeys: function() {
    var roleKeys = [];
    for (key in allRoles) {
      roleKeys.push({ key : key, name : allRoles[key].name });
    }
    return roleKeys;
  },
  roles: allRoles,
  errorMessage: function() {
    return Session.get('errorMessage');
  }
})

Template.rolesMenu.events({
  'submit #choose-roles-form': function(event) {
    var gameID = getCurrentGame()._id;
    var players = Players.find({'gameID': gameID});

    if ($('#choose-roles-form').find(':checkbox:checked').length >= players.count() + 3) {
      var selectedRoles = $('#choose-roles-form').find(':checkbox:checked').map(function() {
        return allRoles[this.value];
      }).get();
      Games.update(gameID, {$set: {state: 'settingUp', roles: selectedRoles}});
      Session.set('errorMessage', null);
    } else {
      Session.set('errorMessage', 'Please select at least ' + (players.count() + 3) + ' roles.');
    }

    return false;
  },
  'click .btn-leave': leaveGame,
  'click .btn-end': endGame
})

Handlebars.registerHelper('equals', function(str1, str2) {
  return str1 === str2;
})
