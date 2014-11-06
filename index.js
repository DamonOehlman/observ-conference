var Observ = require('observ');
var ObservArray = require('observ-array');
var ObservStruct = require('observ-struct');
var extend = require('cog/extend');

module.exports = function(conference, opts) {
  var participants = ObservArray([]);

  function removePeer(id) {
    participants.transaction(function(raw) {
      var idx = 0;
      while (idx < raw.length && raw[idx].id() !== id) {
        idx++;
      }

      if (idx < raw.length) {
        raw.splice(idx, 1);
      }
    });
  }

  function updatePeer(id, data, connected) {
    var p = { id: id, connected: Observ(connected) };

    participants.transaction(function(raw) {
      var idx = 0;
      var insertPeer = true;
      var keys = Object.keys(data);

      while (idx < raw.length && raw[idx].id() !== id) {
        idx++;
      }

      if (idx < raw.length) {
        insertPeer = keys.filter(function(key) {
          var ob = raw[idx][key];

          // if we don't have an observable for this attribute
          // throw away the object and start again
          if (typeof ob != 'function') {
            return false;
          }

          if (ob() !== data[key]) {
            ob.set(data[key]);
          }

          return true;
        }).length !== keys.length;

        if (insertPeer) {
          raw.splice(idx, 1);
        }
        else {
          // toggle the connection state
          raw[idx].connected.set(connected || raw[idx].connected());
        }
      }

      if (insertPeer) {
        keys.forEach(function(key) {
          p[key] = Observ(data[key]);
        });

        raw.push(ObservStruct(p));
      }
    });
  }

  conference.on('local:announce', function(data) {
    updatePeer(data.id, data, true);
  });

  conference.on('peer:announce', function(data) {
    updatePeer(data.id, data);
  });

  conference.on('peer:update', function(data) {
    updatePeer(data.id, data);
  });

  conference.on('call:started', function(id, pc, data) {
    updatePeer(id, data, true);
  });

  conference.on('call:ended', removePeer);

  participants.findById = function(id) {
    var idx = 0;
    var len = participants.getLength();
    while (idx < len && participants.get(idx).id() !== id) {
      idx++;
    }

    if (idx < len) {
      return participants.get(idx);
    }
  };

  return participants;
};
