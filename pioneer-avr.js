/*
    Helper module for controlling Pioneer AVR

    läuft mit HB: v1.7.0, v2
    GUI v4.55.1
    Node.js Version	 v18.19.0, 20, 22

*/

const request = require("request");
const TelnetAvr = require("./telnet-avr");

// Reference fot input id -> Characteristic.InputSourceType
let inputSucceeded = [];
let inputMissing = [];
let missingInputErrorCounter = {};
let allInterval = null;

let inputToType = {
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
        input: null,
        listeningMode: null
    };

    this.onData = function (error, data, callback) {
        thisThis.log.debug("Receive data : %s", data);

        if (typeof callback !== "function") {
            callback = function () {};
        }

        if (error) {
            thisThis.log.error(error);
            try {
                callback(error, data);
            } catch (e) {
                thisThis.log.debug(e);
            }
            return;
        } else if (
            data.indexOf("VD:SENT") > -1 ||
            data.indexOf("VU:SENT") > -1 ||
            data.indexOf("MO:SENT") > -1
        ) {
            try {
                callback(error, data);
            } catch (e) {
                thisThis.log.debug(e);
            }
        } else if (data.indexOf(":SENT") > -1) {
            // try {
            //   callback()
            // } catch (e) {
            //   thisThis.log.debug(e)
            // };
        } else if (data.indexOf("PWR") > -1) {
            data = data.substring(data.indexOf("PWR"));
            thisThis.state.on = parseInt(data[3], 10) === 0;
            thisThis.log.debug(
                "Receive Power status : %s (%s)",
                thisThis.state.on ? "On" : "off",
                data,
            );
            lastGetPowerStatus = Date.now();
            try {
                callback(error, data);
            } catch (e) {
                thisThis.log.debug(e);
            }
        }

        // Data returned for mute status
        else if (data.indexOf("MUT") > -1) {
            data = data.substring(data.indexOf("MUT"));
            thisThis.state.muted = parseInt(data[3], 10) === 0;
            thisThis.log.debug(
                "Receive Mute status: %s (%s -> %s)",
                thisThis.state.muted ? "Muted" : "Not Muted",
                data[3],
                data,
            );
            lastGetPowerStatus = Date.now();
            try {
                callback(error, data);
            } catch (e) {
                thisThis.log.debug(e);
            }
        }

        // get LISTENING MODE
        else if (data.indexOf("SR") > -1 && data.length === 6) {
            data = data.substring(data.indexOf("SR"));
            thisThis.state.listeningMode = data.substr(2, 4); // SR0018 -> 0018
            try {
                callback(error, data);
            } catch (e) {
                thisThis.log.debug(e);
            }
        }

        // Data returned for volume status2
        else if (data.indexOf("VOL") > -1) {
            data = data.substring(data.indexOf("VOL"));
            let vol = data.substr(3, 3);
            let volPctF = Math.floor((parseInt(vol) * 100) / 185);
            thisThis.state.volume = Math.floor(volPctF);
            thisThis.log.debug(
                "Volume is %s (%s%)",
                vol,
                thisThis.state.volume,
            );
            try {
                callback(error, data);
            } catch (e) {
                thisThis.log.debug(e);
            }
        }

        // Data returned for input status
        else if (data.indexOf("FN") > -1) {
            // FN25
            data = data.substring(data.indexOf("FN"));

            thisThis.log.debug("Receive Input status : %s", data);

            let inputId = data.substr(2, 2);
            let inputIndex = null;
            for (let x in thisThis.inputs) {
                if (thisThis.inputs[x].id == inputId) {
                    inputIndex = x;
                    break;
                }
            }

            if (inputIndex == null) {
                try {
                    callback(error, data);
                } catch (e) {
                    thisThis.log.debug(e);
                }
                return;
            }
            thisThis.state.input = inputIndex;

            try {
                callback(error, data);
            } catch (e) {
                thisThis.log.debug(e);
            }
        }

        // Data returned for input queries
        else if (data.startsWith("E06RGB")) {
            data = data.substring(data.indexOf("RGB"));
            let thisid = data.substr(3, 2);

            for (let key in inputToType) {
                if (String(key) == String(thisid)) {
                    thisThis.log.error(
                        " [ERROR] Input Error:",
                        thisid,
                        inputToType[key],
                    );
                    delete inputToType[key];
                    break;
                }
            }

            let indexMissing = inputMissing.indexOf(thisid);
            if (indexMissing !== -1) {
                inputMissing.splice(indexMissing, 1);
            }
        } else if (data.indexOf("RGB") > -1) {
            data = data.substring(data.indexOf("RGB"));
            let tmpInput = {
                id: data.substr(3, 2),
                name: data.substr(6).trim(),
                type: inputToType[data.substr(3, 2)],
            };

            if (String(inputBeingAdded) == String(tmpInput.id)) {
                inputBeingAdded = false;
                inputBeingAddedWaitCount = 0;
            }

            // check if already in
            let alreadyExists = false;
            for (let x in thisThis.inputs) {
                if (String(thisThis.inputs[x].id) == String(tmpInput.id)) {
                    // thisThis.log.error(' [ERROR] INPUT ALREADY EXISTS (programmer error)', tmpInput, thisThis.inputs[x])
                    //update!
                    thisThis.inputs[x] = tmpInput;
                    alreadyExists = true;
                    break;
                }
            }

            if (alreadyExists === false) {
                thisThis.inputs.push(tmpInput);

                inputSucceeded.push(data.substr(3, 2));

                let indexMissing = inputMissing.indexOf(data.substr(3, 2));
                if (indexMissing !== -1) {
                    inputMissing.splice(indexMissing, 1);
                }

                if (!thisThis.isReady) {
                    thisThis.initCount = thisThis.initCount + 1;
                    thisThis.log.debug(
                        "Input [%s] discovered (id: %s, type: %s). InitCount=%s/%s, inputMissing: %s",
                        tmpInput.name,
                        tmpInput.id,
                        tmpInput.type,
                        thisThis.initCount,
                        Object.keys(inputToType).length,
                        inputMissing,
                    );
                    if (thisThis.initCount == Object.keys(inputToType).length)
                        thisThis.isReady = true;
                }

                for (let x in thisThis.inputs) {
                    if (String(thisThis.inputs[x].id) == String(tmpInput.id)) {
                        try {
                            callback(x);
                        } catch (e) {
                            thisThis.log.debug(e);
                        }
                        break;
                    }
                }
            }
        }

        // E06 is returned when input not exists, E06RGB is sperate
        else if (data.startsWith("E06")) {
            try {
                callback(String(data), data);
            } catch (e) {
                thisThis.log.debug(e);
            }
        } else if (data.startsWith("E")) {
            thisThis.log.debug("Receive error: " + String(data));
            try {
                callback(String(data), data);
            } catch (e) {
                thisThis.log.debug(e);
            }
        }
    };

    // Inputs' list
    this.inputs = [];

    // Web interface ?
    this.web = false;
    this.webStatusUrl = "http://" + this.host + "/StatusHandler.asp";
    this.webEventHandlerBaseUrl =
        "http://" + this.host + "/EventHandler.asp?WebToHostItem=";
    request.get(this.webStatusUrl).on("response", function (response) {
        if (response.statusCode == "200") {
            thisThis.log.info("Web Interface enabled");
            this.web = true;
        }
    });

    // Communication Initialization
    this.s = new TelnetAvr(this.host, this.port);
    this.s.fallbackOnData = this.onData; //.bind({})

    try {
        this.s.connect();
    } catch (e) {
        this.log.debug(e);
    }

    // Dealing with input's initialization
    this.initCount = 0;
    this.isReady = false;

    this.s.displayChanged = function (error, text) {
        if (error) {
            thisThis.log.error(error);
        }
        if (text) {
            thisThis.log.debug("[DISPLAY] " + text);
        }
    };

    clearInterval(allInterval);
    allInterval = setInterval(function () {
        try {
            if (
                thisThis.s.connectionReady &&
                thisThis.isReady &&
                thisThis.state.on == true
            ) {
                thisThis.__updateVolume(() => {});
                thisThis.__updateListeningMode(() => {});
            }
            if (thisThis.isReady && thisThis.s.connectionReady) {
                thisThis.__updatePower(() => {});
            }
        } catch (e) {
            thisThis.log.debug(e);
        }
    }, 29000);

    setTimeout(function () {
        while (!thisThis.s || !thisThis.s.connectionReady) {
            require("deasync").sleep(50);
        }
        thisThis.__updateVolume(() => {});
        thisThis.__updateListeningMode(() => {});
        thisThis.__updatePower(() => {});

        //reset input locks
        thisThis.sendCommand("0PKL");
        thisThis.sendCommand("0RML");
    }, 0);
}
module.exports = PioneerAvr;

let inputBeingAdded = false,
    inputBeingAddedWaitCount = 0;
PioneerAvr.prototype.loadInputs = function (callback) {
    // Queue and send all inputs discovery commands
    for (let key in inputToType) {
        if (inputBeingAdded !== false && inputBeingAddedWaitCount++ < 30) {
            require("deasync").sleep(10);
            inputBeingAddedWaitCount = 0;
            while (
                inputBeingAdded !== false &&
                inputBeingAddedWaitCount++ < 30
            ) {
                require("deasync").sleep(500);
            }
        }
        key = String(key);
        inputBeingAdded = key;
        if (inputMissing.indexOf(key) === -1) {
            inputMissing.push(key);
        }

        this.sendCommand(`?RGB${key}`, `RGB${key}`, callback);
        require("deasync").sleep(50);
    }

    if (inputBeingAdded !== false && inputBeingAddedWaitCount++ < 30) {
        require("deasync").sleep(10);
        inputBeingAddedWaitCount = 0;
        while (inputBeingAdded !== false && inputBeingAddedWaitCount++ < 30) {
            require("deasync").sleep(500);
        }
    }

    let inputMissingWhileMax = 0;
    while (inputMissing.length > 0 && inputMissingWhileMax++ < 30) {
        for (let thiskey in inputMissing) {
            let key = inputMissing[thiskey];
            if (inputBeingAdded !== false && inputBeingAddedWaitCount++ < 30) {
                require("deasync").sleep(10);
                inputBeingAddedWaitCount = 0;
                while (
                    inputBeingAdded !== false &&
                    inputBeingAddedWaitCount++ < 30
                ) {
                    require("deasync").sleep(500);
                }
            }
            key = String(key);
            inputBeingAdded = key;

            this.sendCommand(`?RGB${key}`, `RGB${key}`, callback);
            require("deasync").sleep(500);
        }
    }
};

// Power methods

let lastGetPowerStatus = null;
PioneerAvr.prototype.__updatePower = function (callback) {
    this.sendCommand("?P", "PWR", callback);
};
PioneerAvr.prototype.powerStatus = function (callback) {
    let thisThis = this;

    if (
        lastGetPowerStatus !== null &&
        Date.now() - lastGetPowerStatus < 10000
    ) {
        try {
            callback(null, thisThis.state.on);
        } catch (e) {
            thisThis.log.debug(e);
        }
        return;
    }

    this.__updatePower(() => {
        // require('deasync').sleep(10);
        try {
            callback(null, thisThis.state.on);
        } catch (e) {
            thisThis.log.debug(e);
        }
    });
};

PioneerAvr.prototype.powerOn = function () {
    this.log.debug("Power on");

    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + "PO");
    } else {
        this.sendCommand("PO");
    }
    let thisThis = this;
    setTimeout(function () {
        thisThis.powerStatus(function () {});
    }, 1500);
};

PioneerAvr.prototype.powerOff = function () {
    this.log.debug("Power off");
    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + "PF");
    } else {
        this.sendCommand("PF");
    }
    let thisThis = this;
    setTimeout(function () {
        thisThis.powerStatus(function () {});
    }, 1500);
};

// Volume methods
PioneerAvr.prototype.__updateVolume = function (callback) {
    this.sendCommand("?V", "VOL", callback);
};

PioneerAvr.prototype.volumeStatus = function (callback) {
    if (this !== null && this.state.volume !== null) {
        callback(null, this.state.volume);
        return;
    }

    let thisThis = this;
    this.__updateVolume(() => {
        try {
            callback(null, thisThis.state.volume);
        } catch (e) {
            thisThis.log.debug(e);
        }
    });
};

PioneerAvr.prototype.setVolume = function (targetVolume, callback) {
    let thisThis = this;
    let vsxVol = (targetVolume * 185) / 100;
    vsxVol = Math.floor(vsxVol);
    let pad = "000";
    let vsxVolStr =
        pad.substring(0, pad.length - vsxVol.toString().length) +
        vsxVol.toString();
    this.sendCommand(`${vsxVolStr}VL`);
    try {
        callback();
    } catch (e) {
        thisThis.log.debug(e);
    }
};

let changeVolBlocked = false;
let blocktimer = false;
let updateVolumeTimeout = false;
PioneerAvr.prototype.volumeUp = function () {
    this.log.debug("Volume up", !changeVolBlocked);
    let thisThis = this;
    clearTimeout(updateVolumeTimeout);
    changeVolBlocked = true;
    blocktimer = setTimeout(function () {
        changeVolBlocked = false;
        clearTimeout(updateVolumeTimeout);
        updateVolumeTimeout = setTimeout(function () {
            thisThis.__updateVolume(() => {});
            thisThis.__updateMute(() => {});
        }, 1000);
    }, 500);

    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + "VU", function () {
            clearTimeout(blocktimer);
            changeVolBlocked = false;
            clearTimeout(updateVolumeTimeout);
            updateVolumeTimeout = setTimeout(function () {
                thisThis.__updateVolume(() => {});
                thisThis.__updateMute(() => {});
            }, 1000);
        });
    } else {
        this.sendCommand("VU", function () {
            clearTimeout(blocktimer);
            changeVolBlocked = false;
            clearTimeout(updateVolumeTimeout);
            updateVolumeTimeout = setTimeout(function () {
                thisThis.__updateVolume(() => {});
                thisThis.__updateMute(() => {});
            }, 1000);
        });
    }
};

PioneerAvr.prototype.volumeDown = function () {
    let thisThis = this;
    this.log.debug("Volume down", !changeVolBlocked);
    clearTimeout(updateVolumeTimeout);

    if (true) {
        changeVolBlocked = true;
        blocktimer = setTimeout(function () {
            changeVolBlocked = false;
            clearTimeout(updateVolumeTimeout);
            updateVolumeTimeout = setTimeout(function () {
                thisThis.__updateVolume(() => {});
                thisThis.__updateMute(() => {});
            }, 1000);
        }, 500);

        if (this.web) {
            request.get(this.webEventHandlerBaseUrl + "VD", function () {
                require("deasync").sleep(100);
                request.get(
                    thisThis.webEventHandlerBaseUrl + "VD",
                    function () {
                        require("deasync").sleep(100);
                        request.get(
                            thisThis.webEventHandlerBaseUrl + "VD",
                            function () {
                                clearTimeout(blocktimer);
                                changeVolBlocked = false;
                                clearTimeout(updateVolumeTimeout);
                                updateVolumeTimeout = setTimeout(function () {
                                    thisThis.__updateVolume(() => {});
                                    thisThis.__updateMute(() => {});
                                }, 1000);
                            },
                        );
                    },
                );
            });
        } else {
            this.sendCommand("VD", function () {
                require("deasync").sleep(100);
                thisThis.sendCommand("VD", function () {
                    require("deasync").sleep(100);
                    thisThis.sendCommand("VD", function () {
                        clearTimeout(blocktimer);
                        changeVolBlocked = false;
                        clearTimeout(updateVolumeTimeout);
                        updateVolumeTimeout = setTimeout(function () {
                            thisThis.__updateVolume(() => {});
                            thisThis.__updateMute(() => {});
                        }, 1000);
                    });
                });
            });
        }
    }
};

// request listening mode
PioneerAvr.prototype.__updateListeningMode = function (callback) {
    this.sendCommand("?S", "SR", callback);
};

PioneerAvr.prototype.getListeningMode = function (callback) {
    let thisThis = this;

    this.__updateListeningMode(() => {
        try {
            callback(null, thisThis.state.listeningMode);
        } catch (e) {
            thisThis.log.debug(e);
        }
    });
};

// set Listeing Mode toggle [EXTENDED STEREO]
PioneerAvr.prototype.toggleListeningMode = function (callback) {
    let thisThis = this;

    if (thisThis === null || !thisThis.isReady) {
        try {
            callback();
        } catch (e) {
            thisThis.log.debug(e);
        }
        return;
    }

    // 0013SR: PRO LOGIC2x MOVIE
    // 0100SR: EXTENDED STEREO

    this.log.debug("toggleListeningMode now:", thisThis.state.listeningMode);

    if (thisThis.state.listeningMode === "0013") {
        // from PL2 to ext stereo
        thisThis.sendCommand("0112SR");
        thisThis.state.listeningMode = "0112";
        require("deasync").sleep(100);
        try {
            callback();
        } catch (e) {
            thisThis.log.debug(e);
        }
    } else {
        // from ext. stero to PL2
        thisThis.state.listeningMode = "0013";
        thisThis.sendCommand("!0013SR", "SR", function (error, data) {
            if (error) {
                thisThis.state.listeningMode = "0101";
                thisThis.sendCommand("0101SR");
            }
        });

        thisThis.log.debug(
            "toggleListeningMode now:",
            thisThis.state.listeningMode,
        );
        require("deasync").sleep(100);
        try {
            callback();
        } catch (e) {
            thisThis.log.debug(e);
        }
    }
};

// Mute methods
PioneerAvr.prototype.__updateMute = function (callback) {
    this.sendCommand("?M", "MUT", callback);
};

let lastMuteStatus = null;
PioneerAvr.prototype.muteStatus = function (callback) {
    let thisThis = this;
    if (lastMuteStatus !== null && Date.now() - lastMuteStatus < 10000) {
        try {
            callback(null, thisThis.state.muted);
        } catch (e) {
            thisThis.log.debug(e);
        }
        return;
    }

    this.__updateMute(() => {
        try {
            callback(null, thisThis.state.muted);
        } catch (e) {
            thisThis.log.debug(e);
        }
    });
};

PioneerAvr.prototype.muteOn = function () {
    this.log.debug("Mute on");
    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + "MO");
    } else {
        this.sendCommand("MO");
    }
};

PioneerAvr.prototype.muteOff = function () {
    this.log.debug("Mute off");
    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + "MF");
    } else {
        this.sendCommand("MF");
    }
};

// Input management method
PioneerAvr.prototype.__updateInput = function (callback) {
    this.sendCommand("?F", "FN", callback);
};

PioneerAvr.prototype.inputStatus = function (callback) {
    let thisThis = this;
    this.__updateInput(() => {
        thisThis.log.debug("inputStatus updated %s", thisThis.state.input);
        try {
            callback(null, thisThis.state.input);
        } catch (e) {
            thisThis.log.debug(e);
        }
    });
};

PioneerAvr.prototype.setInput = function (id) {
    if (this.web) {
        request.get(this.webEventHandlerBaseUrl + `${id}FN`);
    } else {
        this.sendCommand(`${id}FN`);
    }
};

PioneerAvr.prototype.renameInput = function (id, newName) {
    let shrinkName = newName.replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 14);
    this.sendCommand(`${shrinkName}1RGB${id}`);
};

// Remote Key methods
PioneerAvr.prototype.remoteKey = function (rk) {
    // Implemented key from CURSOR OPERATION
    switch (rk) {
        case "UP":
            this.sendCommand("CUP");
            break;
        case "DOWN":
            this.sendCommand("CDN");
            break;
        case "LEFT":
            this.sendCommand("CLE");
            break;
        case "RIGHT":
            this.sendCommand("CRI");
            break;
        case "ENTER":
            this.sendCommand("CEN");
            break;
        case "RETURN":
            this.sendCommand("CRT");
            break;
        case "HOME_MENU":
            this.sendCommand("HM");
            break;
        default:
            this.log.info("Unhandled remote key : %s", rk);
    }
};

// Send command and process return

PioneerAvr.prototype.sendCommand = async function (
    command,
    callbackChars,
    callback,
) {
    // Main method to send a command to AVR
    let thisThis = this;

    if (typeof callback !== "function") {
        callback = function () {};
    }

    this.log.debug("Send command : %s", command);
    if (typeof callbackChars === "function") {
        this.s.sendMessage(command, undefined, function (error, data) {
            thisThis.onData(error, data, callbackChars);
        });
    } else {
        this.s.sendMessage(command, callbackChars, function (error, data) {
            thisThis.onData(error, data, callback);
        });
    }
};
