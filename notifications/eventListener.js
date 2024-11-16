const ethers = require("ethers");
const contractAbi = require("./abis/contractAbi.json");
require("dotenv").config();
const { PushAPI, CONSTANTS } = require("@pushprotocol/restapi");

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
        console.log("MetadataAccessed event:", imageId, accessor, fee, locationX, locationY, timestamp);
        const closeUsers = await findCloseUsers(locationX, locationY);

        // METHOD 1: Send notification to all users who are close to the given location
        closeUsers.forEach(async (user) => {
            const title = "Criminal Spotted Near Your";
            const distance = Math.sqrt((locationX - user.locationX) ** 2 + (locationY - user.locationY) ** 2);
            const body = `A criminal was spotted ${distance} meters away from your last recorded location. Stay safe!`;
            // Create a google maps link with given coordinates
            await sendNotification(channelAdmin, closeUsers, title, body);
        });
        
        // METHOD 2: Send bulk nofication, dont calculate distance for each user but send criminal coordinates
        const title = "Criminal Spotted Near Your";
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${locationX},${locationY}`;
        const body = `A criminal was spotted near ${mapsLink}. Stay safe!`;
        const closeUsersAddresses = closeUsers.map((user) => user.address);
        await sendNotification(channelAdmin, closeUsersAddresses, title, body);

        // TODO: Select one of the methods above and remove the other one
    });
}

async function findCloseUsers(locationX, locationY) {
    // TODO: Create a graph query to find address of users who are close to the given location
    // TODO: Return address and last locations of users who are close to the given location

    return [
        {
            address: "0x1234567890",
            locationX: 0,
            locationY: 0,
        },
    ];
}

async function sendNotification(user, recipients, title, body) {
    if (recipients == null) recipients = ["*"];

    const response = await user.channel.send(recipients, {
        notification: {
            title: title,
            body: body,
        },
    });
}

main().catch((error) => {
    console.error("Error in main function:", error);
});
