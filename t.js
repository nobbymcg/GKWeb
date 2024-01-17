const gk = require("./gk.js");

let person = {
    first_name: "Testy",
    last_name: "McTestface",
    gender_identity: 1,
    custom_data: {
        account_type: "General",
        account_name: "McGTest"
    }
};

let jsonString = JSON.stringify(person);

console.log(jsonString);

let context = {
    base64Credentials:
        "djJfYzllYmMyODgtYTNjMS00MzJiLThlOTItNzM0Yzc3YTI2MzlhOm1jcFl3bW5XUHdQclB3TFN5a1JjTDdnSHJj",
    tokenUrl: "https://auth.crt.nuance.co.uk/oauth2/token",
    hostname: "gatekeeper.api.nuance.co.uk",
    configId: "FshareConfig",
    watchlistName: "IanWatchlist",
    scopeName: "PS_webhooks-lab-1",
    bearerAuthToken: ""
};

main();

async function main () {
    context.bearerAuthToken = await gk.GkGetOAuthToken(context);
    context.scopeId = await gk.GkGetScopeId(context);

    // Let GkStartSession also start an engagement
    [sessionId, engagementId] = await gk.GkStartSession(context);

    context.engagementId = engagementId;
    context.sessionId = sessionId;

    console.log("Session ID: " + sessionId);
    console.log("Engagement ID: " + engagementId);
    console.log(context);

    // Now create the new person

    const jsonResponse = await gk.GkCreatePerson(context, "TestyMcTestface", jsonString);

    const gkPersonId = jsonResponse.gkPersonId.value;

    console.log("Person ID: " + gkPersonId);

    await gk.GkStopSession(context);
    await gk.GkStopEngagement(context);
}

