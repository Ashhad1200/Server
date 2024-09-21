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

// Connect to MongoDB
async function connectToDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    return client.db(DB_NAME).collection(COLLECTION_NAME);
  } catch (err) {
    console.error("Error connecting to MongoDB:", err);
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
          resolve(JSON.parse(data));
        });
      })
      .on("error", (err) => {
        console.error("Error fetching location data:", err);
        resolve(null);
      });
  });
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const clientIp = getClientIp(req);
  const locationData = await getLocationFromIp(clientIp);

  const locationInfo = locationData
    ? `Location: ${locationData.city}, ${locationData.region}, ${locationData.country}`
    : "Location: Unable to fetch location";

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

  // Store log entry in MongoDB
  try {
    const logsCollection = await connectToDB();
    await logsCollection.insertOne(logEntry);
    console.log("Log stored in MongoDB:", logEntry);
  } catch (err) {
    console.error("Error storing log in MongoDB:", err);
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
