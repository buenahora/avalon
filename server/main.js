import { Meteor } from 'meteor/meteor';
import '../imports/roles.js';

Meteor.startup(() => {
  Games.remove({});
  Players.remove({});
});

function cleanUp(){
  var cutOff = moment().subtract(2, 'hours').toDate().getTime();

  Games.remove({ createdAt: {$lt: cutOff} });
  Players.remove({ createdAt: {$lt: cutOff} });
}

var cron = new Cron(60000);

cron.addJob(5, cleanUp);

Meteor.publish('games', function(accessCode) {
  return Games.find({"accessCode": accessCode});
});

Meteor.publish('players', function(gameID) {
  return Players.find({"gameID": gameID});
});

Meteor.methods({
  nameUsed: function(game, name) {
    return Players.find( {'gameID': game._id, 'name': name} ).count() > 0;
  }
})

Games.find({'state': 'settingUp'}).observeChanges({
  added: function(id, game) {
    var players = Players.find({gameID: id});
    assignRoles(id, players, game.roles);
    Games.update(id, {$set: { state: 'inProgress'}});
  }
})

// returns a NEW array
function shuffleArray(array) {
  var result = [];
  for (var i = 0; i < array.length; i++) {
    result.push(array[i]);
  }

  for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = result[i];
      result[i] = result[j];
      result[j] = temp;
  }

  return result;
}

function assignRoles(gameID, players, roles) {
  var shuffledRoles = shuffleArray(roles);
  
  // turn value for each player
  var turns = [], playerRoles = [];
  for (var i = 0; i < players.length; i++) {
    turns.push(i);
  }
  var shuffledTurns = shuffleArray(turns);

  players.forEach(function(player) {
    role = shuffledRoles.pop();
    turn = shuffledTurns.pop();
    Players.update(player._id, {$set: {role: role, turn: turn}});
    playerRoles.push(role);
  });
  playerRoles.sort(function(role1, role2) {
    return role1.order - role2.order;
  });
  Games.update(gameID, {$set: {playerRoles: playerRoles}});
  Games.update(gameID, {$set: {centerCards: shuffledRoles}});
}
