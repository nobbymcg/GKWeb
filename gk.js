// Gatekeeper functions

// requestOAuthToken requests an OAuth token from the specified tokenUrl using the specified clientId and clientSecret
async function requestOAuthToken(clientId, clientSecret, tokenUrl) {
    try {
        const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
        },
        body: 'grant_type=client_credentials&scope=GatekeeperService', // Adjust the scope as needed
        });
  
        // Handle the response
        if (response.ok) {
            const json = await response.json();
            const accessToken = json.access_token;
            //console.log('Access Token:', accessToken);
            return accessToken;
        } else {
            console.error('Failed to get OAuth token:', response.statusText);
            return null;
        }
    } catch (error) {
      console.error('Error requesting OAuth token:', error.message);
      return null;
    }
}
  
// GKGetOAuthToken returns a bearer token based on the base64Credentials and tokenURL within the context structure
async function GkGetOAuthToken(context) {
    const response = await fetch(context.tokenUrl, {
        method: "POST",
        body: "grant_type=client_credentials&scope=GatekeeperService",
        // headers: {
        //     'Content-Type': 'application/x-www-form-urlencoded',
        //     'Authorization': 'Basic ' + Buffer.from(context.clientId + ":" + context.clientSecret).toString('base64')
        // }

        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + context.base64Credentials,
        },
    });

    const jsonOut = await response.json();
    bearerToken = "Bearer " + jsonOut.access_token;
    return bearerToken;
}

async function GkGetScopeId(context) {
    const url =
        "https://" +
        context.hostname +
        "/scopes-manager-proxy/nuance/biosec/v1/scopes/" +
        context.scopeName +
        "/gkid";
    const params = {
        method: "GET",
        headers: { Authorization: context.bearerAuthToken },
    };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return jsonOut.gkScopeId.value;
}

async function GkStartEngagement(context, myKvps) {
    const url =
        "https://" +
        context.hostname +
        "/context-manager-proxy/nuance/biosec/v1/engagements/start";
    let kvpString = "";
    Object.entries(myKvps).forEach(([key, value], index) => {
        if (index > 0) {
            kvpString += ",";
        }
        kvpString += '"' + key + '":"' + value + '"';
    });
    const body = `{
      "context":
      {
          "gk_scope_id":{
              "value": "${context.scopeId}"
          }
      },
      "details": {
          "custom_data":{
              ${kvpString}
          }
      },
      "field_mask": {
          "paths": [
              "details.custom_data"
          ]
      }
  }`;
    const params = {
        method: "PUT",
        headers: { Authorization: context.bearerAuthToken },
        body: body,
    };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    // check for a 401 error
    if (jsonOut.status_code == 401) {
        console.log("GkStartEngagement failed with status code " + jsonOut.status_code + " " + jsonOut.error_message);
        return null;
    }
    return jsonOut.gkEngagementId.value;
}

async function GkStopEngagement(context) {
    const url =
        "https://" +
        context.hostname +
        "/context-manager-proxy/nuance/biosec/v1/engagements/stop";
    const body = `
  {
      "context": {
          "gk_scope_id": {
              "value": "${context.scopeId}"
          },
          "gk_engagement_id": {
              "value": "${context.engagementId}"
          }
      }
  }`;
    const params = {
        method: "PUT",
        headers: { Authorization: context.bearerAuthToken },
        body: body,
    };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return jsonOut.status.statusCode;
}

async function GkStartSession(context) {
    const url =
        "https://" +
        context.hostname +
        "/context-manager-proxy/nuance/biosec/v1/sessions/start";
//     const body = `
//   {
//       "context": {
//           "gk_scope_id": {
//               "value": "${context.scopeId}"
//           },
//           "gk_engagement_id":{
//               "value": "${context.engagementId}"
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
  const body = `
  {
      "context": {
          "gk_scope_id": {
              "value": "${context.scopeId}"
          }
      },
      "session_type": 3,
      "is_test": false,
      "details": {
          "custom_data": {
              "MCG":"TEST"
          }
      }
  }`;
    const params = {
        method: "PUT",
        headers: { Authorization: context.bearerAuthToken },
        body: body,
    };
    const response = await fetch(url, params);
    const jsonOut = await response.json();

    console.log("GkStartSession response " + JSON.stringify(jsonOut));

    // check for a 401 error
    if (jsonOut.status_code == 401) {
        console.log("GkStartSession failed with status code " + jsonOut.status_code + " " + jsonOut.error_message);
        return([null, null]);
    }

    // return the sessionId and the engagementId as an array
    return ([jsonOut.gkSessionId.value, jsonOut.gkEngagementId.value]);
}

// GkCreatePerson creates a person with the specified personId and details
// personId is a string, e.g. "John Smith", "123456", etc.
// details is a json structure containing the details of the person, e.g.
// {
// "details": {
//          "first_name": "John",
//          "last_name": "Doe",
//          "gender_identity": 1,
//          "custom_data":{
//              "account_type":"gatekeeper_internal",
//              "account_name":"gatekeeper_demo"
//          }
//      }
// }
// add additional custom_data fields as required
//
async function GkCreatePerson(context, personId, details) {

    const url = "https://" + context.hostname + "/persons-manager-proxy/nuance/biosec/v1/entities/persons";
    const body = `
    {
        "context": {
            "gk_scope_id": {
                "value": "${context.scopeId}"
            },
            "gk_engagement_id": {
                "value": "${context.engagementId}"
            },
            "gk_session_id": {
                "value": "${context.sessionId}"
            }
        },
        "person_id": "${personId}",
        "details": ${details},
        "field_mask": {
            "paths": [
                "details.first_name",
                "details.last_name",
                "details.gender_identity",
                "details.custom_data"
            ]
        }
    }`;

    const params = {
        method: "POST",
        headers: { Authorization: context.bearerAuthToken },
        body: body,
    };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    console.log("GkCreatePerson response " + JSON.stringify(jsonOut));

    return jsonOut;
}

async function GkStopSession(context) {
    const url =
        "https://" +
        context.hostname +
        "/context-manager-proxy/nuance/biosec/v1/sessions/stop";
    const body = `
  {
      "context": {
          "gk_scope_id": {
              "value": "${context.scopeId}"
          },
          "gk_engagement_id": {
              "value": "${context.engagementId}"
          },
          "gk_session_id": {
              "value": "${context.sessionId}"
          }
      }
  }`;
    const params = {
        method: "PUT",
        headers: { Authorization: context.bearerAuthToken },
        body: body,
    };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return jsonOut.status.statusCode;
}

async function GkGetUploadUrl(context, container) {
    const url =
        "https://" +
        context.hostname +
        "/audio-manager-proxy/nuance/biosec/v1/audio/upload-url";
    const body = `
  {
      "context":{
          "gk_scope_id":{
              "value": "${context.scopeId}"
          },
          "gk_engagement_id":{
              "value": "${context.engagementId}"
          },
          "gk_session_id":{
              "value": "${context.sessionId}"
          }
      },
      "container": ${container}
  }`;
    const params = {
        method: "POST",
        headers: { Authorization: context.bearerAuthToken },
        body: body,
    };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return [jsonOut.mediaUploadUrl, jsonOut.gkMediaSegmentId.value];
}

async function GkUploadAudioFromFile(mediaUploadUrl, wavFile) {
    const fs = require("fs");
    var body = fs.readFileSync(wavFile);
    const params = {
        method: "PUT",
        headers: { "Content-Type": "audio/wave" },
        body: body,
    };
    await fetch(mediaUploadUrl, params);
}

async function GkProcessAudio(context, gkMediaSegmentId) {
    const url =
        "https://" +
        context.hostname +
        "/biometrics-supervisor-proxy/nuance/biosec/v1/voiceprints-profiles/process-audio";
    const body = `
  {
      "context":{
          "gk_scope_id":{
              "value": "${context.scopeId}"
          },
          "gk_engagement_id":{
              "value": "${context.engagementId}"
          },
          "gk_session_id":{
              "value": "${context.sessionId}"
          },
          "configset_id": "${context.configId}"
      },
     "gk_media_segment_id":{
          "value": "${gkMediaSegmentId}"
      }
  }`;
    const params = {
        method: "POST",
        headers: { Authorization: context.bearerAuthToken },
        body: body,
    };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return jsonOut.result.gkProcessedAudioId.value;
}

async function GkAddAudio(context, audioFile) {
    let container;
    if (audioFile.endsWith(".wav")) {
        container = 2;
    } else if (audioFile.endsWith(".mp3")) {
        container = 3;
    } else {
        console.log("Only configured to deal with .wav and .mp3 files");
        return;
    }
    const [mediaUploadUrl, gkMediaSegmentId] = await GkGetUploadUrl(context, container);
    await GkUploadAudioFromFile(mediaUploadUrl, audioFile);
    const gkProcessedAudioId = await GkProcessAudio(context, gkMediaSegmentId);
    return [gkMediaSegmentId, gkProcessedAudioId];
}

async function GkGetVoiceprintProfileIdRequest(context, personId, tag) {
    var url =
        "https://" +
        context.hostname +
        "/voiceprint-profiles-manager-proxy/v1/voiceprints/profiles/gkid";
    // GET requests can't have a body using fetch() so convert to a query string to append to url
    const queryParams = {
        "context.gk_scope_id.value": context.scopeId,
        "owner.person_id": personId,
        "owner.tag": tag,
    };
    const queryString = new URLSearchParams(queryParams).toString();

    url += "?" + queryString;

    const params = {
        method: "GET",
        headers: { Authorization: context.bearerAuthToken },
    };
    console.log("GetVoiceprintProfileIDRequest URL " + url);
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    console.log(
        "GetVoiceprintProfileIDRequest response " + JSON.stringify(jsonOut)
    );
    return jsonOut.gkVoiceprintProfileId
        ? jsonOut.gkVoiceprintProfileId.value
        : null;
}

// GkGetPersonId returnd the gk_person_id for the specified personId
async function GkGetPersonId(context, personId) {
    var url =
        "https://" + 
        context.hostname +
        "/persons-manager-proxy/v1/persons/" +
        personId +
        "/gkid"
        ;
    
    const queryParams = {
        "context.gk_scope_id.value": context.scopeId,
    };
    const queryString = new URLSearchParams(queryParams).toString();

    url += "?" + queryString;

    const params = {
        method: "GET",
        headers: { Authorization: context.bearerAuthToken },
    };
    
    // console.log("GkGetPersonId URL " + url);
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    // console.log("GkGetPersonId response " + JSON.stringify(jsonOut));

    // cehck that the statusCode is OK
    if (jsonOut.status.statusCode != "OK") {
        console.log("GkGetPersonId failed with status code " + jsonOut.status.statusCode);
        return null;
    }
    // Obtain the gkPersonId.value from the response
    return jsonOut.gkPersonId.value;
}

// Looks up the voiceprints for a personId and returns an array of voiceprintIds
// Note, convoprints and deviceprintsare also returned but we are only interested in voiceprints
async function GkListPersonProfiles(context, gkPersonId) {
    var url =
        "https://" +
        context.hostname +
        "/persons-manager-proxy/nuance/biosec/v1/entities/persons/" +
        gkPersonId +
        "/profiles";

    const queryParams = {
        "context.gk_scope_id.value": context.scopeId,
    };
    const queryString = new URLSearchParams(queryParams).toString();

    url += "?" + queryString;

    const params = {
        method: "GET",
        headers: { Authorization: context.bearerAuthToken },
    };
    // console.log("GkListPersonProfiles URL " + url);
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    // console.log("GkListPersonProfiles response " + JSON.stringify(jsonOut));

    // gkVoiceprintProfileIds is an array of objects with a single field of value
    // so we need to extract the values into a new array
    var gkVoiceprintProfileIds = jsonOut.gkVoiceprintProfileIds;
    var voiceprintProfileIds = [];
    gkVoiceprintProfileIds.forEach((element) => {
        voiceprintProfileIds.push(element.value);
    });
    return voiceprintProfileIds;
}

async function GkVerify(context, voiceprintId, gkProcessedAudioId) {
    const url =
        "https://" +
        context.hostname +
        "/biometrics-supervisor-proxy/nuance/biosec/v1/voiceprints-profiles/" +
        voiceprintId +
        "/verify";
    const body = `
  {
      "context":{
          "gk_scope_id":{
              "value": "${context.scopeId}"
          },
          "gk_engagement_id":{
              "value": "${context.engagementId}"
          },
          "gk_session_id":{
              "value": "${context.sessionId}"
          },
          "configset_id": "${context.configId}"
      },
      "gk_processed_audio_id":{
          "value": "${gkProcessedAudioId}"
      }
  }`;
    const params = {
        method: "POST",
        headers: { Authorization: context.bearerAuthToken },
        body: body,
    };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    // console.log("GkVerify response " + JSON.stringify(jsonOut));
    return jsonOut;
}

// Verifies the audio against the specified personId and tag. If tag is null then it looks up
// the voiceprints for the personId and verifies against the first voiceprint
async function GkVerifyPerson(context, personId, tag, gkProcessedAudioId) {
    
    // console.log("GkVerifyPerson personId " + personId + " tag " + tag +".");
    // if tag is null get the first voiceprint for the personId first getting the gkPersonId
    let response;
    if ((tag == null) || (tag == "")){
        // console.log("Tag is null or empty");
        const gkPersonId = await GkGetPersonId(context, personId);
        const voiceprintProfileIds = await GkListPersonProfiles(
            context,
            gkPersonId
        );
        if (voiceprintProfileIds.length > 0) {
            console.log("voiceprintId is " + voiceprintProfileIds[0]);
        } else {
            console.log("No voiceprints for personId " + personId);
            return { result: { decision: "FAIL", reason: "Speaker not enrolled" } };
        }
        response = await GkVerify(context, voiceprintProfileIds[0], gkProcessedAudioId);
    } else {

        // We have both a personId and a tag so get the voiceprintId for the personId and tag
        const voiceprintId = await GkGetVoiceprintProfileIdRequest(
            context,
            personId,
            tag
        );
        if (voiceprintId == null) {
            return { result: { decision: "FAIL", reason: "Speaker not enrolled" } };
        }
        response = await GkVerify(context, voiceprintId, gkProcessedAudioId);
    }
    return response;
}

// Export the functions to make them accessible in other files
module.exports = gk = {
    requestOAuthToken,
    GkGetOAuthToken,
    GkGetScopeId,
    GkStartEngagement,
    GkStopEngagement,
    GkStartSession,
    GkStopSession,
    GkGetUploadUrl,
    GkUploadAudioFromFile,
    GkProcessAudio,
    GkAddAudio,
    GkGetVoiceprintProfileIdRequest,
    GkListPersonProfiles,
    GkVerify,
    GkVerifyPerson,
    GkGetPersonId,
    GkCreatePerson
  };