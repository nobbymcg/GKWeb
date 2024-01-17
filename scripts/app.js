// set up basic variables for app

var record = document.querySelector('.record');
var soundClips = document.querySelector('.sound-clips');
//var canvas = document.querySelector('.visualizer');
var canvas = document.querySelector('.circularvisualizer');
var mainSection = document.querySelector('.main-controls');
var clipCount = 1;

var recordState = false;
var processingState = false;

var scopeBackgroundColor = 'rgb(255, 255, 255)';
var scopeLineColor = 'rgb(128, 255, 128)';
var scopeCircleMargin = 100;


// Choose a min and max radius so the oscilloscope will vibrate between these values
var minRadius = (canvas.height/2)*0.3;
var maxHeight = (canvas.height/2) - minRadius;

// visualiser setup - create web audio api context and canvas

var audioCtx;

// var audioCtx = new (window.AudioContext || webkitAudioContext)();
var canvasCtx = canvas.getContext("2d");

var chunks = [];

// lastResult stores the last verification result from the middleware
var lastResult = '';

showGKLogo(); 

main();

//main block for doing the audio recording

async function main() {
  if (navigator.mediaDevices.getUserMedia) {
    console.log('getUserMedia supported.');

    var constraints = { audio: true };

    var onSuccess = function(stream) {
      var mediaRecorder = new MediaRecorder(stream);

      record.onclick = function() {
        if (!audioCtx){
          audioCtx = new (window.AudioContext || webkitAudioContext)();
          visualize(stream);
        }

        if (recordState == false) {
          mediaRecorder.start();
          recordState = true;
          record.textContent = 'Stop';
          record.style.backgroundColor = "#f45a6a";
          // Reset the Gatekeeper logo to grey
          lastResult = '';
          console.log(mediaRecorder.state);
          console.log("recorder started");
        } else {
          mediaRecorder.stop();
          recordState = false;
          record.textContent = 'Record';
          record.style.backgroundColor = "#0088cc";
          console.log(mediaRecorder.state);
          console.log("recorder stopped");
        }
      }

      mediaRecorder.onstop = async function(e) {
        console.log("data available after MediaRecorder.stop() called.");

        processingState = true;

        await displayAudioAndResults();

        console.log("recorder stopped");
      }

      mediaRecorder.ondataavailable = function(e) {
        chunks.push(e.data);
      }
    }

    var onError = function(err) {
      console.log('The following error occured: ' + err);
    }

    navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);

  } else {
    console.log('getUserMedia not supported on your browser!');
  }
}

function visualize(stream) {
  var source = audioCtx.createMediaStreamSource(stream);

  var analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  var bufferLength = analyser.frequencyBinCount;
  var dataArray = new Uint8Array(bufferLength);

  source.connect(analyser);
  //analyser.connect(audioCtx.destination);

  draw();

  function draw() {

    //drawOscilloscope();
    drawCircleOscilloscope();

  }

  function drawOscilloscope(){
    WIDTH = canvas.width
    HEIGHT = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = 'rgb(200, 200, 230)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

    canvasCtx.beginPath();

    var sliceWidth = WIDTH * 1.0 / bufferLength;
    var x = 0;


    for(var i = 0; i < bufferLength; i++) {
 
      var v = dataArray[i] / 128.0;
      var y = HEIGHT/2;
      if (recordState == true) {
        y = v * HEIGHT/2;
      }

      if(i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height/2);
    canvasCtx.stroke();
  }

  function drawCircleOscilloscope(){
    var width = canvas.width
    var height = canvas.height;

    requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    canvasCtx.fillStyle = scopeBackgroundColor;
    canvasCtx.fillRect(0, 0, width, height);

    canvasCtx.lineWidth = 4;
    if (recordState == true) {
      // canvasCtx.strokeStyle = scopeLineColor;
      cycleStrokeColor();
    } else {
      // Use the resting, non-recording color
      canvasCtx.strokeStyle = 'rgb(0,170,238)';
    }

    canvasCtx.beginPath();

    // Take the buffer and express it as a circle with the radius at each point varying by the dataarray value
    // Will plot 2pi radians of the circle, so divide bufferlength by 2pi to get the number of points to plot
    // x value is r.Cos(theta) and y value is r.Sin(theta), where r is the radius adjusted by the databuffer value

    var step = (2*Math.PI)/bufferLength;

    for(var i = 0; i < bufferLength; i++) {
      var angle = i*step;
      var v = dataArray[i] / 128.0;
      var r;
      if (recordState == true) {
        r = minRadius + v * (maxHeight/2);
      } else {
        r = minRadius + maxHeight/2;
      }
      var x = (width/2) + r*Math.cos(angle);
      var y = (height/2) + r*Math.sin(angle);
  
      if(i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

    }
    // Need the stroke function to show the shape just drawn
    canvasCtx.stroke();

    // Now draw the gatekeeper logo in the centre of the canvas
    showGKLogo();

  }

}

var hue = 112;
var hueStep = 1;
var hueMin = 112;
var hueMax = 200;

function cycleStrokeColor(){
  // Cycle through hues from 112 to 200 then back down to 112
  // this covers the green through light blue range

  canvasCtx.strokeStyle = 'hsl(' + hue + ', 100%, 70%)';
  hue += hueStep;
  // Change direction of hue change when we reach the min or max
  if (hue > hueMax) {
    hueStep = -1;
  }
  if (hue < hueMin) {
    hueStep = 1;
  }
}

var phue = 112;
function cycleProcessingColor(){
  // Cycle through hues from 112 to 200 then back down to 112
  // this covers the green through light blue range

  canvasCtx.strokeStyle = 'hsl(' + phue + ', 100%, 70%)';
  hue += hueStep;
  // Change direction of hue change when we reach the min or max
  if (hue > hueMax) {
    hueStep = -1;
  }
  if (hue < hueMin) {
    hueStep = 1;
  }
}

async function displayAudioAndResults(){

  // var clipName = prompt('Enter a name for your sound clip?','Audio'+clipCount++);
  var clipName = 'Audio'+clipCount++;
  var clipContainer = document.createElement('article');
  //var clipLabel = document.createElement('p');
  var clipResultImage = document.createElement('img');
  clipResultImage.src = 'images/gatekeeper_grey.svg';
  clipResultImage.className = 'gklogo';
  clipResultImage.alt = 'Unknown Result';
  var audio = document.createElement('audio');
  var deleteButton = document.createElement('button');
  
  clipContainer.classList.add('clip');
  deleteButton.textContent = 'Delete';
  deleteButton.className = 'delete';

  var resultsHolder = document.createElement('p');
  resultsHolder.className = 'results';
  resultsHolder.textContent = 'Awaiting Results...';

  var audioblob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
  var audioURL = window.URL.createObjectURL(audioblob);
  audio.src = audioURL;
  audio.controls = true;
  audio.title = clipName + ".ogg";
  audio.type = 'audio/ogg; codecs=opus';

  clipContainer.appendChild(audio);
  clipContainer.appendChild(clipResultImage);
  clipContainer.appendChild(resultsHolder);
  clipContainer.appendChild(deleteButton);
  soundClips.appendChild(clipContainer);

  deleteButton.onclick = function(e) {
    evtTgt = e.target;
    evtTgt.parentNode.parentNode.removeChild(evtTgt.parentNode);
  }

  // Now do the verification
  var blobToSend = new Blob(chunks, {type: 'octet/stream;'});
  chunks = [];

  verifyWithMiddleware(blobToSend, clipResultImage, resultsHolder);

}

function showGKLogo(){

  // Now position the gatekeeper logo in the centre of the canvas
  var gkLogo = document.getElementById('gklogo');
  var gkimg = new Image();
  if (lastResult == 'DECISION_AUTHENTIC') {
    gkimg.src = 'images/gatekeeper_open_green.svg';
  } else  if (lastResult == 'DECISION_NO_MATCH') {
    gkimg.src = 'images/gatekeeper_red.svg';
  } else {
    gkimg.src = gkLogo.data;
  }

  var gkCentreX = canvas.width/2;
  var gkCentreY = canvas.height/2;
  var scalingFactor = 1.2;
  var gkScaledWidth = gkimg.width*scalingFactor;
  var gkScaledHeight = gkimg.height*scalingFactor;
  var gkX = gkCentreX - (gkScaledWidth/2);
  var gkY = gkCentreY - (gkScaledHeight/2);
  canvasCtx.drawImage(gkimg, gkX, gkY, gkScaledWidth, gkScaledHeight);
  // surround the logo with a circle unless we're recording
  if (recordState == false) {
    canvasCtx.beginPath();
    canvasCtx.lineWidth = 4;
    canvasCtx.strokeStyle = 'rgb(0,170,238)';
    canvasCtx.arc(gkCentreX, gkCentreY, minRadius+(maxHeight/2), 0, 2 * Math.PI);
    canvasCtx.stroke();
  }
  if (processingState == true) {

    // Need some holding graphic here

    cycleProcessingColor();
    canvasCtx.font = '38px Arial';
    canvasCtx.textAlign = 'center';
    // Create a filled rectangele to put the text in
    canvasCtx.fillStyle = 'rgba(255,255,255s,0.5)';
    canvasCtx.fillRect(gkCentreX-100, gkCentreY-50, 200, 100);
    canvasCtx.fillStyle = 'hsl(' + hue + ', 100%, 70%)';
    canvasCtx.fillText('Processing...', gkCentreX, gkCentreY);
    // canvasCtx.beginPath();
    // canvasCtx.lineWidth = 4;
    // canvasCtx.strokeStyle = 'red';
    // canvasCtx.arc(gkCentreX, gkCentreY, minRadius, 0, 2 * Math.PI);
    // canvasCtx.stroke();
  }
}

window.onresize = function() {
  canvas.width = mainSection.offsetWidth;
  if (recordState == false) {
    showGKLogo();
  }
}

window.onresize();

// Send command to Middleware to interact with Gatekeeper

function verifyWithMiddleware(blob, imageHolder, resultsHolder){
  var request = new XMLHttpRequest();
  request.open("POST", "http://localhost:8080/verify/IanMcG/TI");
  request.send(blob);
  var response = '';
  request.onload = function() {
    processingState = false;
    if (request.status == 200) {
      console.log("Middleware returned 200");
      console.log(request.response);
      var jsonResponse = JSON.parse(request.response);
      console.log(jsonResponse);
      response = jsonResponse.result;
      if (response == 'DECISION_AUTHENTIC') {
        imageHolder.src = 'images/gatekeeper_open_green.svg';
        lastResult = 'DECISION_AUTHENTIC';
      } else if (response == 'DECISION_NO_MATCH') {
        imageHolder.src = 'images/gatekeeper_red.svg';
        lastResult = 'DECISION_NO_MATCH';
      } else {
        imageHolder.src = 'images/gatekeeper_grey.svg';
        lastResult = 'DECISION_UNKNOWN';
      }
      resultsHolder.textContent = response + ' (Score=' + jsonResponse.biometricScore + ')';
    } else {
      console.log("Middleware returned " + request.status);
      console.log(request.response);
      response = request.response;
    }
  }
}



