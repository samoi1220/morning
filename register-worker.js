if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).catch(()=>{});
