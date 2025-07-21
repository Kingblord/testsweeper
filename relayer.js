const express = require("express");
const { ethers } = require("ethers");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const TOKEN = "0x4953d28b12D862250Cc96163A9C46Ae2B8ef52c5";
const EXECUTOR = "0xA04A11856eAA0BCe02fc6A698Cd4e2d9f7067F02";
const PRIVATE_KEY = "0731479a89655ba66aca441259748212d7eec18eaf40efc0b437f7a61cd420ea"; // never share this
const RPC = "https://bsc-mainnet.infura.io/v3/7247e8313a2945e38898c9f05143464e";

const provider = new ethers.providers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

const executorAbi = [
  "function executeMetaTx(address token, address from, uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature) external"
];

const executor = new ethers.Contract(EXECUTOR, executorAbi, wallet);

app.post("/execute", async (req, res) => {
  try {
    const { token, from, amount, nonce, deadline, signature } = req.body;

    console.log("🛰️ Executing metaTx...");
    const tx = await executor.executeMetaTx(token, from, amount, nonce, deadline, signature);
    await tx.wait();
    console.log("✅ MetaTx executed:", tx.hash);

    res.json({ status: "success", txHash: tx.hash });
  } catch (e) {
    console.error("❌ Error:", e.message);
    res.status(500).json({ status: "error", error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Relayer listening on port ${PORT}`);
});
