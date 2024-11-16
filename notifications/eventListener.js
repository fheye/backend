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

        const closeUsers = await findCloseUsers(locationXNum, locationYNum);

        closeUsers.forEach(async (user) => {
            const distance = Math.sqrt((locationXNum - user.locationX) ** 2 + (locationYNum - user.locationY) ** 2);
            let distanceFormatted = distance.toFixed(2);

            const title = "Criminal Spotted Near You";
            let body =
                distance < 0.1
                    ? `A criminal was spotted on your location. Stay safe!`
                    : `A criminal was spotted ${distanceFormatted} meters away from your last recorded location. Stay safe!`;

            await sendNotification(channelAdmin, [user.address], title, body);
        });
    });
}

async function findCloseUsers(locationX, locationY) {
    // TODO: Create a graph query to find address of users who are close to the given location
    // TODO: Return address and last locations of users who are close to the given location

    return [
        {
            address: "0xa8003509743746EeeAc2f978253a502edC535D44",
            locationX: 10,
            locationY: 20,
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
