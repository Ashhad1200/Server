const http = require("http");
const https = require("https");
const { MongoClient } = require("mongodb");

const port = process.env.PORT || 8001;
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://ashhad:ashhad123@logs.y9wpq.mongodb.net/?retryWrites=true&w=majority&appName=logs";
const DB_NAME = "logsDB";
const COLLECTION_NAME = "logs";

const client = new MongoClient(MONGODB_URI);
let logsCollection;

// Connect to MongoDB
async function connectToDB() {
  if (logsCollection) return logsCollection; // Use existing collection if already connected

  try {
    console.log("Attempting to connect to MongoDB...");
    await client.connect();
    console.log("Connected to MongoDB successfully.");
    logsCollection = client.db(DB_NAME).collection(COLLECTION_NAME);
    return logsCollection;
  } catch (err) {
    console.error("Error connecting to MongoDB:", err); // Log connection error
    throw err;
  }
}

// Get client IP address
const getClientIp = (req) => {
  return req.headers["x-forwarded-for"] || req.socket.remoteAddress;
};

// Fetch location details from IP
const getLocationFromIp = (ip) => {
  return new Promise((resolve) => {
    if (ip === "127.0.0.1" || ip === "::1") {
      resolve({ city: "Localhost", region: "Local", country: "Local" });
      return;
    }

    https
      .get(`https://ipinfo.io/${ip}/json`, (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          try {
            resolve(JSON.parse(data)); // Parse JSON data
          } catch (error) {
            console.error("Error parsing location data:", error); // Log parsing error
            resolve(null);
          }
        });
      })
      .on("error", (err) => {
        console.error("Error fetching location data from IP:", err); // Log fetching error
        resolve(null);
      });
  });
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const clientIp = getClientIp(req);
  console.log("Received request from IP:", clientIp); // Log the client's IP

  const locationData = await getLocationFromIp(clientIp);

  const locationInfo = locationData
    ? `Location: ${locationData.city}, ${locationData.region}, ${locationData.country}`
    : "Location: Unable to fetch location";

  console.log("Location data for IP:", clientIp, locationInfo); // Log location data

  const logEntry = {
    requestTime: new Date(),
    ip: clientIp,
    location: locationInfo,
  };

  // Send HTML response
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`
        <html>
            <head>
                <title>Location Server</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #333; }
                </style>
            </head>
            <body>
                <h1>This is the message from the server</h1>
                <p>Request Time: ${new Date().toISOString()}</p>
                <p>${locationInfo}</p>
            </body>
        </html>
    `);

  try {
    console.log("Attempting to insert log into MongoDB..."); // Log attempt to insert
    const logsCollection = await connectToDB();
    await logsCollection.insertOne(logEntry);
    console.log("Log stored in MongoDB:", logEntry); // Log success
  } catch (err) {
    console.error("Error storing log in MongoDB:", err); // Log insertion error
  }
});

// Start server
server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

// Retrieve all logs from MongoDB
async function getAllLogs() {
  try {
    const logsCollection = await connectToDB();
    return await logsCollection.find().toArray();
  } catch (err) {
    console.error("Error retrieving logs:", err);
    return [];
  }
}
