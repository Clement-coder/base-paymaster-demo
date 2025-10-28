// --- index.js ---
import 'dotenv/config';
import { http, createPublicClient, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { createSmartAccountClient } from 'permissionless';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { createPimlicoClient } from 'permissionless/clients/pimlico';

// 1️⃣ Load secrets
const rpcUrl = process.env.PAYMASTER_RPC_URL;
const privateKey1 = process.env.PRIVATE_KEY_1;
const privateKey2 = process.env.PRIVATE_KEY_2;

// 2️⃣ Base constants
const ENTRY_POINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const FACTORY_ADDRESS = '0x15Ba39375ee2Ab563E8873C8390be6f2E2F50232';
const CONTRACT_ADDRESS = '0x83bd615eb93eE1336acA53e185b03B54fF4A17e8'; // example NFT contract

// 3️⃣ Create a client to talk to Base
const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl),
});

// 4️⃣ Setup Paymaster
const paymaster = createPimlicoClient({
  chain: base,
  transport: http(rpcUrl),
  entryPoint: ENTRY_POINT,
});

// 5️⃣ Initialize Smart Accounts
async function initAccounts() {
  const owner1 = privateKeyToAccount(privateKey1);
  const owner2 = privateKeyToAccount(privateKey2);

  const acc1 = await toSimpleSmartAccount({
    client: publicClient,
    owner: owner1,
    factoryAddress: FACTORY_ADDRESS,
    entryPoint: ENTRY_POINT,
  });
  const acc2 = await toSimpleSmartAccount({
    client: publicClient,
    owner: owner2,
    factoryAddress: FACTORY_ADDRESS,
    entryPoint: ENTRY_POINT,
  });

  const client1 = createSmartAccountClient({
    account: acc1,
    chain: base,
    bundlerTransport: http(rpcUrl),
    middleware: {
      sponsorUserOperation: paymaster.sponsorUserOperation,
    },
  });

  const client2 = createSmartAccountClient({
    account: acc2,
    chain: base,
    bundlerTransport: http(rpcUrl),
    middleware: {
      sponsorUserOperation: paymaster.sponsorUserOperation,
    },
  });

  return { client1, client2 };
}

// 6️⃣ ABI of NFT contract (mintTo)
const nftAbi = [
  {
    "inputs": [{ "internalType": "address", "name": "to", "type": "address" }],
    "name": "mintTo",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// 7️⃣ Function to send a sponsored transaction
async function sendSponsoredTx(client, toAddress) {
  try {
    const data = encodeFunctionData({
      abi: nftAbi,
      functionName: 'mintTo',
      args: [toAddress],
    });

    const txHash = await client.sendTransaction({
      account: client.account,
      to: CONTRACT_ADDRESS,
      data,
      value: 0n,
    });

    console.log(`✅ Sponsored transaction from: ${client.account.address}`);
    console.log(`🔗 View: https://basescan.org/tx/${txHash}`);
  } catch (err) {
    console.error('❌ Transaction failed:', err);
  }
}

// 8️⃣ Main flow
(async () => {
  const { client1, client2 } = await initAccounts();

  await sendSponsoredTx(client1, client1.account.address);
  await sendSponsoredTx(client2, client2.account.address);
})();
