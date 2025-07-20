const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Environment Variables
const { PRIVATE_KEY, RPC_URL, CONTRACT_ADDRESS } = process.env;

// Token ABI (permit), and MetaArbExecutor ABI
const ERC20_ABI = [
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
];

const EXECUTOR_ABI = [
  "function executeMetaTx(address user, address token, uint256 amount, uint256 deadline, bytes signature) external",
];

// Setup provider, signer, and contract
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const executor = new ethers.Contract(CONTRACT_ADDRESS, EXECUTOR_ABI, signer);

// Endpoint: Accepts signed permit & metaTx and executes both
app.post("/permit", async (req, res) => {
  try {
    const {
      owner,
      spender,
      value,
      deadline,
      v,
      r,
      s,
      token,              // token address
      metaSignature       // optional: if you want to relay after permit
    } = req.body;

    const tokenContract = new ethers.Contract(token, ERC20_ABI, signer);

    console.log("📥 Received signed permit, sending...");

    const tx = await tokenContract.permit(owner, spender, value, deadline, v, r, s);
    await tx.wait();

    console.log("✅ Permit executed. Tokens now pullable by contract.");

    // Optionally, trigger metaTx immediately after permit (optional)
    if (metaSignature) {
      console.log("➡️ Executing meta transaction...");

      const tx2 = await executor.executeMetaTx(owner, token, value, deadline, metaSignature);
      const receipt = await tx2.wait();

      res.json({
        status: "success",
        txHash: receipt.transactionHash,
        message: "Permit and MetaTx executed ✅"
      });
    } else {
      res.json({
        status: "success",
        message: "Permit executed successfully ✅"
      });
    }
  } catch (err) {
    console.error("❌ Error executing permit/metaTx:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("MetaArb Relayer is Running ✅");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Relayer server running on port ${PORT}`);
});
