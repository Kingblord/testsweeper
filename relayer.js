const express = require("express");
const bodyParser = require("body-parser");
const { ethers } = require("ethers");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());

const EXECUTOR_ABI = [
  "function executeMetaTx(address token,address from,uint256 amount,uint256 nonce,uint256 deadline,bytes signature) external"
];

const TOKEN_EXECUTOR = "0xA04A11856eAA0BCe02fc6A698Cd4e2d9f7067F02";
const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const executor = new ethers.Contract(TOKEN_EXECUTOR, EXECUTOR_ABI, wallet);

app.post("/execute", async (req, res) => {
  try {
    const { token, from, amount, nonce, deadline, signature } = req.body;

    const tx = await executor.executeMetaTx(
      token,
      from,
      amount,
      nonce,
      deadline,
      signature
    );

    await tx.wait();
    res.json({ success: true, hash: tx.hash });
  } catch (err) {
    console.error("❌ Relayer error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Relayer running on port ${PORT}`));
