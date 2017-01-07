import { Meteor } from 'meteor/meteor';
import '../imports/roles.js';

Meteor.startup(() => {
  Games.remove({});
  Players.remove({});
});

Meteor.publish('games', function(accessCode) {
  return Games.find({"accessCode": accessCode});
});

Meteor.publish('players', function(gameID) {
  return Players.find({"gameID": gameID});
});

Games.find({'state': 'settingUp'}).observeChanges({
  added: function(id, game) {
    var players = Players.find({gameID: id});
    assignRoles(id, players, game.roles);
    Games.update(id, {$set: {state: 'nightTime'}});
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
  var playerRoles = [];
  players.forEach(function(player) {
    role = shuffledRoles.pop();
    Players.update(player._id, {$set: {role: role}});
    playerRoles.push(role);
  });
  playerRoles.sort(function(role1, role2) {
    return role1.order - role2.order;
  });
  Games.update(gameID, {$set: {playerRoles: playerRoles}});
  Games.update(gameID, {$set: {centerCards: shuffledRoles}});
}

Games.find({'swapping': true}).observeChanges({
  added: function(id, game) {
    for (index in game.swaps) {
      var swap = game.swaps[index];
      Players.update(swap.id, {$set: {role : swap.role}});
    }
    Games.update(id, {$set: {swaps: []}});
    Games.update(id, {$set: {swapping: false}});
  }
})
