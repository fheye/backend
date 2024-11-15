const ethers = require('ethers');
const contractAbi = require('./abis/contractAbi.json');
require('dotenv').config();
const { PushAPI, CONSTANTS } = require('@pushprotocol/restapi');

const checkAndGetWallet = (provider) => {
    let walletPrivateKey = process.env.WALLET_PRIVATE_KEY;
    if (!walletPrivateKey || walletPrivateKey == '') {
        console.log('Please enter WALLET_PRIVATE_KEY to .env file');
        process.exit(1);
    }
    return new ethers.Wallet(walletPrivateKey, provider);
}

async function main() {
    const sepoliaProvider = new ethers.providers.WebSocketProvider("wss://sepolia.drpc.org");
    const sepoliaWallet = checkAndGetWallet(sepoliaProvider);
    const channelAdmin = await PushAPI.initialize(sepoliaWallet, {
        env: CONSTANTS.ENV.STAGING,
    });

    const provider = new ethers.providers.WebSocketProvider(process.env.WS_URL);
    const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, contractAbi, provider);

    contract.on('SampleEvent', async (variables, event) => {
        await sendNotification(channelAdmin, null, 'Event Title', `Event Body`);
    });
}

async function sendNotification(user, recipients, title, body) {
    if (recipients == null) recipients = ['*'];
    
    const response = await user.channel.send(recipients, {
        notification: {
            title: title,
            body: body,
        },
    });
}

main().catch((error) => {
    console.error('Error in main function:', error);
});
