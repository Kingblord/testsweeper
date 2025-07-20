const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Load environment variables
const { PRIVATE_KEY, RPC_URL, CONTRACT_ADDRESS } = process.env;
const EXECUTOR_ADDRESS = CONTRACT_ADDRESS || "0xA04A11856eAA0BCe02fc6A698Cd4e2d9f7067F02";

// Basic ERC-20 Permit ABI
const ERC20_ABI = [
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external"
];

// MetaArbExecutor ABI
const EXECUTOR_ABI = [
  "function executeMetaTx(address user, address token, uint256 amount, uint256 deadline, bytes signature) external",
];

// Set up provider, signer, and contract instance
const provider = new ethers.JsonRpcProvider(RPC_URL);
const signer = new ethers.Wallet(PRIVATE_KEY, provider);
const executor = new ethers.Contract(EXECUTOR_ADDRESS, EXECUTOR_ABI, signer);

// Utility: default deadline = now + 24 hours
const getDefaultDeadline = () => Math.floor(Date.now() / 1000) + 86400;

// === API ROUTES ===

// Health check
app.get("/", (req, res) => {
  res.send("✅ MetaArb Relayer is Running");
});

// Main endpoint to relay permit + optional metaTx
app.post("/permit", async (req, res) => {
  const {
    owner,
    spender,
    value,
    token,
    deadline,
    v, r, s,
    metaSignature,
  } = req.body;

  try {
    if (!owner || !spender || !value || !token || !v || !r || !s) {
      throw new Error("Missing required fields in request body.");
    }

    const _deadline = deadline || getDefaultDeadline();
    console.log("📩 Processing Permit:");
    console.log("- Token:", token);
    console.log("- Owner:", owner);
    console.log("- Spender:", spender);
    console.log("- Value:", value);
    console.log("- Deadline:", _deadline);

    const tokenContract = new ethers.Contract(token, ERC20_ABI, signer);

    const permitTx = await tokenContract.permit(owner, spender, value, _deadline, v, r, s);
    await permitTx.wait();

    console.log(`✅ Permit Success [TX: ${permitTx.hash}]`);

    // Optionally relay metaTx
    if (metaSignature) {
      console.log("⚙️ Executing MetaTx via Executor contract...");

      const metaTx = await executor.executeMetaTx(owner, token, value, _deadline, metaSignature);
      const receipt = await metaTx.wait();

      console.log(`✅ MetaTx Success [TX: ${metaTx.hash}]`);

      return res.json({
        status: "success",
        permitTx: permitTx.hash,
        metaTx: metaTx.hash,
        message: "Permit and MetaTx executed successfully."
      });
    }

    // Only permit was sent
    return res.json({
      status: "success",
      permitTx: permitTx.hash,
      message: "Permit executed successfully."
    });

  } catch (error) {
    console.error("❌ Error executing permit/metaTx:", error);
    res.status(500).json({
      status: "error",
      message: error.reason || error.message || "Unknown error"
    });
  }
});

// Start Express server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Relayer server running at http://localhost:${PORT}`);
});
