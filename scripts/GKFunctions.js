
async function GkGetOAuthToken(context) {

    const response = await fetch(context.tokenUrl, {
        method: 'POST',
        body: 'grant_type=client_credentials&scope=GatekeeperService',
        // headers: {
        //     'Content-Type': 'application/x-www-form-urlencoded',
        //     'Authorization': 'Basic ' + Buffer.from(context.clientId + ":" + context.clientSecret).toString('base64')
        // }

        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + context.base64Credentials
        }
    });

    const jsonOut = await response.json();
    bearerToken = "Bearer " + jsonOut.access_token;
    return (bearerToken);
}

async function GkGetScopeId(context) {
    const url = "https://" + context.hostname + "/scopes-manager-proxy/nuance/biosec/v1/scopes/" + context.scopeName + "/gkid";
    const params = { method: 'GET', headers: { 'Authorization': context.bearerAuthToken } };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return (jsonOut.gkScopeId.value);
}

async function GKStartEngagement(context, myKvps) {
    const url = "https://" + context.hostname + "/context-manager-proxy/nuance/biosec/v1/engagements/start";
    let kvpString = "";
    Object.entries(myKvps).forEach(([key, value], index) => {
        if (index > 0) {
            kvpString += ',';
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
    const params = { method: 'PUT', headers: { 'Authorization': context.bearerAuthToken }, body: body };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return (jsonOut.gkEngagementId.value);
}

async function GkStopEngagement(context){
    const url = "https://" + context.hostname + "/context-manager-proxy/nuance/biosec/v1/engagements/stop";
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
    const params = { method: 'PUT', headers: { 'Authorization': context.bearerAuthToken }, body: body };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return(jsonOut.status.statusCode);
}

async function GkStartSession(context){
    const url = "https://" + context.hostname + "/context-manager-proxy/nuance/biosec/v1/sessions/start";
    const body = `
    {
        "context": {
            "gk_scope_id": {
                "value": "${context.scopeId}"
            },
            "gk_engagement_id":{
                "value": "${context.engagementId}"
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
    const params = { method: 'PUT', headers: { 'Authorization': context.bearerAuthToken }, body: body };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return(jsonOut.gkSessionId.value);
}

async function GkStopSession(context){
    const url = "https://" + context.hostname + "/context-manager-proxy/nuance/biosec/v1/sessions/stop";
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
    const params = { method: 'PUT', headers: { 'Authorization': context.bearerAuthToken }, body: body };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return(jsonOut.status.statusCode);
}

async function GkGetUploadUrl(context){
    const url = "https://" + context.hostname + "/audio-manager-proxy/nuance/biosec/v1/audio/upload-url";
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
        "container": 2
    }`;
    const params = { method: 'POST', headers: { 'Authorization': context.bearerAuthToken }, body: body };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return([jsonOut.mediaUploadUrl, jsonOut.gkMediaSegmentId.value]);
}

async function GkUploadAudio(mediaUploadUrl, wavFile){

    const fs = require('fs');
    var body = fs.readFileSync(wavFile);
    const params = { method: 'PUT', headers: { "Content-Type": "audio/wave" }, body: body };
    await fetch(mediaUploadUrl, params);
}

async function GkProcessAudio(context, gkMediaSegmentId){
    const url = "https://" + context.hostname + "/biometrics-supervisor-proxy/nuance/biosec/v1/voiceprints-profiles/process-audio";
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
    const params = { method: 'POST', headers: { 'Authorization': context.bearerAuthToken }, body: body };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return(jsonOut.result.gkProcessedAudioId.value);
}

async function GkAddAudio(context, wavFile){
    const [mediaUploadUrl, gkMediaSegmentId] = await GkGetUploadUrl(context);
    await GkUploadAudio(mediaUploadUrl, wavFile);
    const gkProcessedAudioId = await GkProcessAudio(context, gkMediaSegmentId);
    return([gkMediaSegmentId, gkProcessedAudioId]);
}

async function GkGetVoiceprintProfileIdRequest(context, personId, tag){
    var url = "https://" + context.hostname + "/voiceprint-profiles-manager-proxy/v1/voiceprints/profiles/gkid";
    // const body = `
    // {
    //     "context":{
    //         "gk_scope_id":{
    //             "value": "${context.scopeId}"
    //         }
    //     },
    //     "owner":{
    //         "person_id": "${personId}",
    //         "tag":"${tag}"
    //     }
    // }`;
    // GET requests can't have a body using fetch() so convert to a query string to append to url
    const queryParams = {'context.gk_scope_id.value' : context.scopeId, 'owner.person_id' : personId, 'owner.tag' : tag};
    const queryString = new URLSearchParams(queryParams).toString();

    url += "?"+queryString;

    const params = { method: 'GET', headers: { 'Authorization': context.bearerAuthToken } };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return(jsonOut.gkVoiceprintProfileId.value);
}

async function GkVerify(context, gkPersonId, gkProcessedAudioId){
    const url = "https://" + context.hostname + "/biometrics-supervisor-proxy/nuance/biosec/v1/voiceprints-profiles/" + gkPersonId + "/verify";
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
    console.log(body);
    const params = { method: 'POST', headers: { 'Authorization': context.bearerAuthToken }, body: body };
    const response = await fetch(url, params);
    const jsonOut = await response.json();
    return(jsonOut);
}

async function GkVerifyPerson(context, personId, tag, gkProcessedAudioId){
    // Convenience function that gets the gkPersonId from the
    // personId then performs the verification

    // Lookup the voiceprintId from the speakerId
    const gkPersonId = await GkGetVoiceprintProfileIdRequest(context, personId, tag);

    const response = await GkVerify(context, gkPersonId, gkProcessedAudioId);
    return(response);
}


