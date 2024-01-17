
let clickState = false;
let audioInit = false;
let source;
let stream;
let audioCtx;
let analyser;

initMediaDevices();

function initMediaDevices() {
    // Older browsers might not implement mediaDevices at all, so we set an empty object first
    if (navigator.mediaDevices === undefined) {
        console.log("navigator.mediaDevices is undefined");
        navigator.mediaDevices = {};
    } else {
        console.log("navigator.mediaDevices is defined");
    }

    // Some browsers partially implement mediaDevices. We can't assign an object
    // with getUserMedia as it would overwrite existing properties.
    // Add the getUserMedia property if it's missing.
    if (navigator.mediaDevices.getUserMedia === undefined) {
        navigator.mediaDevices.getUserMedia = function (constraints) {
            // First get ahold of the legacy getUserMedia, if present
            const getUserMedia =
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia;

            // Some browsers just don't implement it - return a rejected promise with an error
            // to keep a consistent interface
            if (!getUserMedia) {
                return Promise.reject(
                    new Error("getUserMedia is not implemented in this browser")
                );
            }

            // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
            return new Promise(function (resolve, reject) {
                getUserMedia.call(navigator, constraints, resolve, reject);
            });
        };
    } else {
        console.log("getUserMedia is defined");
    }
}


function visualize() {
    WIDTH = canvas.width;
    HEIGHT = canvas.height;

    const visualSetting = "sinewave";
    console.log(visualSetting);

    if (visualSetting === "sinewave") {
      analyser.fftSize = 2048;
      const bufferLength = analyser.fftSize;
      console.log(bufferLength);

      // We can use Float32Array instead of Uint8Array if we want higher precision
      // const dataArray = new Float32Array(bufferLength);
      const dataArray = new Uint8Array(bufferLength);

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      const draw = function () {
        drawVisual = requestAnimationFrame(draw);

        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = "rgb(200, 200, 200)";
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = "rgb(0, 0, 0)";

        canvasCtx.beginPath();

        const sliceWidth = (WIDTH * 1.0) / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          let v = dataArray[i] / 128.0;
          let y = (v * HEIGHT) / 2;

          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
      };

      draw();
    }
}

function DoSomething() {
  // if the clickState is false then change the image to gatekeeper_red.svg
  // if the clickState is true then change the image to gatekeeper.svg
  if (clickState == false) {
    document.getElementById("gklogo").src = "gatekeeper_red.svg";
    clickState = true;

    if (audioInit == false) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        // Set up the different audio nodes we will use for the app
        analyser = audioCtx.createAnalyser();
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        analyser.smoothingTimeConstant = 0.85;
        audioInit = true;
    }

    // Main block for doing the audio recording
    if (navigator.mediaDevices.getUserMedia) {
        console.log("getUserMedia supported.");
        const constraints = { audio: true };
        navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function (stream) {
            source = audioCtx.createMediaStreamSource(stream);
            // analyser.connect(audioCtx.destination);
            // source.connect(analyser);

        })
        .catch(function (err) {
            console.log("The following gUM error occured: " + err);
        });
    } else {
        console.log("getUserMedia not supported on your browser!");
    }


  } else {
    document.getElementById("gklogo").src = "gatekeeper.svg";
    clickState = false;
  }
}