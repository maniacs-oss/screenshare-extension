chrome.runtime.onConnect.addListener(function(port) {

  port.onMessage.addListener(function(message) {
    if (message && message.method == 'getSourceId') {
      getSourceID(message.payload.requestId);
    }
    if (message && message.method == 'registerWithGCM') {
      registerIfUnregistered();
    }
  });

  function getSourceID(requestId) {
    
  	// as related in https://code.google.com/p/chromium/issues/detail?id=413602 and https://code.google.com/p/chromium/issues/detail?id=425344 :
  	// a frame/iframe requesting screen sharing from a different origin than the parent window
  	// will receive the InvalidStateError when using the getUserMedia function.
  	// the solution its to change the tab.url property to the same as of the requesting iframe. Its works without iframe as well.
  	// requires Chrome 40+
	
  	var tab = port.sender.tab;
  	tab.url = port.sender.url;
	
	  chrome.desktopCapture.chooseDesktopMedia(['screen', 'window'], tab, function(sourceId) {
      // "sourceId" will be empty if permission is denied
      if(!sourceId || !sourceId.length) {
        return port.postMessage({ method: 'permissionDenied', payload: { requestId: requestId }});
      }
            
      // "ok" button is clicked; share "sourceId" with the
      // content-script which will forward it to the webpage
      port.postMessage({ method: 'sourceId', payload: { requestId: requestId, sourceId: sourceId } });
    });
  }
  
  // GCM
  function registerIfUnregistered() {
    chrome.storage.local.get("registered", function(result) {
      // If already registered, bail out.
      //if (result["registered"]) return;
      console.log("registerIfUnregistered")
      chrome.gcm.register(["342188328879"], registerCallback);
    });
  }

  function registerCallback(registrationId) {
    if (chrome.runtime.lastError) {
      // When the registration fails, handle the error and retry the
      // registration later.
      return;
    }

    // Send the registration token to your application server.
    port.postMessage({method: 'registrationId', payload: registrationId});
  
    // Once the registration token is received by your server,
    // set the flag such that register will not be invoked
    // next time when the app starts up.
    chrome.storage.local.set({registered: true});
  }
});

chrome.gcm.onMessage.addListener(function(event) {
  var message;
  var params = JSON.parse(event.data.params);

  if (params.channel.name) { 
    message = 'Joined your "' + params.channel.name + '" call';
  } else {
    message = 'Joined your Speak call';
  }

  var title = params.user.first_name;
  if (params.user.last_name) {
    title += " " + params.user.last_name;
  }

  var id = "n" + (new Date()).getTime();
  var notif = chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'logo-notification.png',
    title: title,
    message: message,
    buttons: [{
      title: 'Join'
    }]
  });
  
  chrome.notifications.onButtonClicked.addListener(function(notificationId){
    if (notificationId == id) {
      chrome.tabs.create({ url: params.channel.public_url });
    }
  });
});