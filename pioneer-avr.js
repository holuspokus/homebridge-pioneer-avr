/*
    Helper module for controlling Pioneer AVR

    läuft mit HB: v2
    GUI v4.55.1
    Node.js Version	 v20 v22

*/

const request = require('request');
const TelnetAvr = require('./telnet-avr');

// Reference fot input id -> Characteristic.InputSourceType
var inputSucceeded = []
var inputMissing = []
var missingInputErrorCounter = {}


const inputToType = {
        '00': 0, // PHONO -> Characteristic.InputSourceType.OTHER
        '01': 0, // CD -> Characteristic.InputSourceType.OTHER
        '02': 2, // TUNER -> Characteristic.InputSourceType.TUNER
        '03': 0, // TAPE -> Characteristic.InputSourceType.OTHER
        '04': 0, // DVD -> Characteristic.InputSourceType.OTHER ---> NintendoSwitch
        '05': 3, // TV -> Characteristic.InputSourceType.HDMI
        '06': 3, // CBL/SAT -> Characteristic.InputSourceType.HDMI
        '10': 4, // VIDEO -> Characteristic.InputSourceType.COMPOSITE_VIDEO
        '12': 0, // MULTI CH IN -> Characteristic.InputSourceType.OTHER
        '13': 0, // USB-DAC -> Characteristic.InputSourceType.OTHER
        '14': 6, // VIDEOS2 -> Characteristic.InputSourceType.COMPONENT_VIDEO
        '15': 3, // DVR/BDR -> Characteristic.InputSourceType.HDMI
        '17': 9, // USB/iPod -> Characteristic.InputSourceType.USB
        '18': 2, // XM RADIO -> Characteristic.InputSourceType.TUNER
        '19': 3, // HDMI1 -> Characteristic.InputSourceType.HDMI
        '20': 3, // HDMI2 -> Characteristic.InputSourceType.HDMI
        '21': 3, // HDMI3 -> Characteristic.InputSourceType.HDMI
        '22': 3, // HDMI4 -> Characteristic.InputSourceType.HDMI
        '23': 3, // HDMI5 -> Characteristic.InputSourceType.HDMI
        '24': 3, // HDMI6 -> Characteristic.InputSourceType.HDMI
        '25': 3, // BD -> Characteristic.InputSourceType.HDMI --> Apple TV
        '26': 10, // MEDIA GALLERY -> Characteristic.InputSourceType.APPLICATION
        '27': 0, // SIRIUS -> Characteristic.InputSourceType.OTHER
        '31': 3, // HDMI CYCLE -> Characteristic.InputSourceType.HDMI
        '33': 0, // ADAPTER -> Characteristic.InputSourceType.OTHER
        '34': 3, // HDMI7-> Characteristic.InputSourceType.HDMI
        '35': 3, // HDMI8-> Characteristic.InputSourceType.HDMI
        '38': 2, // NETRADIO -> Characteristic.InputSourceType.TUNER
        '40': 0, // SIRIUS -> Characteristic.InputSourceType.OTHER
        '41': 0, // PANDORA -> Characteristic.InputSourceType.OTHER
        '44': 0, // MEDIA SERVER -> Characteristic.InputSourceType.OTHER
        '45': 0, // FAVORITE -> Characteristic.InputSourceType.OTHER
        '48': 0, // MHL -> Characteristic.InputSourceType.OTHER
        '49': 0, // GAME -> Characteristic.InputSourceType.OTHER
        '57': 0 // SPOTIFY -> Characteristic.InputSourceType.OTHER
};

function PioneerAvr(log, host, port) {
    let thisThis = this;
    this.log = log;
    this.host = host;
    this.port = port;

    // Current AV status
    this.state = {
        volume: null,
        on: null,
        muted: null,
        input: null
    };

    // Inputs' list
    this.inputs = [];

    // Web interface ?
    this.web = false;
    this.webStatusUrl = 'http://' + this.host + '/StatusHandler.asp';
    this.webEventHandlerBaseUrl = 'http://' + this.host + '/EventHandler.asp?WebToHostItem=';
    request
        .get(this.webStatusUrl)
        .on('response', function(response) {
            if (response.statusCode == '200') {
                thisThis.log.info('Web Interface enabled');
                this.web = true;
            }
        });

    // Communication Initialization
    this.s = new TelnetAvr(this.host, this.port);

    try {
      this.s.connect();
    } catch (e) {
      this.log.debug(e)
    };


    // Dealing with input's initialization
    this.initCount = 0;
    this.isReady = false;


    // setTimeout(() => {
    //   while (thisThis === null || !thisThis.isReady) {
    //     require('deasync').sleep(500);
    //   }
    //   thisThis.__updateVolume(() => { }); thisThis.__updateMute(() => {});
    // }, 0)
    setInterval(function () {
        try{
            if (thisThis.isReady == true && thisThis.state.on == true){
                thisThis.log.info('update volume')
                // thisThis.__updateVolume(() => { })
                thisThis.__updateVolume(() => { });
                // thisThisThis.__updateMute(() => {});
                // thisThis.__updatePower(() => { });
            }
        } catch (e) {
          thisThis.log.debug(e)
        };

    }, 29000);
}
module.exports = PioneerAvr;


let inputBeingAdded = false,
    inputBeingAddedWaitCount = 0
PioneerAvr.prototype.loadInputs = function(callback) {
    // Queue and send all inputs discovery commands
    // this.log.debug('Discovering inputs');
    for (var key in inputToType) {
        while (inputBeingAdded !== false && inputBeingAddedWaitCount++ < 10) {
            require('deasync').sleep(1500);
        }
        key = String(key)
        inputBeingAdded = key;

        // this.log.debug('Trying Input key: %s', key);
        this.sendCommand(`?RGB${key}`, callback);
        require('deasync').sleep(1500);
    }
};


// PioneerAvr.prototype.loadInputs = function(callback) {
//     // Queue and send all inputs discovery commands
//     this.log.debug('Discovering inputs');
//     for (var key in inputToType) {
//         if(inputBeingAdded !== false && inputBeingAddedWaitCount++ < 10){
//           while (inputBeingAdded !== false) {
//               require('deasync').sleep(1500);
//           }
//         }
//         inputBeingAdded = key;

//         // require('deasync').sleep(1500);
//         (function (key, thisThis) {
//             inputMissing.push(key)
//             thisThis.log.debug('Trying Input key: %s', key);
//             thisThis.sendCommand(`?RGB${key}`, function () {
//               // require('deasync').sleep(1500);
//               // thisThis.log.debug('passing key to addInputSourceService %s', key)
//               //
//               let keyfoundcount = 0,
//                   inputArrayKey = false
//               while(inputArrayKey === false && keyfoundcount++ < 10){
//                   // thisThis.log.debug('in while...', keyfoundcount)
//                   for (var x in thisThis.inputs) {
//                       thisThis.log.debug('find Input status iterate inputIndex : %s %s (%s)', thisThis.inputs[x].id, key);
//                       if (String(thisThis.inputs[x].id) == String(key)) {
//                           thisThis.log.debug('Add input n', x, thisThis.inputs[x].name);
//                           inputArrayKey = x;
//                           break;
//                       }
//                   }
//                   if (inputArrayKey === false) {
//                       require('deasync').sleep(1500);
//                       let allIds = []
//                       for (var x in thisThis.inputs) {
//                           allIds.push(thisThis.inputs[x].id)
//                           // thisThis.log.debug('find Input status iterate inputIndex : %s %s (%s)', thisThis.inputs[x].id, inputId, data);
//                           if (thisThis.inputs[x].id == key) {
//                               // thisThis.log.debug(' :: Input key found: %s (%s)', x, thisThis.inputs[x].name);
//                               inputArrayKey = x;
//                               break;
//                           }
//                       }
//                       if (inputArrayKey === false) {
//                         thisThis.log.error('key not valid %s, not in %s', key, allIds.join(', '))
//                       }
//                   }
//               }

//               try {
//                 thisThis.log.error('inputArrayKey:', inputArrayKey)
//                 callback(inputArrayKey);
//               } catch (e) {
//                 thisThis.log.debug(e)
//               };
//               // require('deasync').sleep(1500);

//             });
//         }(key, this))
//     }
//     require('deasync').sleep(2000);
//     this.log.debug('Send load inputs done... inputs Missing: %s', inputMissing.length);
//     while (inputMissing.length > 0) {
//         require('deasync').sleep(10000);
//         this.log.debug(':: inputMissing: ' + inputMissing.join(', '));

//         for (i in inputMissing) {
//           key = inputMissing[i]
//           this.log.debug('Trying fixxing Input key: %s', key);
//           this.sendCommand(`?RGB${key}`, function () {
//             try {
//               callback(key);
//             } catch (e) {
//               thisThis.log.debug(e)
//             };
//             // require('deasync').sleep(1500);
//           });
//           // require('deasync').sleep(1500);

//           if (!(key in missingInputErrorCounter)){
//             missingInputErrorCounter[key] = 1
//           }else{
//             missingInputErrorCounter[key]++
//           }

//           if (missingInputErrorCounter[key] > 1){
//               // remove from inputMissing
//               var indexMissing = inputMissing.indexOf(key);
//               if (indexMissing !== -1) {
//                 inputMissing.splice(indexMissing, 1);
//               }

//               this.log.debug(':: removing input: ' + key + ': ' + String(inputToType[key]));
//               delete missingInputErrorCounter[key]
//               delete inputToType[key]
//           }
//         }
//     }
// };

// Power methods

PioneerAvr.prototype.__updatePower = function(callback) {
    this.sendCommand('?P', callback);
};

PioneerAvr.prototype.powerStatus = function(callback) {
  let thisThis = this
  // while (thisThis === null || thisThis.state.on == null) {
  //   require('deasync').sleep(500);
  //     if (thisThis !== null && thisThis.isReady) {
  //       thisThis.__updatePower(() => { });
  //       // require('deasync').sleep(500);
  //     }
  // }
  // try {
  //   callback(null, thisThis.state.on);
  // } catch (e) {
  //   thisThis.log.debug(e)
  // };

  this.__updatePower(() => {
    require('deasync').sleep(100);
      try {
        callback(null, thisThis.state.on);
      } catch (e) {
        thisThis.log.debug(e)
      };
  });
};

PioneerAvr.prototype.powerOn = function() {
    this.log.debug('Power on');

    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + 'PO');
    } else {
        this.sendCommand('PO');
    }
};

PioneerAvr.prototype.powerOff = function() {
    this.log.debug('Power off');
    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + 'PF');
    } else {
        this.sendCommand('PF');
    }
};

// Volume methods
//

PioneerAvr.prototype.__updateVolume = function(callback) {
    this.sendCommand('?V', callback);
};

PioneerAvr.prototype.volumeStatus = function(callback) {
    let thisThis = this

    this.__updateVolume(() => {
        try {
          callback(null, thisThis.state.volume);
        } catch (e) {
          thisThis.log.debug(e)
        };
    });
};

PioneerAvr.prototype.setVolume = function(targetVolume, callback) {
  let thisThis = this
    var vsxVol = targetVolume * 185 / 100;
    vsxVol = Math.floor(vsxVol);
    var pad = "000";
    var vsxVolStr = pad.substring(0, pad.length - vsxVol.toString().length) + vsxVol.toString();
    this.sendCommand(`${vsxVolStr}VL\r\n`);
    try {
      callback();
    } catch (e) {
      thisThis.log.debug(e)
    };
};

var changeVolBlocked = false
var blocktimer = false
// var updateVolume = function () {
//   this.sendCommand('?V');
// }
var updateVolumeTimeout = false
PioneerAvr.prototype.volumeUp = function() {
    this.log.debug('Volume up', !changeVolBlocked);
    let thisThis = this
    clearTimeout(updateVolumeTimeout)
    // if(!changeVolBlocked){
    if(true){
      changeVolBlocked = true
      blocktimer = setTimeout(function () {
        changeVolBlocked = false
        clearTimeout(updateVolumeTimeout)
        updateVolumeTimeout = setTimeout(function(){thisThis.__updateVolume(() => { }); thisThis.__updateMute(() => {}); }, 10000)
      }, 500)

      if (false && this.web) {
          request.get(this.webEventHandlerBaseUrl + 'VU', function(){
            clearTimeout(blocktimer)
            // require('deasync').sleep(100);
            changeVolBlocked = false
            clearTimeout(updateVolumeTimeout)
            updateVolumeTimeout = setTimeout(function(){thisThis.__updateVolume(() => { }); thisThis.__updateMute(() => {}); }, 10000)
          });
      } else {
          this.sendCommand('VU', function(){
            clearTimeout(blocktimer)
            // require('deasync').sleep(100);
            changeVolBlocked = false
            clearTimeout(updateVolumeTimeout)
            updateVolumeTimeout = setTimeout(function(){thisThis.__updateVolume(() => { }); thisThis.__updateMute(() => {}); }, 10000)
          });
      }
    }

};

PioneerAvr.prototype.volumeDown = function() {
   let thisThis = this
    this.log.debug('Volume down', !changeVolBlocked);
    // let thisThisThis = this
    clearTimeout(updateVolumeTimeout)

  if (true) {
    changeVolBlocked = true
    blocktimer = setTimeout(function () {
      changeVolBlocked = false;
      clearTimeout(updateVolumeTimeout)
      updateVolumeTimeout = setTimeout(function(){thisThis.__updateVolume(() => { }); thisThis.__updateMute(() => {}); }, 10000)
    }, 500)

    if (false && this.web) {
      request.get(this.webEventHandlerBaseUrl + 'VD', function () {
        clearTimeout(blocktimer)
        // require('deasync').sleep(100);
        changeVolBlocked = false
        clearTimeout(updateVolumeTimeout)
        updateVolumeTimeout = setTimeout(function(){thisThis.__updateVolume(() => { }); thisThis.__updateMute(() => {}); }, 10000)
      });
    } else {
      this.sendCommand('VD', function () {
        clearTimeout(blocktimer)
        // require('deasync').sleep(100);
        changeVolBlocked = false
        clearTimeout(updateVolumeTimeout)
        updateVolumeTimeout = setTimeout(function(){thisThis.__updateVolume(() => { }); thisThis.__updateMute(() => {}); }, 10000)
      });
    }
  }
};

// Mute methods

PioneerAvr.prototype.__updateMute = function(callback) {
    this.sendCommand('?M', callback);
};

PioneerAvr.prototype.muteStatus = function(callback) {
  let thisThis = this
  // while (thisThis === null || thisThis.state.muted == null) {
  //   require('deasync').sleep(500);
  //     if (thisThis === null || !thisThis.isReady) {
  //       thisThis.__updateVolume(() => { }); thisThis.__updateMute(() => {});
  //       require('deasync').sleep(500);
  //     }
  // }

    this.__updateMute(() => {
      try {
        callback(null, thisThis.state.muted);
      } catch (e) {
        thisThis.log.debug(e)
      };
    });
};

PioneerAvr.prototype.muteOn = function() {
    this.log.debug('Mute on');
    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + 'MO');
    } else {
        this.sendCommand('MO');
    }
};

PioneerAvr.prototype.muteOff = function() {
    this.log.debug('Mute off');
    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + 'MF');
    } else {
        this.sendCommand('MF');
    }
};

// Input management method

PioneerAvr.prototype.__updateInput = function(callback) {
    this.sendCommand('?F', callback);
};

PioneerAvr.prototype.inputStatus = function(callback) {
    let thisThis = this
    this.__updateInput(() => {
        try {
          callback(null, thisThis.state.input);
        } catch (e) {
          thisThis.log.debug(e)
        };
    });
};

PioneerAvr.prototype.setInput = function(id) {
    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + `${id}FN`);
    } else {
        this.sendCommand(`${id}FN`);
    }
};

PioneerAvr.prototype.renameInput = function (id, newName) {
    let shrinkName = newName.replace(/[^a-zA-Z0-9 ]/g, '').substring(0,14);
    this.sendCommand(`${shrinkName}1RGB${id}`);
};

// Remote Key methods

PioneerAvr.prototype.remoteKey = function (rk) {
    // Implemented key from CURSOR OPERATION
    switch (rk) {
        case 'UP':
            this.sendCommand('CUP');
            break;
        case 'DOWN':
            this.sendCommand('CDN');
            break;
        case 'LEFT':
            this.sendCommand('CLE');
            break;
        case 'RIGHT':
            this.sendCommand('CRI');
            break;
        case 'ENTER':
            this.sendCommand('CEN');
            break;
        case 'RETURN':
            this.sendCommand('CRT');
            break;
        case 'HOME_MENU':
            this.sendCommand('HM');
            break;
        default:
            this.log.info('Unhandled remote key : %s', rk);
    }
};




// Send command and process return

PioneerAvr.prototype.sendCommand = async function(command, callback) {
    // Main method to send a command to AVR

    let thisThis = this

    this.log.debug('Send command : %s', command);
    this.s.sendMessage(command, function(error, data){
      thisThis.log.debug('Receive data : %s', data);

      if (error) {
        thisThis.log.error(error)
        try {
          callback()
        } catch (e) {
          thisThis.log.debug(e)
        };
        return;
      }else

      if(data.indexOf('VD:SENT') > -1 || data.indexOf('VU:SENT') > -1 || data.indexOf('MO:SENT') > -1){
        // thisThis.log.debug('++ Volume processed: ' + String(data));
        // clearTimeout(blocktimer)
        // changeVolBlocked = false
        // require('deasync').sleep(200);
        // try {
        //   callback()
        // } catch (e) {
        //   thisThis.log.debug(e)
        // };
      }

      else if(data.indexOf(':SENT') > -1) {

          // thisThis.log.debug('++ data ignored: ' + String(data));
          // PioneerAvr.prototype.sendCommand(command, callback);
          // require('deasync').sleep(500);
          // try {
          //   callback()
          // } catch (e) {
          //   thisThis.log.debug(e)
          // };
      }
      // Data returned for power status
      // if (data.startsWith('PWR')) {
      else if (data.indexOf('PWR') > -1) {
          data = data.substring(data.indexOf('PWR'));
          thisThis.log.debug('Receive Power status : %s', data);
          thisThis.state.on = parseInt(data[3], 10) === 0;
          try {
            callback()
          } catch (e) {
            thisThis.log.debug(e)
          };
      }else

      // Data returned for mute status
      // if (data.startsWith('MUT')) {
      if (data.indexOf('MUT') > -1) {
          data = data.substring(data.indexOf('MUT'));
          thisThis.log.debug('Receive Mute status : %s -> %s', data[3], data);
          thisThis.state.muted = parseInt(data[3], 10) === 0;
          try {
            callback()
          } catch (e) {
            thisThis.log.debug(e)
          };
      }else

      // // Data returned for volume status
      // if (data.startsWith('VOL')) {
      //     var vol = data.substring(3);
      //     var volPctF = Math.floor(parseInt(vol) * 100 / 185);
      //     thisThis.state.volume = Math.floor(volPctF);
      //     thisThis.log.debug("Volume is %s (%s%)", vol, thisThis.state.volume);
      //     try {
      //       callback()
      //     } catch (e) {
      //      thisThis.log.debug(e)
      //     };
      // }else

      // Data returned for volume status2
      if (data.indexOf('VOL') > -1) {
          data = data.substring(data.indexOf('VOL'));
          var vol = data.substring(3);
          var volPctF = Math.floor(parseInt(vol) * 100 / 185);
          thisThis.state.volume = Math.floor(volPctF);
          thisThis.log.debug("Volume is %s (%s%)", vol, thisThis.state.volume);
          try {
            callback()
          } catch (e) {
            thisThis.log.debug(e)
          };
      }else

      // Data returned for input status
      // if (data.startsWith('FN')) {
      if (data.indexOf('FN') > -1) {
          data = data.substring(data.indexOf('FN'));

          thisThis.log.debug('Receive Input status : %s', data);

          let inputId = data.substr(2);
          let inputIndex = null;
          for (var x in thisThis.inputs) {
              // thisThis.log.debug('find Input status iterate inputIndex : %s %s (%s)', thisThis.inputs[x].id, inputId, data);
              if (thisThis.inputs[x].id == inputId) {
                  // thisThis.log.debug(' :: Input Index found: %s (%s)', x, thisThis.inputs[x].name);
                  inputIndex = x;
                break;
              }
          }

          if (inputIndex == null) {
              try {
                callback()
              } catch (e) {
                thisThis.log.debug(e)
              };
              return
          }
          thisThis.state.input = inputIndex;

          // thisThis.log.debug('Receive Input status : %s (%s)', data, thisThis.inputs[inputIndex].name);

          try {
            callback()
          } catch (e) {
            thisThis.log.debug(e)
          };
      }else

      // Data returned for input queries
      // if (data.startsWith('RGB')) {
      if (data.indexOf('RGB') > -1) {
          data = data.substring(data.indexOf('RGB'));
          let tmpInput = {
              id: data.substr(3,2),
              name: data.substr(6).trim(),
              type: inputToType[data.substr(3,2)]
              };

          // thisThis.log.error('tmpInput:', tmpInput)

          if (String(inputBeingAdded) == String(tmpInput.id)){
              inputBeingAdded = false
              inputBeingAddedWaitCount = 0
          }

          // check if already in
          let alreadyExists = false
          for (var x in thisThis.inputs) {
              // thisThis.log.debug('find Input status iterate alreadyExists : %s %s %s %s (%s)', (thisThis.inputs[x].id == tmpInput.id), (thisThis.inputs[x].name == tmpInput.name), thisThis.inputs[x].id, tmpInput, thisThis.inputs[x]);
              if (String(thisThis.inputs[x].id) == String(tmpInput.id)) { //  || String(thisThis.inputs[x].name) == String(tmpInput.name)
                  //already exists
                  thisThis.log.error(' [ERROR] INPUT ALREADY EXISTS (programmer error)', tmpInput, thisThis.inputs[x])
                  alreadyExists = true
                  break;
              }
          }

          if(alreadyExists === false){
            thisThis.inputs.push(tmpInput);

            inputSucceeded.push(data.substr(3,2) )

            var indexMissing = inputMissing.indexOf(data.substr(3,2));
            if (indexMissing !== -1) {
              inputMissing.splice(indexMissing, 1);
            }

            if (!thisThis.isReady) {
                thisThis.initCount = thisThis.initCount + 1;
                thisThis.log.debug('Input [%s] discovered (id: %s, type: %s). InitCount=%s/%s',
                    tmpInput.name,
                    tmpInput.id,
                    tmpInput.type,
                    thisThis.initCount,
                    Object.keys(inputToType).length
                    );
                if (thisThis.initCount == Object.keys(inputToType).length) thisThis.isReady = true;
            }

            // thisThis.log.error('thisThis.inputs::::', thisThis.inputs, thisThis.inputs.length-1)
            for (var x in thisThis.inputs) {
                // thisThis.log.debug('find Input status iterate inputIndex : %s %s %s %s (%s)', (thisThis.inputs[x].id == tmpInput.id), (thisThis.inputs[x].name == tmpInput.name), thisThis.inputs[x].id, tmpInput, thisThis.inputs[x]);
                if (String(thisThis.inputs[x].id) == String(tmpInput.id)) { //  || String(thisThis.inputs[x].name) == String(tmpInput.name)
                    try {
                      // thisThis.log.error('send Callback for ', thisThis.inputs[x].id)
                      callback(x);
                    } catch (e) {
                      thisThis.log.debug(e)
                    };
                    break;
                }
            }
            // try {
            //   callback(thisThis.inputs.length-1);
            // } catch (e) {
            //   thisThis.log.debug(e)
            // };
          }




      }else

      // E06 is returned when input not exists
      if (data.startsWith('E06')) {
          thisThis.log.debug('Receive E06 error: ' + String(data));
          if (!thisThis.isReady) {
              thisThis.initCount = thisThis.initCount + 1;
              thisThis.log.debug('Detect inappropriate Parameter. Input does not exists? InitCount=%s/%s',
                  thisThis.initCount,
                  Object.keys(inputToType).length
                  );
              if (thisThis.initCount == Object.keys(inputToType).length) thisThis.isReady = true;
          }
          try {
            callback()
          } catch (e) {
            thisThis.log.debug(e)
          };
      }else
      if (data.startsWith('E04')) {
          thisThis.log.debug('Receive E04 error: ' + String(data));
          if (!thisThis.isReady) {
              thisThis.initCount = thisThis.initCount + 1;
              thisThis.log.debug('Detect inappropriate Command line. InitCount=%s/%s',
                  thisThis.initCount,
                  Object.keys(inputToType).length
                  );
              if (thisThis.initCount == Object.keys(inputToType).length) thisThis.isReady = true;
          }
          try {
            callback()
          } catch (e) {
            thisThis.log.debug(e)
          };
      }
    });

};
