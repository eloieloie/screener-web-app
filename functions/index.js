const functions = require("firebase-functions");
const fetch = require("node-fetch");

exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello from Firebase!");
});

exports.nseProxy = functions.https.onRequest(async (request, response) => {
  // Set CORS headers for all responses
  response.set("Access-Control-Allow-Origin", "*");
  response.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.set("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight requests for CORS
  if (request.method === "OPTIONS") {
    response.status(204).send("");
    return;
  }

  // Construct the target URL for the NSE API
  const nseUrl = `https://www.nseindia.com${request.url}`;

  try {
    // Make the request to the NSE API with a realistic User-Agent
    const nseResponse = await fetch(nseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.nseindia.com/",
        "Origin": "https://www.nseindia.com",
      },
    });

    // Get the response body as text
    const responseBody = await nseResponse.text();

    // Try to parse the response as JSON
    try {
      const jsonData = JSON.parse(responseBody);
      // If successful, send the JSON data back to the client
      response.set("Content-Type", "application/json");
      response.status(200).send(jsonData);
    } catch (jsonError) {
      // If parsing fails, it's likely an HTML error page from NSE
      console.warn("NSE did not return JSON. It's likely an HTML error page.");
      console.log("NSE Response Body:", responseBody.substring(0, 500)); // Log the beginning of the response for debugging

      // Send a structured error message to the client
      response.status(502).json({
        success: false,
        message: "The NSE API returned an invalid response (likely HTML instead of JSON).",
      });
    }
  } catch (error) {
    console.error("Error proxying to NSE:", error);
    response.status(500).json({
      success: false,
      message: "An internal error occurred while proxying the request to the NSE API.",
      error: error.message,
    });
  }
});
