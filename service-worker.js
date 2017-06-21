/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

/* eslint no-console: ["error", { allow: ["info"] }] */

console.info(
  'Service worker disabled for development, will be generated at build time.'
);

importScripts('/bower_components/localforage/dist/localforage.min.js')
self.addEventListener('sync', function (event) {
  if (event.tag === 'save-note') {
    event.waitUntil(saveNotes());
  }
});

function sendMessageToClient(client, msg){
    return new Promise(function(resolve, reject){
        var msg_chan = new MessageChannel();

        msg_chan.port1.onmessage = function(event){
            if(event.data.error){
                reject(event.data.error);
            }else{
                resolve(event.data);
            }
        };

        client.postMessage(msg, [msg_chan.port2]);
    });
}

async function sendMsgToAll(msg){
    let matchedClients = await clients.matchAll();
    let promiseArr = [];
    matchedClients.map((client) => {
        // push the promise to an array, immediately proceeed to next iteration
        promiseArr.push(sendMessageToClient(client, msg).catch(err =>{
          // swallow the error. Required to ensure promise.all doesn't bail
          // early
          console.log("Client disconnected")
        }));
    })
    // run all the promises in parallel
    // NB: Promise.all resolves as soon as one of the promises fails, so
    // its important to ensure that never happens.
    await Promise.all(promiseArr);
}



async function saveNote(reqBody) {
  fetch('http://localhost:8080/api/save-note', {method: 'POST', body: reqBody}).then(resp => {
    if(!resp.ok) {
      // 404 responses are not treated as errors. Force this to be the case
      throw new Error(resp);
    }
  }).catch(err => {
    console.log(err);
  })
}
async function saveNotes(e) {
  localforage.config({name: 'hermesStore'});
  let keys = await localforage.keys();

  await Promise.all(keys.map(async key => {
    let record = await localforage.getItem(key);
    return saveNote(record);
  }))
  console.log(keys);
  await sendMsgToAll({"topic": "save-note", "notes": keys});
  await localforage.clear();
  console.log(await localforage.length());
}