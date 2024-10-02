"use strict";

const net = require("net");
// const ReadWriteLock = require("rwlock");

const PORT = 23;
const HOST = "127.0.0.1";


let disconnectTimeout = null

// let connect = null;
let connectionReady = false

let thisThis = null;

let functioncallcounter = 0

let testInterval = null
let checkQueueInterval = null
// let thisThis.queueCallbackF = undefined

class TelnetAvr {
  constructor(host, port) {
    this.host = host || HOST;
    this.port = port || PORT;
    // this.lock = new ReadWriteLock();
    // this.lockRelease = null;
    this.queueLock = false;
    this.queueLockDate = Date.now()
    this.queue = []
    this.queueCallbackF = function (error, data) {
      console.log(' ++ queueCallback called.', error, data);
    };
    this.socket = null;

    this.fallbackOnData = function (error, data) {
      console.log(' ++ fallbackOnData called.', error, data);
    }

    thisThis = this
  }


  disconnect() {
    if (this.socket != null){
        this.socket.end(function(){
          this.socket = null;
        });

    }
  }

  connect(callback) {
    // console.log('connect called', thisThis.socket === null, thisThis !== null)
    if (typeof(callback) !== 'function'){
      callback = function () { }
    }

    if (connectionReady === false && thisThis.socket !== null && thisThis !== null) {
      this.socket.connect(thisThis.port, thisThis.host, () => {
        // console.log('123sendMessage:connectedFunctionCallb')
        // this.socket.write(message+'\r');
        require("deasync").sleep(10);
        connectionReady = true
        try {
          callback()
        } catch (e) {
          console.error(e);
        }
      });

    }else{


      if (thisThis.socket === null && thisThis !== null) {
        functioncallcounter++
        // clearInterval(testInterval)
        // testInterval = setInterval(function () {
        //   console.log(' ++ socket:: ', functioncallcounter, thisThis.queueLock, connectionReady);
        // }, 5000)

        clearInterval(checkQueueInterval)
        checkQueueInterval = setInterval(function () {
          if (thisThis !== null && thisThis.queueLock !== false && (Date.now() - thisThis.queueLockDate > 30000)) {
            thisThis.queueLock = false
            // this.queueLockDate = Date.now()
          }
          if (thisThis !== null && thisThis.queueLock === false && connectionReady === true) {
            for (let entry in thisThis.queue) {
              // console.log(thisThis.queue, 'entry', entry);
              if (entry in Object.keys(thisThis.queue) && thisThis.queue[entry].length === 2) {
                (function (message, onData) {
                  thisThis.queueLock = true
                  thisThis.queueLockDate = Date.now()
                  thisThis.queueCallbackF = onData
                  thisThis.socket.write(message + "\r");
                }(thisThis.queue[entry][0], thisThis.queue[entry][1]))
              }
              // else {
              //   console.log('thisThis.queue[%s]=', entry, thisThis.queue[entry])
              // }

              // delete thisThis.queue[entry]
              thisThis.queue.splice(entry, 1);
              break
            }
          }
        }, 100)

        this.socket = net.Socket();
        // console.log('+++++++++socket:', this.socket)
        this.socket.setTimeout(2 * 60 * 60 * 1000, () => this.socket.destroy());
        this.socket.once("connect", () => this.socket.setTimeout(2 * 60 * 60 * 1000));
        // console.log('sendMessage:connected')
        this.socket.connect(thisThis.port, thisThis.host, () => {
          // console.log('sendMessage:connectedFunctionCallb')
          // this.socket.write(message+'\r');
          require("deasync").sleep(10);
          connectionReady = true
          try {
            callback()
          } catch (e) {
            console.error(e);
          }
        });


        this.socket.on("close", () => {
          connectionReady = false
          console.log('sendMessage:Close')
          require("deasync").sleep(1000);
          thisThis.connect(function () { })
        });

        this.socket.on("data", (d) => {
          try {
            let data = d.toString().replace("\n", "").replace("\r", "").trim();

            // console.log('sendMessage:resolve:data -> ' + String(data))

            if (thisThis.queueLock === true) {
              if (typeof (thisThis.queueCallbackF) == 'function') {
                try {
                  thisThis.queueCallbackF(null, data)
                } catch (e) {
                  console.error(e);
                }
              } else {
                console.error('>> thisThis.queueCallbackF is not a function!', thisThis.queueCallbackF);
              }


              thisThis.queueLock = false
              thisThis.queueLockDate = Date.now()
            }


            // let thisCallbackF = this.fallbackOnData.bind({})
            // console.log(this.fallbackOnData)
            // thisCallbackF(null, data);
            // // console.log('sendMessage:resolve2')
          } catch (e) {
            console.error(e);
          }

          // this.socket.end();
          // release();
        });

        this.socket.on("error", (err) => {
          console.log('sendMessage:Error' + String(err))
          // callback(err, null);
        });
      }

    }
  }

  sendMessage(message, onData) {

    // console.log('sendMessage called', this.queueLock, message)

    if (typeof (onData) != 'function') {
      onData = this.fallbackOnData.bind({});
    } else {
      this.fallbackOnData = onData.bind({});
    }

    if(this.queueLock === true){
      this.queue.push([message, onData])
      return
    }



    // if(connect === null){

    // }

    // connect(function () {
    let whileCounter = 0
      while(connectionReady === false && whileCounter++ < 50){
        console.log('connectionReady:', connectionReady)
        require("deasync").sleep(1000);
      }

      thisThis.connect(function () {

      })

      whileCounter = 0
        while(connectionReady === false && whileCounter++ < 50){
          console.log('connectionReady:', connectionReady)
          require("deasync").sleep(100);
        }

        if(connectionReady === false){
          thisThis.log.error('connection still not ready...')
          return
        }

      // console.log('sendMessage:', message)

    if (!message.startsWith("?")) {
      this.socket.write(message + "\r");
      try {
        onData(null, message + ":SENT");
      } catch (e) {
        console.error(e);
      }

      // console.log('sendMessage:', message)
      // this.socket.end();
      //
    } else {
      //queue?
      //
      this.queueLock = true
      thisThis.queueCallbackF = onData
      this.socket.write(message + "\r");
    }
    disconnectTimeout = setTimeout(this.disconnect, 2 * 60 * 60 * 1000)
    // })

  };
}

// process.stdin.resume(); // so the program will not close instantly

// // do something when app is closing
// process.on('exit', disconnect.bind());

// // catches ctrl+c event
// process.on('SIGINT', disconnect.bind());

// // catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', disconnect.bind());
// process.on('SIGUSR2', disconnect.bind());

// // catches uncaught exceptions
// process.on('uncaughtException', disconnect.bind());


module.exports = TelnetAvr;
