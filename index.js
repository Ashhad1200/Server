const http = require("http");
const https = require('https');
const { MongoClient } = require('mongodb');

const port = process.env.PORT || 8001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ashhad:ashhad123@logs.y9wpq.mongodb.net/?retryWrites=true&w=majority&appName=logs';
const DB_NAME = 'logsDB';
const COLLECTION_NAME = 'logs';

const client = new MongoClient(MONGODB_URI);

// Function to connect to the MongoDB database
async function connectToDB() {
    try {
        // Always connect to the client
        await client.connect();
        return client.db(DB_NAME).collection(COLLECTION_NAME);
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
        throw err;
    }
}

// Function to get the real IP address (checks for proxies)
const getClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
};

// Function to get location details from IP
const getLocationFromIp = (ip, callback) => {
    if (ip === '127.0.0.1' || ip === '::1') {
        callback({ city: 'Localhost', region: 'Local', country: 'Local' });
        return;
    }

    const url = `https://ipinfo.io/${ip}/json`;

    https.get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
            data += chunk;
        });

        response.on('end', () => {
            const locationData = JSON.parse(data);
            callback(locationData);
        });
    }).on('error', (err) => {
        console.log("Error fetching location data:", err);
        callback(null);
    });
};

const Server = http.createServer(async (request, res) => {
    console.log(`"this is the message for user"`);
    
    const clientIp = getClientIp(request);
    res.end(`"this is the message from server" ${new Date().toISOString()}`);

    getLocationFromIp(clientIp, async (locationData) => {
        let locationInfo = locationData ? 
            `Location: ${locationData.city}, ${locationData.region}, ${locationData.country}` : 
            'Location: Unable to fetch location';

        const logEntry = {
            requestTime: new Date(),
            ip: clientIp,
            location: locationInfo
        };

        try {
            const logsCollection = await connectToDB();
            await logsCollection.insertOne(logEntry);
            console.log("Log stored in MongoDB:", logEntry);
        } catch (err) {
            console.error("Error storing log in MongoDB:", err);
        }
    });
});

Server.listen(port, () => console.log(`server started on port ${port}`));

// Function to retrieve all logs from MongoDB
async function getAllLogs() {
    try {
        const logsCollection = await connectToDB();
        const logs = await logsCollection.find().toArray();
        return logs;
    } catch (err) {
        console.log("Error retrieving logs:", err);
        return [];
    }
}
