const ethers = require("ethers");
const contractAbi = require("./abis/contractAbi.json");
require("dotenv").config();
const { PushAPI, CONSTANTS } = require("@pushprotocol/restapi");
const axios = require("axios");

const subgraphUrl = `${process.env.GRAPHQL_URL}/subgraphs/name/${process.env.SUBGRAPH_NAME}`;
const NOTIFY_MAX_DISTANCE = 30;

const checkAndGetWallet = (provider) => {
    let walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
    if (!walletPrivateKey || walletPrivateKey == "") {
        console.log("Please enter WALLET_PRIVATE_KEY to .env file");
        process.exit(1);
    }
    return new ethers.Wallet(walletPrivateKey, provider);
};

async function main() {
    const sepoliaProvider = new ethers.providers.WebSocketProvider("wss://sepolia.drpc.org");
    const sepoliaWallet = checkAndGetWallet(sepoliaProvider);
    const channelAdmin = await PushAPI.initialize(sepoliaWallet, {
        env: CONSTANTS.ENV.STAGING,
    });

    const provider = new ethers.providers.WebSocketProvider(process.env.WS_URL);
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractAbi, provider);

    contract.on("MetadataAccessed", async (imageId, accessor, fee, locationX, locationY, timestamp, event) => {
        const locationXNum = locationX.toNumber();
        const locationYNum = locationY.toNumber();

        console.log(
            "MetadataAccessed Event: ",
            imageId.toNumber(),
            accessor,
            fee.toNumber(),
            locationXNum,
            locationYNum,
            timestamp.toNumber()
        );

        const nearbyUsers = await getNearbyUsers(locationXNum, locationYNum);

        nearbyUsers.forEach(async (user) => {
            const distance = Math.sqrt((locationXNum - user.locationX) ** 2 + (locationYNum - user.locationY) ** 2);
            let distanceFormatted = distance.toFixed(2);

            const title = "Criminal Spotted Near You";
            let body =
                distance < 0.1
                    ? `A criminal was spotted on your location. Stay safe!`
                    : `A criminal was spotted ${distanceFormatted} meters away from your last recorded location. Stay safe!`;

            await sendNotification(channelAdmin, [user.id], title, body);
        });
    });
}

const getNearbyUsers = async (locationX, locationY) => {
    try {
        const query = `
            query GetUsersByLocation($minX: Int!, $maxX: Int!, $minY: Int!, $maxY: Int!) {
                users(where: { locationX_gte: $minX, locationX_lte: $maxX, locationY_gte: $minY, locationY_lte: $maxY }) {
                    id
                    locationX
                    locationY
                }
            }`;

        const variables = {
            minX: locationX - NOTIFY_MAX_DISTANCE,
            maxX: locationX + NOTIFY_MAX_DISTANCE,
            minY: locationY - NOTIFY_MAX_DISTANCE,
            maxY: locationY + NOTIFY_MAX_DISTANCE,
        };

        const response = await axios.post(subgraphUrl, {
            query,
            variables,
        });

        return response.data.data.users;
    } catch (error) {
        console.error("Error fetching nearby users:", error.message);
        return [];
    }
};

async function sendNotification(user, recipients, title, body) {
    if (recipients == null) recipients = ["*"];

    try {
        await user.channel.send(recipients, {
            notification: {
                title: title,
                body: body,
            },
        });
    } catch (error) {
        console.error("Error sending notification:", error.message);
    }
}

main().catch((error) => {
    console.error("Error in main function:", error);
});
