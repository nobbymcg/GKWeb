// Description: This is a Node.js server that will receive a POST request with an audio file in the body.
// It is expecting a POST request with URL in the form /verify/speakerId/tagId
// It will then use the Nuance Gatekeeper API to verify the speaker and return a JSON response with the result, riskScore, and biometricScore
// For example, to verify the supplied audio file against speaker "TestSpeaker" with voiceprint tag of "TI" the url would be http://localhost:8080/verify/TestSpeaker/TI
// The audio file should be in the body of the POST request
// This web service can be tested using curl as follows:
// curl -X POST -H "Content-Type: audio/ogg" --data-binary @<audio file> http://localhost:8080/verify/TestSpeaker/TI

const http = require("http");
const fs = require("fs");
const { exec } = require("child_process");
const port = 8080;
const gk = require("./gk.js");

// To preserve the security of the clientId and clientSecret I have already created the Base64 representation
// Not the best security but better than having the clientId and clientSecret in the code

let context = {
    base64Credentials:
        "djJfYzllYmMyODgtYTNjMS00MzJiLThlOTItNzM0Yzc3YTI2MzlhOm1jcFl3bW5XUHdQclB3TFN5a1JjTDdnSHJj",
    tokenUrl: "https://auth.crt.nuance.co.uk/oauth2/token",
    hostname: "gatekeeper.api.nuance.co.uk",
    configId: "FshareConfig",
    watchlistName: "IanWatchlist",
    scopeName: "PS_webhooks-lab-1",
    bearerAuthToken: "",
};

main();

async function main() {

    // We will need the OAuth token and scopeId for all gatekeeper requests so get them now
    var bearerToken = await gk.GkGetOAuthToken(context);
    context.bearerAuthToken = bearerToken;
    var scopeId = await gk.GkGetScopeId(context);
    context.scopeId = scopeId;

    // Create our simple server to handle requests from the web page
    http.createServer((req, res) => {
        const headers = {
            "Access-Control-Allow-Origin":
                "*" /* should switch off CORs, except for Safari browser, see below */,
            "Access-Control-Allow-Headers":
                "origin" /* allows safari compatability */,
            "Access-Control-Allow-Methods": "OPTIONS, POST, GET",
            "Access-Control-Max-Age": 2592000, // 30 days
            /** add other headers as per requirement */
        };

        if (req.method === "OPTIONS") {
            res.writeHead(204, headers);
            res.end();
            return;
        }

        if (["GET", "POST"].indexOf(req.method) > -1) {
            console.log(req.method, req.url);
            //console.log(req.method, req.url, req.headers);
            if (req.method === "POST") {
                var urlElements = req.url.split("/");
                // Convert urlElements[1] to lowercase allowing us to accept any capitalisation of the word verify
                console.log("urlElements[1] = " + urlElements[1]);
                urlElements[1] = urlElements[1].toLowerCase();
                // check that the req.url is in the form /verify/speakerId/tagId
                // first eleemnt in the array will be empty because the url starts with a / so remove it
                urlElements.shift();

                if (urlElements[0] === "verify" && urlElements.length >= 2) {
                    var speakerId = urlElements[1];
                    var tagId = urlElements[2] ? urlElements[2] : "";
                    let body = [];
                    req.on("data", (chunk) => {
                        body.push(chunk);
                    }).on("end", () => {
                        // write body to a file called receivedFile_(timestamp).ogg
                        console.log("Received audio file");
                        var d = new Date();
                        var myTimestamp =
                            "" +
                            d.getFullYear() +
                            d.getMonth() +
                            d.getDate() +
                            d.getHours() +
                            d.getMinutes() +
                            d.getSeconds() +
                            d.getMilliseconds(); // the '' at the start forces it to string rather than add the numbers
                        var tmpFile = "receivedFile_" + myTimestamp + ".ogg";
                        //var verifyResult = new Object();

                        // Write the body to a file
                        fs.writeFile(
                            tmpFile,
                            Buffer.concat(body),
                            async (err) => {
                                if (err) throw err;
                                console.log("The file, " + tmpFile + ", has been saved!");

                                // Now execute shell command ffmpeg to convert the file to wav
                                // Also downsampl eto 8kHz
                                newFile = "receivedFile_" + myTimestamp + ".wav";
                                console.log(
                                    "running ffmpeg -hide_banner -i " + tmpFile + " -ar 8000 " + newFile );
                                exec(
                                    "ffmpeg -hide_banner -i " + tmpFile + " -ar 8000 " + newFile,
                                    (error, stdout, stderr) => {
                                        if (error) {
                                            console.log(`error: ${error.message}`);
                                            return;
                                        }
                                    }
                                );

                                // Now execute shell command ffmpeg to convert the file to mp3 
                                // newFile = "receivedFile_" + myTimestamp + ".mp3";
                                // console.log(
                                //     "running ffmpeg -hide_banner -i " + tmpFile + " " + newFile );
                                // exec(
                                //     "ffmpeg -hide_banner -i " + tmpFile + " " + newFile,
                                //     (error, stdout, stderr) => {
                                //         if (error) {
                                //             console.log(`error: ${error.message}`);
                                //             return;
                                //         }
                                //     }
                                // );

                                // Now do the verification
                                
                                if (tagId == "") {
                                    console.log("Verifying speaker " + speakerId + ", no tag specified");
                                } else  {
                                    console.log("Verifying speaker " + speakerId + " with tag " + tagId);
                                }

                                // The verifySpeaker function is async so we need to await the result
                                // time the interaction with the Nuance Gatekeeper API
                                const verifyResult = await verifySpeaker(context, newFile, speakerId, tagId);
                                
                                // console.log(verifyResult);

                                // Create json response with fields of result, riskScore, and biometric score
                                var jsonResponse = new Object();
                                if (verifyResult.status.statusCode == "OK") {
                                
                                    jsonResponse.result = verifyResult.result.decision;
                                    jsonResponse.reason = verifyResult.result.reason;

                                    console.log(
                                        "Decision = " + verifyResult.result.decision
                                    );

                                    // Where UNCERTAIN there will be no riskEngineResult
                                    if (verifyResult.result.riskEngineResult) {
                                        console.log("RiskScore = " + verifyResult.result.riskEngineResult.risk);
                                        console.log("BioScore = " + verifyResult.result.authenticationScore.biometricScore);
                                        jsonResponse.riskScore = verifyResult.result.riskEngineResult.risk;
                                        jsonResponse.biometricScore = verifyResult.result.authenticationScore.biometricScore;
                                    } else {
                                        console.log("RiskScore = N/A");
                                        jsonResponse.riskScore = jsonResponse.biometricScore = "N/A";
                                    }
                                } else {
                                    jsonResponse.result = "ERROR";
                                    jsonResponse.reason = "Error - check voiceprint";
                                    jsonResponse.riskScore = jsonResponse.biometricScore = "N/A";
                                }

                                // Send the response
                                jsonString = JSON.stringify(jsonResponse);
                                res.writeHead(200, headers);
                                res.end(jsonString);

                                // Now delete the temporary files
                                fs.unlink(newFile, (err) => {
                                    if (err) {
                                        console.error(err);
                                    }
                                });
                                fs.unlink(tmpFile, (err) => {
                                    if (err) {
                                        console.error(err);
                                    }
                                });
                            }
                        );
                    });
                } else {
                    console.log("Invalid url");
                    res.writeHead(400, headers);
                    res.end("Invalid url");
                }
            } else {
                console.log("How did I get here!");
                res.writeHead(405, headers);
                res.end(`${req.method} is not allowed for the request.`);
            }
        }
    }).listen(port, () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
}


async function verifySpeaker(context, filename, speakerId, tagId) {
    // Verify the speaker
    console.time("verifySpeaker");

    // Moved the following to main() so that we only need to get the OAuth token and scopeId once
    // var bearerToken = await GkGetOAuthToken(context);
    // context.bearerAuthToken = bearerToken;
    // var scopeId = await GkGetScopeId(context);
    // context.scopeId = scopeId;
    let sessionId;
    let engagementId;
   
    // Use GkStartSession to create the engagement and session. This removes the need to call GkStartEngagement
    // engagementId = await GkStartEngagement(context, { GKApp: "true" });
    // if (engagementId == null) {

    //     // Likely that the authentication token has expired so get a new one and try again
    //     console.log("verifySpeaker failed to start engagement");
    //     context.bearerAuthToken = await GkGetOAuthToken(context);
    //     engagementId = await GkStartEngagement(context, { GKApp: "true" });
    // }
    // context.engagementId = engagementId;

    [sessionId, engagementId] = await gk.GkStartSession(context);

    if (engagementId == null) {
        // Likely that the authentication token has expired so get a new one and try again
        console.log("verifySpeaker failed to start session");
        context.bearerAuthToken = await gk.GkGetOAuthToken(context);
        [sessionId, engagementId] = await gk.GkStartSession(context);
    }

    context.engagementId = engagementId;
    context.sessionId = sessionId;

    console.timeLog("verifySpeaker", "Session started");

    const [gkMediaSegmentId, gkProcessedAudioId] = await gk.GkAddAudio(
        context,
        filename
    );

    console.timeLog("verifySpeaker", "Audio added");
    verifyResult = await gk.GkVerifyPerson(
        context,
        speakerId,
        tagId,
        gkProcessedAudioId
    );
    console.timeLog("verifySpeaker", "Speaker verified");
    await gk.GkStopSession(context);
    await gk.GkStopEngagement(context);

    console.timeEnd("verifySpeaker", "Completed");
    return verifyResult;
}

// Gatekeeper functions

// async function GkGetOAuthToken(context) {
//     const response = await fetch(context.tokenUrl, {
//         method: "POST",
//         body: "grant_type=client_credentials&scope=GatekeeperService",
//         // headers: {
//         //     'Content-Type': 'application/x-www-form-urlencoded',
//         //     'Authorization': 'Basic ' + Buffer.from(context.clientId + ":" + context.clientSecret).toString('base64')
//         // }

//         headers: {
//             "Content-Type": "application/x-www-form-urlencoded",
//             Authorization: "Basic " + context.base64Credentials,
//         },
//     });

//     const jsonOut = await response.json();
//     bearerToken = "Bearer " + jsonOut.access_token;
//     return bearerToken;
// }

// async function GkGetScopeId(context) {
//     const url =
//         "https://" +
//         context.hostname +
//         "/scopes-manager-proxy/nuance/biosec/v1/scopes/" +
//         context.scopeName +
//         "/gkid";
//     const params = {
//         method: "GET",
//         headers: { Authorization: context.bearerAuthToken },
//     };
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     return jsonOut.gkScopeId.value;
// }

// async function GkStartEngagement(context, myKvps) {
//     const url =
//         "https://" +
//         context.hostname +
//         "/context-manager-proxy/nuance/biosec/v1/engagements/start";
//     let kvpString = "";
//     Object.entries(myKvps).forEach(([key, value], index) => {
//         if (index > 0) {
//             kvpString += ",";
//         }
//         kvpString += '"' + key + '":"' + value + '"';
//     });
//     const body = `{
//       "context":
//       {
//           "gk_scope_id":{
//               "value": "${context.scopeId}"
//           }
//       },
//       "details": {
//           "custom_data":{
//               ${kvpString}
//           }
//       },
//       "field_mask": {
//           "paths": [
//               "details.custom_data"
//           ]
//       }
//   }`;
//     const params = {
//         method: "PUT",
//         headers: { Authorization: context.bearerAuthToken },
//         body: body,
//     };
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     // check for a 401 error
//     if (jsonOut.status_code == 401) {
//         console.log("GkStartEngagement failed with status code " + jsonOut.status_code + " " + jsonOut.error_message);
//         return null;
//     }
//     return jsonOut.gkEngagementId.value;
// }

// async function GkStopEngagement(context) {
//     const url =
//         "https://" +
//         context.hostname +
//         "/context-manager-proxy/nuance/biosec/v1/engagements/stop";
//     const body = `
//   {
//       "context": {
//           "gk_scope_id": {
//               "value": "${context.scopeId}"
//           },
//           "gk_engagement_id": {
//               "value": "${context.engagementId}"
//           }
//       }
//   }`;
//     const params = {
//         method: "PUT",
//         headers: { Authorization: context.bearerAuthToken },
//         body: body,
//     };
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     return jsonOut.status.statusCode;
// }

// async function GkStartSession(context) {
//     const url =
//         "https://" +
//         context.hostname +
//         "/context-manager-proxy/nuance/biosec/v1/sessions/start";
// //     const body = `
// //   {
// //       "context": {
// //           "gk_scope_id": {
// //               "value": "${context.scopeId}"
// //           },
// //           "gk_engagement_id":{
// //               "value": "${context.engagementId}"
// //           }
// //       },
// //       "session_type": 3,
// //       "is_test": false,
// //       "details": {
// //           "custom_data": {
// //               "MCG":"TEST"
// //           }
// //       }
// //   }`;
//   const body = `
//   {
//       "context": {
//           "gk_scope_id": {
//               "value": "${context.scopeId}"
//           }
//       },
//       "session_type": 3,
//       "is_test": false,
//       "details": {
//           "custom_data": {
//               "MCG":"TEST"
//           }
//       }
//   }`;
//     const params = {
//         method: "PUT",
//         headers: { Authorization: context.bearerAuthToken },
//         body: body,
//     };
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();

//     console.log("GkStartSession response " + JSON.stringify(jsonOut));

//     // check for a 401 error
//     if (jsonOut.status_code == 401) {
//         console.log("GkStartSession failed with status code " + jsonOut.status_code + " " + jsonOut.error_message);
//         return([null, null]);
//     }

//     // return the sessionId and the engagementId as an array
//     return ([jsonOut.gkSessionId.value, jsonOut.gkEngagementId.value]);
// }

// async function GkStopSession(context) {
//     const url =
//         "https://" +
//         context.hostname +
//         "/context-manager-proxy/nuance/biosec/v1/sessions/stop";
//     const body = `
//   {
//       "context": {
//           "gk_scope_id": {
//               "value": "${context.scopeId}"
//           },
//           "gk_engagement_id": {
//               "value": "${context.engagementId}"
//           },
//           "gk_session_id": {
//               "value": "${context.sessionId}"
//           }
//       }
//   }`;
//     const params = {
//         method: "PUT",
//         headers: { Authorization: context.bearerAuthToken },
//         body: body,
//     };
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     return jsonOut.status.statusCode;
// }

// async function GkGetUploadUrl(context, container) {
//     const url =
//         "https://" +
//         context.hostname +
//         "/audio-manager-proxy/nuance/biosec/v1/audio/upload-url";
//     const body = `
//   {
//       "context":{
//           "gk_scope_id":{
//               "value": "${context.scopeId}"
//           },
//           "gk_engagement_id":{
//               "value": "${context.engagementId}"
//           },
//           "gk_session_id":{
//               "value": "${context.sessionId}"
//           }
//       },
//       "container": ${container}
//   }`;
//     const params = {
//         method: "POST",
//         headers: { Authorization: context.bearerAuthToken },
//         body: body,
//     };
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     return [jsonOut.mediaUploadUrl, jsonOut.gkMediaSegmentId.value];
// }

// async function GkUploadAudioFromFile(mediaUploadUrl, wavFile) {
//     const fs = require("fs");
//     var body = fs.readFileSync(wavFile);
//     const params = {
//         method: "PUT",
//         headers: { "Content-Type": "audio/wave" },
//         body: body,
//     };
//     await fetch(mediaUploadUrl, params);
// }

// async function GkProcessAudio(context, gkMediaSegmentId) {
//     const url =
//         "https://" +
//         context.hostname +
//         "/biometrics-supervisor-proxy/nuance/biosec/v1/voiceprints-profiles/process-audio";
//     const body = `
//   {
//       "context":{
//           "gk_scope_id":{
//               "value": "${context.scopeId}"
//           },
//           "gk_engagement_id":{
//               "value": "${context.engagementId}"
//           },
//           "gk_session_id":{
//               "value": "${context.sessionId}"
//           },
//           "configset_id": "${context.configId}"
//       },
//      "gk_media_segment_id":{
//           "value": "${gkMediaSegmentId}"
//       }
//   }`;
//     const params = {
//         method: "POST",
//         headers: { Authorization: context.bearerAuthToken },
//         body: body,
//     };
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     return jsonOut.result.gkProcessedAudioId.value;
// }

// async function GkAddAudio(context, audioFile) {
//     let container;
//     if (audioFile.endsWith(".wav")) {
//         container = 2;
//     } else if (audioFile.endsWith(".mp3")) {
//         container = 3;
//     } else {
//         console.log("Only configured to deal with .wav and .mp3 files");
//         return;
//     }
//     const [mediaUploadUrl, gkMediaSegmentId] = await GkGetUploadUrl(context, container);
//     await GkUploadAudioFromFile(mediaUploadUrl, audioFile);
//     const gkProcessedAudioId = await GkProcessAudio(context, gkMediaSegmentId);
//     return [gkMediaSegmentId, gkProcessedAudioId];
// }

// async function GkGetVoiceprintProfileIdRequest(context, personId, tag) {
//     var url =
//         "https://" +
//         context.hostname +
//         "/voiceprint-profiles-manager-proxy/v1/voiceprints/profiles/gkid";
//     // GET requests can't have a body using fetch() so convert to a query string to append to url
//     const queryParams = {
//         "context.gk_scope_id.value": context.scopeId,
//         "owner.person_id": personId,
//         "owner.tag": tag,
//     };
//     const queryString = new URLSearchParams(queryParams).toString();

//     url += "?" + queryString;

//     const params = {
//         method: "GET",
//         headers: { Authorization: context.bearerAuthToken },
//     };
//     console.log("GetVoiceprintProfileIDRequest URL " + url);
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     console.log(
//         "GetVoiceprintProfileIDRequest response " + JSON.stringify(jsonOut)
//     );
//     return jsonOut.gkVoiceprintProfileId
//         ? jsonOut.gkVoiceprintProfileId.value
//         : null;
// }

// // GkGetPersonId returnd the gk_person_id for the specified personId
// async function GkGetPersonId(context, personId) {
//     var url =
//         "https://" + 
//         context.hostname +
//         "/persons-manager-proxy/v1/persons/" +
//         personId +
//         "/gkid"
//         ;
    
//     const queryParams = {
//         "context.gk_scope_id.value": context.scopeId,
//     };
//     const queryString = new URLSearchParams(queryParams).toString();

//     url += "?" + queryString;

//     const params = {
//         method: "GET",
//         headers: { Authorization: context.bearerAuthToken },
//     };
    
//     // console.log("GkGetPersonId URL " + url);
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     // console.log("GkGetPersonId response " + JSON.stringify(jsonOut));

//     // cehck that the statusCode is OK
//     if (jsonOut.status.statusCode != "OK") {
//         console.log("GkGetPersonId failed with status code " + jsonOut.status.statusCode);
//         return null;
//     }
//     // Obtain the gkPersonId.value from the response
//     return jsonOut.gkPersonId.value;
// }

// // Looks up the voiceprints for a personId and returns an array of voiceprintIds
// // Note, convoprints and deviceprintsare also returned but we are only interested in voiceprints
// async function GkListPersonProfiles(context, gkPersonId) {
//     var url =
//         "https://" +
//         context.hostname +
//         "/persons-manager-proxy/nuance/biosec/v1/entities/persons/" +
//         gkPersonId +
//         "/profiles";

//     const queryParams = {
//         "context.gk_scope_id.value": context.scopeId,
//     };
//     const queryString = new URLSearchParams(queryParams).toString();

//     url += "?" + queryString;

//     const params = {
//         method: "GET",
//         headers: { Authorization: context.bearerAuthToken },
//     };
//     // console.log("GkListPersonProfiles URL " + url);
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     // console.log("GkListPersonProfiles response " + JSON.stringify(jsonOut));

//     // gkVoiceprintProfileIds is an array of objects with a single field of value
//     // so we need to extract the values into a new array
//     var gkVoiceprintProfileIds = jsonOut.gkVoiceprintProfileIds;
//     var voiceprintProfileIds = [];
//     gkVoiceprintProfileIds.forEach((element) => {
//         voiceprintProfileIds.push(element.value);
//     });
//     return voiceprintProfileIds;
// }

// async function GkVerify(context, voiceprintId, gkProcessedAudioId) {
//     const url =
//         "https://" +
//         context.hostname +
//         "/biometrics-supervisor-proxy/nuance/biosec/v1/voiceprints-profiles/" +
//         voiceprintId +
//         "/verify";
//     const body = `
//   {
//       "context":{
//           "gk_scope_id":{
//               "value": "${context.scopeId}"
//           },
//           "gk_engagement_id":{
//               "value": "${context.engagementId}"
//           },
//           "gk_session_id":{
//               "value": "${context.sessionId}"
//           },
//           "configset_id": "${context.configId}"
//       },
//       "gk_processed_audio_id":{
//           "value": "${gkProcessedAudioId}"
//       }
//   }`;
//     const params = {
//         method: "POST",
//         headers: { Authorization: context.bearerAuthToken },
//         body: body,
//     };
//     const response = await fetch(url, params);
//     const jsonOut = await response.json();
//     // console.log("GkVerify response " + JSON.stringify(jsonOut));
//     return jsonOut;
// }

// // Verifies the audio against the specified personId and tag. If tag is null then it looks up
// // the voiceprints for the personId and verifies against the first voiceprint
// async function GkVerifyPerson(context, personId, tag, gkProcessedAudioId) {
    
//     // console.log("GkVerifyPerson personId " + personId + " tag " + tag +".");
//     // if tag is null get the first voiceprint for the personId first getting the gkPersonId
//     let response;
//     if ((tag == null) || (tag == "")){
//         // console.log("Tag is null or empty");
//         const gkPersonId = await GkGetPersonId(context, personId);
//         const voiceprintProfileIds = await GkListPersonProfiles(
//             context,
//             gkPersonId
//         );
//         if (voiceprintProfileIds.length > 0) {
//             console.log("voiceprintId is " + voiceprintProfileIds[0]);
//         } else {
//             console.log("No voiceprints for personId " + personId);
//             return { result: { decision: "FAIL", reason: "Speaker not enrolled" } };
//         }
//         response = await GkVerify(context, voiceprintProfileIds[0], gkProcessedAudioId);
//     } else {

//         // We have both a personId and a tag so get the voiceprintId for the personId and tag
//         const voiceprintId = await GkGetVoiceprintProfileIdRequest(
//             context,
//             personId,
//             tag
//         );
//         if (voiceprintId == null) {
//             return { result: { decision: "FAIL", reason: "Speaker not enrolled" } };
//         }
//         response = await GkVerify(context, voiceprintId, gkProcessedAudioId);
//     }
//     return response;
// }
