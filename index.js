const fs = require('fs');
const xrpl = require('xrpl');

// URL pointing to the DID document that will be registered on the XRP Ledger
const DID_DOCUMENT_URL = "https://www.xrpl-commons.org/";

(async () => {
  // Initialize wallet either by loading existing one or creating new one
  let wallet;
  try {
    // Attempt to load wallet from local file
    const walletData = JSON.parse(fs.readFileSync('wallet.json'));
    wallet = xrpl.Wallet.fromSeed(walletData.seed);
    console.log('Successfully loaded existing wallet from file');
  } catch (error) {
    // Create new wallet if file doesn't exist or is invalid
    wallet = xrpl.Wallet.generate();

    // Save wallet details to file for future use
    fs.writeFileSync('wallet.json', JSON.stringify({
      address: wallet.address,
      seed: wallet.seed,
      publicKey: wallet.publicKey
    }, null, 2));
    console.log('Created and saved new wallet to file');
  }

  // Log wallet details for reference
  console.log('Wallet details:', {
    address: wallet.address,
    seed: wallet.seed,
    publicKey: wallet.publicKey
  });

  // Connect to XRP Ledger mainnet
  // For testing, use devnet: "wss://s.devnet.rippletest.net:51233/"
  const client = new xrpl.Client("wss://s1.ripple.com/");
  await client.connect();

  try {
    // Check current XRP balance
    const balance = await client.getXrpBalance(wallet.address);
    console.log("Current XRP balance:", balance);

    // Fund wallet if it's new (balance < 1 XRP)
    if (balance < 1) {
      const fundResult = await client.fundWallet(wallet);
      console.log("Funded wallet:", fundResult);
    }

    // Check if wallet has enough XRP to meet reserve requirements
    // DIDSet transactions require higher reserves than standard transactions
    if (balance < 20) {
      console.log("Error: Insufficient XRP balance to meet reserve requirements (need >= 20 XRP)");
      return;
    }

    // Prepare DIDSet transaction
    const prepared = await client.autofill({
      "TransactionType": "DIDSet",
      "Account": wallet.address,
      "URI": Buffer.from(DID_DOCUMENT_URL).toString('hex') // Convert URL to hex format
    });

    // Sign and submit transaction
    let signedTransaction = wallet.sign(prepared);
    const result = await client.submitAndWait(signedTransaction.tx_blob);
    console.log(`Transaction completed successfully: ${JSON.stringify(result, null, 2)}`);
    return result;

  } catch (error) {
    console.error(`Failed to set DID: ${error}`);
    return null;
  } finally {
    // Always disconnect client when done
    await client.disconnect();
  }
})();
